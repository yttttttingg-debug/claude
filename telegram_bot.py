#!/usr/bin/env python3
"""Hermes AI Telegram Bot - pure requests, no extra dependencies"""

import os
import sys
import time
import logging
from pathlib import Path

import requests

logging.basicConfig(format="%(asctime)s [%(levelname)s] %(message)s", level=logging.INFO)
log = logging.getLogger(__name__)


def load_env():
    env_path = Path(__file__).parent / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        os.environ.setdefault(k.strip(), v.strip())


load_env()

TG_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
GEMINI_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
TG_API = f"https://api.telegram.org/bot{TG_TOKEN}"
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_KEY}"

SYSTEM_PROMPT = (
    "You are Hermes, a helpful and direct AI assistant. "
    "Reply in the same language the user writes in. "
    "Be concise and genuinely helpful."
)

# chat_id -> conversation history
sessions: dict[int, list[dict]] = {}


def tg(method: str, **kwargs):
    r = requests.post(f"{TG_API}/{method}", json=kwargs, timeout=30)
    return r.json()


def send(chat_id: int, text: str):
    for i in range(0, len(text), 4096):
        tg("sendMessage", chat_id=chat_id, text=text[i:i+4096])


def typing(chat_id: int):
    tg("sendChatAction", chat_id=chat_id, action="typing")


def ask_gemini(chat_id: int, user_msg: str) -> str:
    history = sessions.setdefault(chat_id, [])
    history.append({"role": "user", "parts": [{"text": user_msg}]})
    payload = {
        "system_instruction": {"parts": [{"text": SYSTEM_PROMPT}]},
        "contents": history,
    }
    r = requests.post(GEMINI_URL, json=payload, timeout=60)
    if r.status_code != 200:
        err = r.json().get("error", {}).get("message", r.text[:200])
        return f"⚠️ Gemini 錯誤：{err}"
    reply = r.json()["candidates"][0]["content"]["parts"][0]["text"]
    history.append({"role": "model", "parts": [{"text": reply}]})
    return reply


def handle(update: dict):
    msg = update.get("message") or update.get("edited_message")
    if not msg:
        return
    chat_id = msg["chat"]["id"]
    text = msg.get("text", "")
    if not text:
        return

    if text == "/start":
        sessions.pop(chat_id, None)
        send(chat_id, "嗨！我是 Hermes AI 🤖 直接傳訊息給我就能聊天。\n/reset — 清除對話\n/help — 說明")
        return
    if text == "/reset":
        sessions.pop(chat_id, None)
        send(chat_id, "✅ 對話已清除。")
        return
    if text == "/help":
        send(chat_id, "直接傳訊息就能對話。\n/reset — 清除對話記憶\n/start — 重新開始")
        return
    if text.startswith("/"):
        return

    typing(chat_id)
    reply = ask_gemini(chat_id, text)
    send(chat_id, reply)


def main():
    if not TG_TOKEN:
        print("❌ 缺少 TELEGRAM_BOT_TOKEN")
        sys.exit(1)
    if not GEMINI_KEY:
        print("❌ 缺少 GEMINI_API_KEY")
        sys.exit(1)

    log.info("Hermes Bot 啟動 (model: %s)", GEMINI_MODEL)
    offset = 0
    while True:
        try:
            resp = tg("getUpdates", offset=offset, timeout=30, allowed_updates=["message"])
            if not resp.get("ok"):
                log.warning("getUpdates error: %s", resp)
                time.sleep(3)
                continue
            for update in resp.get("result", []):
                offset = update["update_id"] + 1
                try:
                    handle(update)
                except Exception as e:
                    log.error("handle error: %s", e)
        except Exception as e:
            log.error("polling error: %s", e)
            time.sleep(5)


if __name__ == "__main__":
    main()
