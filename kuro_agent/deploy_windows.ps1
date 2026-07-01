# KURO Agent - Windows 一鍵部署
# 使用方式：在此資料夾內右鍵 → 「用 PowerShell 執行」

$ErrorActionPreference = "Stop"

$PROJECT_ID = "kuro-agent"
$REGION = "asia-east1"
$JOB_NAME = "kuro-agent"
$BOT_SERVICE = "kuro-bot"
$BILLING_ACCOUNT = "01428F-2DB0DF-37961C"

Write-Host "=== KURO Agent 部署開始 ===" -ForegroundColor Cyan
Write-Host "Project: $PROJECT_ID"
Write-Host ""

# 確認 gcloud 已安裝
if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Host "❌ 找不到 gcloud！" -ForegroundColor Red
    Write-Host "請先安裝：https://cloud.google.com/sdk/docs/install-sdk#windows"
    Read-Host "按 Enter 結束"
    exit 1
}

# 確認必要檔案存在
$missing = @()
if (-not (Test-Path ".env"))                  { $missing += ".env" }
if (-not (Test-Path "credentials.json"))      { $missing += "credentials.json" }
if (-not (Test-Path "data\yt_token.pickle"))  { $missing += "data\yt_token.pickle" }

if ($missing.Count -gt 0) {
    Write-Host "❌ 缺少以下檔案：" -ForegroundColor Red
    $missing | ForEach-Object { Write-Host "   - $_" }
    Write-Host ""
    Write-Host "請確認這些檔案存在於 kuro_agent\ 資料夾內。"
    Read-Host "按 Enter 結束"
    exit 1
}

Write-Host "✅ 所有必要檔案都存在" -ForegroundColor Green

# 讀取 .env
$env_vars = @{}
Get-Content ".env" | ForEach-Object {
    if ($_ -match "^([^#=]+)=(.*)$") {
        $env_vars[$Matches[1].Trim()] = $Matches[2].Trim()
    }
}
$TELEGRAM_BOT_TOKEN = $env_vars["TELEGRAM_BOT_TOKEN"]

# Step 1：設定專案
Write-Host ""
Write-Host "[1/7] 設定 Google Cloud 專案..." -ForegroundColor Yellow
gcloud config set project $PROJECT_ID

# Step 2：連結計費帳號
Write-Host "[2/7] 連結計費帳號..." -ForegroundColor Yellow
gcloud beta billing projects link $PROJECT_ID --billing-account=$BILLING_ACCOUNT 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "  計費帳號已連結或無需重新連結，繼續..." -ForegroundColor Gray
}

# Step 3：啟用必要 API
Write-Host "[3/7] 啟用 Cloud Run / Secret Manager API..." -ForegroundColor Yellow
gcloud services enable `
    run.googleapis.com `
    secretmanager.googleapis.com `
    cloudbuild.googleapis.com `
    cloudscheduler.googleapis.com `
    --project=$PROJECT_ID

# Step 4：上傳 Secrets
Write-Host "[4/7] 上傳 API 金鑰到 Secret Manager..." -ForegroundColor Yellow

function Create-Or-Update-Secret($name, $value) {
    $existing = gcloud secrets describe $name --project=$PROJECT_ID 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  更新 $name..."
        $value | gcloud secrets versions add $name --data-file=- --project=$PROJECT_ID
    } else {
        Write-Host "  建立 $name..."
        $value | gcloud secrets create $name --data-file=- --project=$PROJECT_ID
    }
}

Create-Or-Update-Secret "GEMINI_API_KEY"      $env_vars["GEMINI_API_KEY"]
Create-Or-Update-Secret "ELEVENLABS_API_KEY"  $env_vars["ELEVENLABS_API_KEY"]
Create-Or-Update-Secret "KURO_VOICE_ID"       $env_vars["KURO_VOICE_ID"]
Create-Or-Update-Secret "TELEGRAM_BOT_TOKEN"  $env_vars["TELEGRAM_BOT_TOKEN"]
Create-Or-Update-Secret "TELEGRAM_CHAT_ID"    $env_vars["TELEGRAM_CHAT_ID"]

# 上傳 credentials.json
$creds_exists = gcloud secrets describe "youtube-credentials" --project=$PROJECT_ID 2>$null
if ($LASTEXITCODE -eq 0) {
    gcloud secrets versions add "youtube-credentials" --data-file=credentials.json --project=$PROJECT_ID
} else {
    gcloud secrets create "youtube-credentials" --data-file=credentials.json --project=$PROJECT_ID
}
Write-Host "  youtube-credentials 已上傳"

# 上傳 yt_token.pickle
$token_exists = gcloud secrets describe "youtube-token" --project=$PROJECT_ID 2>$null
if ($LASTEXITCODE -eq 0) {
    gcloud secrets versions add "youtube-token" --data-file=data\yt_token.pickle --project=$PROJECT_ID
} else {
    gcloud secrets create "youtube-token" --data-file=data\yt_token.pickle --project=$PROJECT_ID
}
Write-Host "  youtube-token 已上傳"

# Step 5：部署 kuro-agent Job
Write-Host "[5/7] 部署 kuro-agent Job（影片生成，約 3-5 分鐘）..." -ForegroundColor Yellow
gcloud run jobs deploy $JOB_NAME `
    --source . `
    --region=$REGION `
    --project=$PROJECT_ID `
    --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest" `
    --set-secrets="ELEVENLABS_API_KEY=ELEVENLABS_API_KEY:latest" `
    --set-secrets="KURO_VOICE_ID=KURO_VOICE_ID:latest" `
    --set-secrets="TELEGRAM_BOT_TOKEN=TELEGRAM_BOT_TOKEN:latest" `
    --set-secrets="TELEGRAM_CHAT_ID=TELEGRAM_CHAT_ID:latest" `
    --set-secrets="/app/credentials.json=youtube-credentials:latest" `
    --set-secrets="/app/data/yt_token.pickle=youtube-token:latest" `
    --memory=2Gi `
    --cpu=2 `
    --task-timeout=1800 `
    --max-retries=1

# Step 6：部署 kuro-bot Service
Write-Host "[6/7] 部署 kuro-bot Service（Telegram 機器人）..." -ForegroundColor Yellow
gcloud run deploy $BOT_SERVICE `
    --source . `
    --dockerfile=Dockerfile.bot `
    --region=$REGION `
    --project=$PROJECT_ID `
    --set-secrets="TELEGRAM_BOT_TOKEN=TELEGRAM_BOT_TOKEN:latest" `
    --set-secrets="TELEGRAM_CHAT_ID=TELEGRAM_CHAT_ID:latest" `
    --set-env-vars="GOOGLE_CLOUD_PROJECT=$PROJECT_ID,CLOUD_RUN_REGION=$REGION" `
    --memory=256Mi `
    --cpu=1 `
    --allow-unauthenticated `
    --min-instances=0 `
    --max-instances=1

# 設定 Telegram Webhook
$BOT_URL = gcloud run services describe $BOT_SERVICE `
    --region=$REGION `
    --project=$PROJECT_ID `
    --format="value(status.url)"

Write-Host "  設定 Telegram Webhook → $BOT_URL/webhook"
$webhook_resp = Invoke-RestMethod -Uri "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook?url=${BOT_URL}/webhook"
if ($webhook_resp.ok) {
    Write-Host "  ✅ Webhook 設定成功" -ForegroundColor Green
} else {
    Write-Host "  ❌ Webhook 設定失敗：$($webhook_resp | ConvertTo-Json)" -ForegroundColor Red
}

# Step 7：設定 Cloud Scheduler
Write-Host "[7/7] 設定每日自動發片排程..." -ForegroundColor Yellow
$SA_EMAIL = (gcloud iam service-accounts list --project=$PROJECT_ID --format="value(email)" | Select-Object -First 1)

gcloud scheduler jobs create http kuro-daily `
    --location=$REGION `
    --project=$PROJECT_ID `
    --schedule="0 1 * * *" `
    --time-zone="Asia/Taipei" `
    --uri="https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT_ID}/jobs/${JOB_NAME}:run" `
    --http-method=POST `
    --oauth-service-account-email=$SA_EMAIL `
    --message-body="{}" 2>$null

if ($LASTEXITCODE -ne 0) {
    Write-Host "  排程已存在，跳過" -ForegroundColor Gray
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  KURO 部署完成！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "每天凌晨 1:00（台灣時間）自動上傳 YouTube 影片"
Write-Host "Telegram 機器人：@Lugalubot"
Write-Host ""
Write-Host "測試方式：打開 Telegram，傳「幫助」給 @Lugalubot"
Write-Host ""
Read-Host "按 Enter 結束"
