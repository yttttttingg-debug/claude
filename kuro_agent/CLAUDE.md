# KURO Agent — 專案狀態

## 專案簡介
KURO 是一個 AI 機器貓角色，自動經營 YouTube 頻道。
每集內容：KURO 觀察人類行為並寫下「無法理解」的日記。
目標：24小時全自動，部署在 Google Cloud Run。

## 檔案結構
```
kuro_agent/
├── main.py              # 主流程：腳本→配音→影片→上傳
├── script_gen.py        # Gemini 2.5 Flash 生成 KURO 日記腳本
├── voice_gen.py         # ElevenLabs TTS 生成 KURO 聲音
├── video_composer.py    # FFmpeg 合成影片（開頭/結尾精美圖，中間普通圖）
├── youtube_upload.py    # YouTube Data API v3 上傳
├── auth_youtube.py      # 一次性 YouTube OAuth 授權工具
├── config.py            # 讀取 .env + KURO 人物設定 prompt
├── requirements.txt
├── Dockerfile           # Cloud Run 部署用
├── .env                 # API keys（已 gitignore，不 commit）
├── credentials.json     # YouTube OAuth client（已 gitignore）
├── assets/
│   ├── kuro.png              # 主圖（3D 寫實坐姿，深藍背景）
│   └── kuro_holographic.png  # 精美圖（透明全息，黑色背景）
└── data/
    ├── yt_token.pickle   # YouTube token（已 gitignore）
    └── entry_count.txt   # 目前集數計數器
```

## 環境設定
```bash
cd kuro_agent
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## API Keys（存在 .env）
- `GEMINI_API_KEY` — Gemini 2.5 Flash 腳本生成
- `ELEVENLABS_API_KEY` — KURO 聲音合成
- `KURO_VOICE_ID` — ElevenLabs 上的 KURO 聲音 ID
- `YOUTUBE_CLIENT_SECRETS=credentials.json`

## 目前狀態
| 功能 | 狀態 | 備註 |
|------|------|------|
| Gemini 腳本生成 | ✅ 正常 | 繁體中文，300-400字 |
| ElevenLabs 配音 | ✅ 程式碼正確 | 開發環境 proxy 擋住，Cloud Run 會正常 |
| FFmpeg 影片合成 | ✅ 程式碼完成 | 開發環境沒裝 ffmpeg，Cloud Run 會安裝 |
| YouTube 授權 | ✅ token 已取得 | 測試模式，token 約7天過期需重新授權 |
| YouTube 上傳 | ✅ 程式碼完成 | 待 Cloud Run 測試 |

## 影片結構
```
[0:00 - 0:03]  全息 KURO + 淡入 + "觀察日誌，第 N 號"
[0:03 - 結束前3秒]  一般 KURO + 緩慢放大 + 字幕旁白
[最後3秒]  全息 KURO + 淡出 + "無法理解。記錄完畢。"
```

## 常用指令
```bash
# 測試腳本生成（最快）
source venv/bin/activate
python -c "from script_gen import generate_script; r=generate_script(entry_number=1); print(r['script'])"

# 完整流程測試（不上傳）
python main.py --dry-run --entry 1

# 指定主題
python main.py --topic "人類明明很累卻不睡覺" --entry 2

# 重新授權 YouTube（token 過期時）
python auth_youtube.py  # 取得 URL
python auth_youtube.py <授權碼>  # 完成授權
```

## Cloud Run 部署

### 前置：在 Google Cloud Console 執行
```
gcloud auth login
gcloud config set project kuro-agent
```

### 一鍵部署
```bash
cd kuro_agent
bash deploy.sh
```
腳本會自動：
1. 啟用 API（Cloud Run、Secret Manager、Cloud Scheduler）
2. 把 .env / credentials.json / yt_token.pickle 上傳到 Secret Manager
3. 部署 Cloud Run Job（2 vCPU / 2GB，timeout 30分鐘）
4. 跑一次測試驗證正常
5. 建立 Cloud Scheduler（每天凌晨 1:00 台灣時間）

### 手動觸發 / 查 log
```bash
gcloud run jobs execute kuro-agent --region=asia-east1
gcloud run jobs executions list --job=kuro-agent --region=asia-east1
```

### YouTube Token 過期（約7天）
1. 本機重跑：`python auth_youtube.py` → 複製 URL → 貼回授權碼
2. 更新 secret：`gcloud secrets versions add youtube-token --data-file=data/yt_token.pickle`

## YouTube OAuth 注意事項
- 目前是「外部」測試模式，token 7天過期
- 長期解法：在 Google Cloud Console 把 OAuth 同意畫面送審，或改用 Service Account（但 YouTube 不支援 Service Account 上傳）
- 最簡單續期：token 過期時重跑 `auth_youtube.py`

## Git
- Repo: `yttttttingg-debug/claude`
- Branch: `claude/cloud-ai-agent-install-xp1mbs`
- PR: https://github.com/yttttttingg-debug/claude/pull/7
