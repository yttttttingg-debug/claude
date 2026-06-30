#!/bin/bash
# KURO Agent — Cloud Run 一鍵部署腳本
# 使用前確認：gcloud auth login 已完成，並設定好 PROJECT_ID

set -e

PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-kuro-agent}"
REGION="asia-east1"
JOB_NAME="kuro-agent"
BOT_SERVICE="kuro-bot"

echo "=== KURO Agent 部署到 Cloud Run ==="
echo "Project: $PROJECT_ID"
echo "Region:  $REGION"
echo ""

# 1. 啟用必要 API
echo "[1/6] 啟用 API..."
gcloud services enable \
    run.googleapis.com \
    secretmanager.googleapis.com \
    cloudbuild.googleapis.com \
    cloudscheduler.googleapis.com \
    --project="$PROJECT_ID"

# 2. 建立 Secrets
echo "[2/6] 設定 Secrets..."

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
create_secret "TELEGRAM_BOT_TOKEN" "$TELEGRAM_BOT_TOKEN"
create_secret "TELEGRAM_CHAT_ID" "$TELEGRAM_CHAT_ID"

# 上傳 credentials.json
if [ -f "credentials.json" ]; then
    if gcloud secrets describe "youtube-credentials" --project="$PROJECT_ID" &>/dev/null; then
        gcloud secrets versions add "youtube-credentials" --data-file=credentials.json --project="$PROJECT_ID"
    else
        gcloud secrets create "youtube-credentials" --data-file=credentials.json --project="$PROJECT_ID"
    fi
    echo "  youtube-credentials 已更新"
fi

# 上傳 yt_token.pickle
if [ -f "data/yt_token.pickle" ]; then
    if gcloud secrets describe "youtube-token" --project="$PROJECT_ID" &>/dev/null; then
        gcloud secrets versions add "youtube-token" --data-file=data/yt_token.pickle --project="$PROJECT_ID"
    else
        gcloud secrets create "youtube-token" --data-file=data/yt_token.pickle --project="$PROJECT_ID"
    fi
    echo "  youtube-token 已更新"
fi

# 3. 部署 Cloud Run Job（影片生成）
echo "[3/6] 部署 kuro-agent Job..."
gcloud run jobs deploy "$JOB_NAME" \
    --source . \
    --region="$REGION" \
    --project="$PROJECT_ID" \
    --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest" \
    --set-secrets="ELEVENLABS_API_KEY=ELEVENLABS_API_KEY:latest" \
    --set-secrets="KURO_VOICE_ID=KURO_VOICE_ID:latest" \
    --set-secrets="TELEGRAM_BOT_TOKEN=TELEGRAM_BOT_TOKEN:latest" \
    --set-secrets="TELEGRAM_CHAT_ID=TELEGRAM_CHAT_ID:latest" \
    --set-secrets="/app/credentials.json=youtube-credentials:latest" \
    --set-secrets="/app/data/yt_token.pickle=youtube-token:latest" \
    --memory=2Gi \
    --cpu=2 \
    --task-timeout=1800 \
    --max-retries=1

# 4. 部署 Telegram Bot Service
echo "[4/6] 部署 kuro-bot Service..."
gcloud run deploy "$BOT_SERVICE" \
    --source . \
    --dockerfile=Dockerfile.bot \
    --region="$REGION" \
    --project="$PROJECT_ID" \
    --set-secrets="TELEGRAM_BOT_TOKEN=TELEGRAM_BOT_TOKEN:latest" \
    --set-secrets="TELEGRAM_CHAT_ID=TELEGRAM_CHAT_ID:latest" \
    --set-env-vars="GOOGLE_CLOUD_PROJECT=$PROJECT_ID,CLOUD_RUN_REGION=$REGION" \
    --memory=256Mi \
    --cpu=1 \
    --allow-unauthenticated \
    --min-instances=0 \
    --max-instances=1

# 取得 Bot Service URL 並設定 Telegram Webhook
BOT_URL=$(gcloud run services describe "$BOT_SERVICE" \
    --region="$REGION" \
    --project="$PROJECT_ID" \
    --format="value(status.url)")

echo "  設定 Telegram Webhook → $BOT_URL/webhook"
curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook?url=${BOT_URL}/webhook" | python3 -c "import sys,json; r=json.load(sys.stdin); print('  ✅ Webhook 設定成功' if r['ok'] else f'  ❌ {r}')"

# 5. 設定 Cloud Scheduler（每天凌晨 1:00 台灣時間）
echo "[5/6] 設定 Cloud Scheduler..."
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

# 6. 給 Bot Service 觸發 Job 的權限
echo "[6/6] 設定 IAM 權限..."
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$(gcloud run services describe $BOT_SERVICE --region=$REGION --project=$PROJECT_ID --format='value(spec.template.spec.serviceAccountName)' 2>/dev/null || echo "${PROJECT_ID}@appspot.gserviceaccount.com")" \
    --role="roles/run.admin" \
    --condition=None \
    2>/dev/null || echo "  IAM 設定請手動確認"

echo ""
echo "=== 部署完成！==="
echo "KURO 每天凌晨 1:00（台灣時間）自動上傳新影片。"
echo "Telegram Bot：@Lugalubot"
echo ""
echo "手動觸發：傳「發片」給 @Lugalubot"
echo "指定主題：傳「主題 人類假日卻不休息」給 @Lugalubot"
