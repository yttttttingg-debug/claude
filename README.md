# claude

一個「不休息」的 AI 服務：一個常駐執行的 Node.js/TypeScript 程式，同時提供

- **多平台聊天機器人**：Telegram、Discord、LINE（各自用環境變數獨立開關，缺哪個 token 就自動跳過該平台）
- **內建排程任務**：每日簡報、隨機任務、網站監控警報（用 `node-cron`，服務只要活著就會持續執行）
- **YouTube 頻道自動經營**（選用）：AI 自己想主題、寫腳本、用免費工具生成投影片式短影片、
  自動上傳、自動回覆留言 — 詳見下方「YouTube 頻道自動化」章節

底層都是呼叫 Gemini API（`@google/genai`），有免費額度可用。

## 快速開始（本機）

```bash
npm install
cp .env.example .env   # 填入 GEMINI_API_KEY，以及你要啟用的平台 token
npm run dev
```

## 環境變數

見 `.env.example`。至少要有 `GEMINI_API_KEY`；`TELEGRAM_BOT_TOKEN` /
`DISCORD_BOT_TOKEN` / `LINE_CHANNEL_ACCESS_TOKEN`+`LINE_CHANNEL_SECRET`
可以只填一個、全部都填、或先都不填（純排程模式）。

- Telegram token：跟 `@BotFather` 申請
- Discord token：Discord Developer Portal > 你的 Application > Bot > Token
- LINE token/secret：LINE Developers Console > Messaging API channel（LINE 是走
  webhook，需要把 `https://你的網域/webhooks/line` 設回 LINE 後台的 Webhook URL）

## 部署（讓它真的「不休息」）

這個對話環境本身是暫時性容器，工作階段結束就會被回收，**無法**用來長期運行服務。
程式碼已經用 `Dockerfile` 容器化，可以部署到任何支援 Docker 的雲端主機。

### 推薦：Google Cloud Compute Engine e2-micro（永久免費）

這是目前唯一「Google 官方保證永久免費、且真正適合常駐背景服務」的選項 —
注意 **Cloud Run 不適合**這個專案：它是「有請求才喚醒」的架構，跟我們需要一直
連著的 Telegram/Discord 輪詢、以及排程任務衝突，硬要保持常駐容易超出免費額度而收費。

步驟：

1. 到 [Google Cloud Console](https://console.cloud.google.com/) 建立專案（需要綁信用卡做身分驗證，
   但只要用量在 Always Free 額度內就不會被扣款）
2. 建立一台 Compute Engine VM：機型選 `e2-micro`，區域選 `us-west1`、`us-central1`
   或 `us-east1` 其中之一（Always Free 只涵蓋這三個區域），開機磁碟選 Ubuntu，
   硬碟大小 30GB 以內
3. VM 建立後，用 Console 上的「SSH」按鈕直接連進去（免另外裝 SSH 用戶端），依序執行：
   ```bash
   sudo apt-get update && sudo apt-get install -y docker.io git
   git clone https://github.com/yttttttingg-debug/claude.git
   cd claude
   cp .env.example .env
   nano .env   # 貼上你的 GEMINI_API_KEY 及其他你要啟用的 token
   sudo docker build -t always-on-ai .
   sudo docker run -d --restart unless-stopped --env-file .env -p 3000:3000 --name always-on-ai always-on-ai
   ```
   `--restart unless-stopped` 確保 VM 重開機後服務會自動跟著啟動。
4. 如果有用到 LINE（需要對外網址接 webhook），到 VPC 網路的防火牆規則允許
   TCP:3000 對外，並用 VM 的外部 IP（`http://VM外部IP:3000/webhooks/line`）設定回
   LINE 後台；正式使用建議另外加一層網域＋HTTPS（可用 Caddy/Nginx + Let's Encrypt）
5. 之後要更新程式碼：`git pull && sudo docker build -t always-on-ai . && sudo docker restart always-on-ai`

### 其他選項

- **Fly.io**：部署較省事（`fly launch` 自動讀 `Dockerfile`），也有免費額度，但需要
  綁信用卡，且免費額度政策會變動，不像 Google Always Free 那樣有長期保證。
- **一般 VPS**（自己的主機）：`docker build -t always-on-ai . && docker run -d --env-file .env -p 3000:3000 always-on-ai`
- **Railway / Render 等 PaaS**：直接連 GitHub repo，讀取 `Dockerfile` 部署即可；
  免費方案通常有「閒置自動休眠」限制，不適合這個需要常駐的服務。

這些帳號申請、VM 建立、SSH 操作都需要你在 Google Cloud 主控台上親自完成
（我無法代為建立雲端帳號）。

## 排程任務

`src/scheduler.ts` 目前內建三個範例任務，時間都可透過環境變數調整：

- `DAILY_REPORT_CRON`（預設每天 09:00）：請 Gemini 產生簡短每日提醒
- `RANDOM_TASK_CRON`（預設每 6 小時）：隨機挑一個主題請 Gemini 產生內容
- `MONITOR_CRON`（設定 `MONITOR_URL` 後啟用，預設每 30 分鐘）：對指定網址做健康檢查，異常時發送警報

輸出會送到 `REPORT_TELEGRAM_CHAT_ID` / `REPORT_DISCORD_CHANNEL_ID` /
`REPORT_LINE_USER_ID` 中你有設定的對象。要新增自訂任務，直接在
`src/scheduler.ts` 裡加一個 `cron.schedule(...)` 呼叫即可。

## YouTube 頻道自動化

這個功能完全跑在雲端服務裡，**不需要你的電腦開機**，也不需要操控電腦畫面 — 全部
透過官方 YouTube API 完成。整條產線：

1. `src/youtube/script.ts`：用 Gemini 想一個主題並寫出短影片腳本（JSON：標題、描述、
   標籤、5-8 段口白文字）
2. `src/youtube/tts.ts`：用微軟 Edge 的免費線上朗讀服務（`msedge-tts`，不用 API Key）
   把每段口白轉成語音
3. `src/youtube/slides.ts`：用 `sharp` 把每段文字畫成投影片圖片
4. `src/youtube/video.ts`：用 `ffmpeg` 把投影片圖片配上語音，接成一支 MP4
5. `src/youtube/upload.ts`：用官方 YouTube Data API v3 上傳影片
6. `src/youtube/comments.ts`：定期抓取新留言，用 Gemini 生成回覆並自動回覆

### 安全預設：新影片預設「不公開」

`YOUTUBE_UPLOAD_PRIVACY_STATUS` 預設是 `private`。也就是說 AI 自動產生、上傳的影片
**不會自動公開**，你可以先在 YouTube Studio 檢查內容 OK 再手動切成公開。想要全自動
公開發布的話，把這個環境變數改成 `public`（風險自負：內容品質、著作權、事實正確性
都要你自己承擔）。

### 設定步驟

1. 到 [Google Cloud Console](https://console.cloud.google.com/) 建立一個專案，啟用
   「YouTube Data API v3」
2. 建立 OAuth 用戶端 ID，應用程式類型選 **Desktop app**，把 Client ID / Client Secret
   填進 `.env` 的 `YOUTUBE_CLIENT_ID` / `YOUTUBE_CLIENT_SECRET`
3. 執行一次性授權腳本，用你要發布影片的那個 YouTube 帳號登入，取得 `YOUTUBE_REFRESH_TOKEN`
   — 有兩種做法，挑一種：

   **做法 A：在自己的電腦上跑**（前提是本機有裝 Node.js）
   ```bash
   npm run youtube:auth
   ```
   完成後把印出來的 `YOUTUBE_REFRESH_TOKEN` 貼進 `.env`

   **做法 B：純雲端，全部在 Compute Engine VM 上做**（不需要本機裝任何東西，
   只需要瀏覽器；如果本機環境一直卡關，建議走這條）
   1. 先照下面「部署」章節把 e2-micro VM 建好，用 Console 的「SSH」按鈕連進去
   2. 記下這台 VM 的**外部 IP**（VM 列表頁面看得到）
   3. 到 Google Cloud Console > API 和服務 > 憑證，另外新增一個 OAuth 用戶端 ID，
      這次類型選 **Web application**（不是 Desktop app，因為固定 IP 不是 loopback
      位址），「授權的重新導向 URI」填 `http://VM外部IP:8080/oauth2callback`，
      建立後一樣拿到一組新的 Client ID / Secret，更新到 VM 上 `.env` 的
      `YOUTUBE_CLIENT_ID` / `YOUTUBE_CLIENT_SECRET`
   4. 到 VPC 網路 > 防火牆規則，暫時開放 tcp:8080 對外（來源 IP 範圍可先設
      `0.0.0.0/0`，等下方步驟做完記得刪掉或收回這條規則）
   5. 在 VM 的 SSH 視窗裡（此時已經 `git clone` 好專案、`npm install` 完成、
      `.env` 也用 `nano .env` 貼好其他設定），執行：
      ```bash
      YOUTUBE_AUTH_REDIRECT_URI=http://VM外部IP:8080/oauth2callback npm run youtube:auth
      ```
   6. 把印出來的網址複製到你自己電腦的瀏覽器打開，用要發布影片的 YouTube 帳號登入、
      同意授權，瀏覽器會被導到 VM 外部 IP，SSH 視窗裡就會印出 `YOUTUBE_REFRESH_TOKEN`
   7. 把它加進 VM 上的 `.env`，然後記得回防火牆規則把 tcp:8080 關掉（收尾，避免
      對外暴露不必要的連接埠）
4. 部署到雲端主機時，把這三個環境變數也設定進去（如果走做法 B，多半已經在 VM 上了）

### 部署後先驗證一次

```bash
npm run youtube:smoke-test
```

這會實際呼叫免費 TTS 服務、產生投影片、用 ffmpeg 合成一支測試影片（不會上傳），
確認你的部署環境可以完整跑完整條產線。

**已知限制**：`msedge-tts` 是非官方、逆向工程微軟 Edge 朗讀功能的免費服務，某些雲端
主機的資料中心 IP 可能會被微軟該服務判定拒絕連線（回傳 403）。程式已經內建重試，
但如果你部署的主機持續失敗，代表那個 IP range 被擋了，換一個雲端供應商，或改接
有免費額度的正式 TTS 服務（例如 Google Cloud Text-to-Speech、Azure Speech）通常就能解決。

### 手動觸發

除了排程自動產生，你也可以直接在聊天室下指令立刻生成一支：

- Telegram：`/newvideo 主題`（不寫主題就讓 AI 自己想）
- Discord：`!newvideo 主題`

### 觸發時機

- `YOUTUBE_CHANNEL_TASK_CRON`（預設每天 10:00）：跑完整條產線，產生並上傳一支新影片
- `YOUTUBE_COMMENT_REPLY_CRON`（預設每小時 15 分）：檢查頻道近期留言，回覆還沒有人回過的留言

蝦皮賣場管理 / 即時聊天操控電腦這兩塊目前**還沒實作** — 蝦皮沒有開放給一般賣家的
公開 API，只能靠螢幕/瀏覽器自動化達成，而且「即時聊天操控電腦」需要另外寫一個裝在
你電腦上、開機時執行的本機代理程式（跟這個雲端服務是分開的東西）。之後如果要做，
我們再另外討論規劃。
