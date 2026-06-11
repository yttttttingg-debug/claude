#!/usr/bin/env python3
"""Hermes AI Telegram Bot"""

import os
import sys
import logging
from pathlib import Path
from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes

# Load .env
def _load_dotenv():
    env_path = Path(__file__).parent / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip())

_load_dotenv()

from hermes import HermesGemini, HermesOllama

logging.basicConfig(
    format="%(asctime)s [%(levelname)s] %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)

# 每個用戶一個獨立的 Hermes 實例
_user_sessions: dict[int, HermesGemini | HermesOllama] = {}

BACKEND = os.environ.get("HERMES_BACKEND", "gemini")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.0-flash")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "hermes3")


def get_session(user_id: int):
    if user_id not in _user_sessions:
        if BACKEND == "gemini":
            _user_sessions[user_id] = HermesGemini(api_key=GEMINI_API_KEY, model=GEMINI_MODEL)
        else:
            _user_sessions[user_id] = HermesOllama(model=OLLAMA_MODEL)
    return _user_sessions[user_id]


async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    get_session(user.id)
    await update.message.reply_text(
        f"嗨 {user.first_name}！我是 Hermes AI 🤖\n"
        f"後端：{'Gemini (' + GEMINI_MODEL + ')' if BACKEND == 'gemini' else 'Ollama (' + OLLAMA_MODEL + ')'}\n\n"
        "直接傳訊息給我，我會回覆你。\n"
        "/reset — 清除對話記憶\n"
        "/help — 顯示說明"
    )


async def cmd_reset(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    if user_id in _user_sessions:
        _user_sessions[user_id].reset()
    await update.message.reply_text("✅ 對話已清除，重新開始。")


async def cmd_help(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "Hermes AI 指令：\n\n"
        "/start — 開始對話\n"
        "/reset — 清除對話記憶\n"
        "/help — 顯示此說明\n\n"
        "直接輸入文字即可對話。"
    )


async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    text = update.message.text

    await context.bot.send_chat_action(chat_id=update.effective_chat.id, action="typing")

    hermes = get_session(user_id)
    try:
        reply = hermes.send(text)
        # Telegram 訊息上限 4096 字元
        for i in range(0, len(reply), 4096):
            await update.message.reply_text(reply[i:i+4096])
    except Exception as e:
        logger.error("Error: %s", e)
        await update.message.reply_text(f"⚠️ 發生錯誤：{e}")


def main():
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    if not token:
        print("錯誤：請在 .env 設定 TELEGRAM_BOT_TOKEN")
        sys.exit(1)
    if BACKEND == "gemini" and not GEMINI_API_KEY:
        print("錯誤：請在 .env 設定 GEMINI_API_KEY")
        sys.exit(1)

    app = Application.builder().token(token).build()
    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("reset", cmd_reset))
    app.add_handler(CommandHandler("help", cmd_help))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

    backend_info = f"Gemini ({GEMINI_MODEL})" if BACKEND == "gemini" else f"Ollama ({OLLAMA_MODEL})"
    logger.info("Hermes Bot 啟動，後端：%s", backend_info)
    app.run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    main()
