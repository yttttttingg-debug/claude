"""
KURO Telegram 遙控器
部署為 Cloud Run Service，接收 Telegram Webhook 指令
"""
import os
import requests
from flask import Flask, request
import google.auth
import google.auth.transport.requests

app = Flask(__name__)

TELEGRAM_TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]
TELEGRAM_API = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}"
OWNER_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "")

PROJECT_ID = os.environ.get("GOOGLE_CLOUD_PROJECT", "kuro-agent")
REGION = os.environ.get("CLOUD_RUN_REGION", "asia-east1")
JOB_NAME = "kuro-agent"


def send(chat_id: str, text: str):
    requests.post(f"{TELEGRAM_API}/sendMessage", json={
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML",
    })


def trigger_job(topic: str = None) -> bool:
    credentials, _ = google.auth.default(
        scopes=["https://www.googleapis.com/auth/cloud-platform"]
    )
    credentials.refresh(google.auth.transport.requests.Request())

    url = (
        f"https://{REGION}-run.googleapis.com/apis/run.googleapis.com/v1"
        f"/namespaces/{PROJECT_ID}/jobs/{JOB_NAME}:run"
    )
    body = {}
    if topic:
        body = {
            "overrides": {
                "containerOverrides": [{
                    "env": [{"name": "KURO_TOPIC", "value": topic}]
                }]
            }
        }

    resp = requests.post(url, headers={
        "Authorization": f"Bearer {credentials.token}",
        "Content-Type": "application/json",
    }, json=body)
    return resp.status_code == 200


@app.route("/webhook", methods=["POST"])
def webhook():
    data = request.json
    if "message" not in data:
        return "ok"

    chat_id = str(data["message"]["chat"]["id"])
    text = data["message"].get("text", "").strip()

    # 只允許主人操作
    if OWNER_CHAT_ID and chat_id != OWNER_CHAT_ID:
        send(chat_id, "你不是我的主人。")
        return "ok"

    if text in ("/run", "發片", "run"):
        send(chat_id, "🎬 KURO 開始錄製新集數⋯⋯\n大約 5-10 分鐘後完成上傳。")
        if not trigger_job():
            send(chat_id, "❌ 啟動失敗，請查看 Cloud Run logs。")

    elif text.startswith("/topic ") or text.startswith("主題 "):
        topic = text.replace("/topic ", "").replace("主題 ", "").strip()
        send(chat_id, f"🎬 KURO 以「{topic}」為主題開始錄製⋯⋯")
        if not trigger_job(topic=topic):
            send(chat_id, "❌ 啟動失敗。")

    elif text in ("/start", "/help", "幫助"):
        send(chat_id,
             "KURO 遙控器 🐱\n\n"
             "<b>發片</b> — 立即錄製上傳新影片\n"
             "<b>主題 [內容]</b> — 指定主題\n"
             "例：主題 人類假日卻不休息\n\n"
             f"你的 Chat ID：<code>{chat_id}</code>")

    return "ok"


@app.route("/", methods=["GET"])
def health():
    return "KURO Bot online"


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port)
