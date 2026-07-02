# claude

一個「不休息」的 AI 服務：一個常駐執行的 Node.js/TypeScript 程式，同時提供

- **多平台聊天機器人**：Telegram、Discord、LINE（各自用環境變數獨立開關，缺哪個 token 就自動跳過該平台）
- **內建排程任務**：每日簡報、隨機任務、網站監控警報（用 `node-cron`，服務只要活著就會持續執行）

底層都是呼叫 Claude API（`@anthropic-ai/sdk`）。

## 快速開始（本機）

```bash
npm install
cp .env.example .env   # 填入 ANTHROPIC_API_KEY，以及你要啟用的平台 token
npm run dev
```

## 環境變數

見 `.env.example`。至少要有 `ANTHROPIC_API_KEY`；`TELEGRAM_BOT_TOKEN` /
`DISCORD_BOT_TOKEN` / `LINE_CHANNEL_ACCESS_TOKEN`+`LINE_CHANNEL_SECRET`
可以只填一個、全部都填、或先都不填（純排程模式）。

- Telegram token：跟 `@BotFather` 申請
- Discord token：Discord Developer Portal > 你的 Application > Bot > Token
- LINE token/secret：LINE Developers Console > Messaging API channel（LINE 是走
  webhook，需要把 `https://你的網域/webhooks/line` 設回 LINE 後台的 Webhook URL）

## 部署（讓它真的「不休息」）

這個對話環境本身是暫時性容器，工作階段結束就會被回收，**無法**用來長期運行服務。
程式碼已經用 `Dockerfile` 容器化，可以部署到任何支援 Docker 的雲端主機，例如：

- **Fly.io**：有小額免費額度可以跑一個小型常駐機器，不會被閒置睡眠，是目前最推薦
  的免費選項（LINE webhook 也需要固定對外網址，Fly.io 會給你）。
- **一般 VPS**（自己的主機）：`docker build -t always-on-ai . && docker run -d --env-file .env -p 3000:3000 always-on-ai`
- **Railway / Render 等 PaaS**：直接連 GitHub repo，讀取 `Dockerfile` 部署即可；
  若使用免費方案要留意「閒置自動休眠」的限制（純 Telegram/Discord 用輪詢就不受
  外部 HTTP 流量影響，但 LINE webhook 需要服務保持可對外回應）。

部署步驟大致是：把這個 repo 接到你選的平台、在該平台後台設定 `.env.example`
裡列出的環境變數、觸發部署。這些帳號申請與環境變數設定需要你在對應平台上親自
完成（我無法代為建立雲端帳號或取得 Bot token）。

## 排程任務

`src/scheduler.ts` 目前內建三個範例任務，時間都可透過環境變數調整：

- `DAILY_REPORT_CRON`（預設每天 09:00）：請 Claude 產生簡短每日提醒
- `RANDOM_TASK_CRON`（預設每 6 小時）：隨機挑一個主題請 Claude 產生內容
- `MONITOR_CRON`（設定 `MONITOR_URL` 後啟用，預設每 30 分鐘）：對指定網址做健康檢查，異常時發送警報

輸出會送到 `REPORT_TELEGRAM_CHAT_ID` / `REPORT_DISCORD_CHANNEL_ID` /
`REPORT_LINE_USER_ID` 中你有設定的對象。要新增自訂任務，直接在
`src/scheduler.ts` 裡加一個 `cron.schedule(...)` 呼叫即可。
