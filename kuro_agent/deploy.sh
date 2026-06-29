#!/bin/bash
# KURO Agent — Cloud Run 一鍵部署腳本
# 使用前確認：gcloud auth login 已完成，並設定好 PROJECT_ID

set -e

PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-kuro-agent}"
REGION="asia-east1"
JOB_NAME="kuro-agent"

echo "=== KURO Agent 部署到 Cloud Run ==="
echo "Project: $PROJECT_ID"
echo "Region:  $REGION"
echo ""

# 1. 啟用必要 API
echo "[1/5] 啟用 API..."
gcloud services enable \
    run.googleapis.com \
    secretmanager.googleapis.com \
    cloudbuild.googleapis.com \
    cloudscheduler.googleapis.com \
    --project="$PROJECT_ID"

# 2. 建立 Secrets（如果已存在會跳過）
echo "[2/5] 設定 Secrets..."

create_secret() {
    local name=$1
    local value=$2
    if gcloud secrets describe "$name" --project="$PROJECT_ID" &>/dev/null; then
        echo "  $name 已存在，更新版本..."
        echo -n "$value" | gcloud secrets versions add "$name" --data-file=- --project="$PROJECT_ID"
    else
        echo "  建立 $name..."
        echo -n "$value" | gcloud secrets create "$name" --data-file=- --project="$PROJECT_ID"
    fi
}

# 讀取本機 .env
source .env

create_secret "GEMINI_API_KEY" "$GEMINI_API_KEY"
create_secret "ELEVENLABS_API_KEY" "$ELEVENLABS_API_KEY"
create_secret "KURO_VOICE_ID" "$KURO_VOICE_ID"

# 上傳 credentials.json
if [ -f "credentials.json" ]; then
    if gcloud secrets describe "youtube-credentials" --project="$PROJECT_ID" &>/dev/null; then
        gcloud secrets versions add "youtube-credentials" --data-file=credentials.json --project="$PROJECT_ID"
    else
        gcloud secrets create "youtube-credentials" --data-file=credentials.json --project="$PROJECT_ID"
    fi
    echo "  youtube-credentials 已更新"
else
    echo "  警告：credentials.json 不存在，跳過"
fi

# 上傳 yt_token.pickle
if [ -f "data/yt_token.pickle" ]; then
    if gcloud secrets describe "youtube-token" --project="$PROJECT_ID" &>/dev/null; then
        gcloud secrets versions add "youtube-token" --data-file=data/yt_token.pickle --project="$PROJECT_ID"
    else
        gcloud secrets create "youtube-token" --data-file=data/yt_token.pickle --project="$PROJECT_ID"
    fi
    echo "  youtube-token 已更新"
else
    echo "  警告：data/yt_token.pickle 不存在，跳過"
fi

# 3. 部署 Cloud Run Job
echo "[3/5] 部署 Cloud Run Job..."
gcloud run jobs deploy "$JOB_NAME" \
    --source . \
    --region="$REGION" \
    --project="$PROJECT_ID" \
    --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest" \
    --set-secrets="ELEVENLABS_API_KEY=ELEVENLABS_API_KEY:latest" \
    --set-secrets="KURO_VOICE_ID=KURO_VOICE_ID:latest" \
    --set-secrets="/app/credentials.json=youtube-credentials:latest" \
    --set-secrets="/app/data/yt_token.pickle=youtube-token:latest" \
    --memory=2Gi \
    --cpu=2 \
    --task-timeout=1800 \
    --max-retries=1

# 4. 手動測試跑一次
echo "[4/5] 測試執行一次..."
gcloud run jobs execute "$JOB_NAME" \
    --region="$REGION" \
    --project="$PROJECT_ID" \
    --wait

# 5. 設定 Cloud Scheduler（每天凌晨 1:00 台灣時間發布）
echo "[5/5] 設定 Cloud Scheduler..."
SA_EMAIL="$(gcloud iam service-accounts list --project="$PROJECT_ID" --format='value(email)' | head -1)"

gcloud scheduler jobs create http kuro-daily \
    --location="$REGION" \
    --project="$PROJECT_ID" \
    --schedule="0 1 * * *" \
    --time-zone="Asia/Taipei" \
    --uri="https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT_ID}/jobs/${JOB_NAME}:run" \
    --http-method=POST \
    --oauth-service-account-email="$SA_EMAIL" \
    --message-body="{}" \
    2>/dev/null || echo "  Scheduler 已存在，跳過建立"

echo ""
echo "=== 部署完成！==="
echo "KURO 每天凌晨 1:00（台灣時間）自動上傳新影片。"
echo ""
echo "手動觸發：gcloud run jobs execute $JOB_NAME --region=$REGION"
echo "查看 log：gcloud run jobs executions list --job=$JOB_NAME --region=$REGION"
