#!/usr/bin/env python3
"""一鍵安裝並啟動 Hermes Telegram Bot"""

import os
import sys
import subprocess
from pathlib import Path

ROOT = Path(__file__).parent


def load_env():
    env_path = ROOT / ".env"
    if not env_path.exists():
        print("❌ 找不到 .env 檔，請先建立：")
        print()
        print("  在終端機貼上以下指令：")
        print()
        print("  cat > .env << 'EOF'")
        print("  GEMINI_API_KEY=你的金鑰")
        print("  TELEGRAM_BOT_TOKEN=你的Token")
        print("  HERMES_BACKEND=gemini")
        print("  GEMINI_MODEL=gemini-2.0-flash")
        print("  EOF")
        sys.exit(1)

    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip())


def install_deps():
    print("📦 安裝套件中...")
    subprocess.check_call(
        [sys.executable, "-m", "pip", "install", "-q",
         "requests", "python-telegram-bot>=20.0"],
        stdout=subprocess.DEVNULL,
    )
    print("✅ 套件安裝完成")


def test_gemini():
    import requests
    api_key = os.environ.get("GEMINI_API_KEY", "")
    model = os.environ.get("GEMINI_MODEL", "gemini-2.0-flash")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    try:
        r = requests.post(url, json={"contents": [{"parts": [{"text": "hi"}]}]}, timeout=10)
        if r.status_code == 200:
            print("✅ Gemini API 連線正常")
            return True
        err = r.json().get("error", {}).get("message", r.text[:120])
        print(f"⚠️  Gemini 錯誤：{err}")
        return False
    except Exception as e:
        print(f"⚠️  無法連線 Gemini：{e}")
        return False


def test_telegram():
    import requests
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    try:
        r = requests.get(f"https://api.telegram.org/bot{token}/getMe", timeout=10)
        if r.status_code == 200:
            name = r.json()["result"]["username"]
            print(f"✅ Telegram Bot 連線正常：@{name}")
            return True
        print(f"⚠️  Telegram Token 錯誤：{r.text[:100]}")
        return False
    except Exception as e:
        print(f"⚠️  無法連線 Telegram：{e}")
        return False


def main():
    print("=" * 45)
    print("  Hermes AI Bot 啟動程式")
    print("=" * 45)

    load_env()
    install_deps()

    gemini_ok = test_gemini()
    tg_ok = test_telegram()

    if not tg_ok:
        print("\n❌ Telegram Token 有問題，請確認 .env 裡的 TELEGRAM_BOT_TOKEN。")
        sys.exit(1)

    if not gemini_ok:
        print("\n❌ Gemini API 無法使用，請確認 .env 裡的 GEMINI_API_KEY 與帳號額度。")
        sys.exit(1)

    print("\n🤖 啟動 Hermes Bot...")
    print("（按 Ctrl+C 停止）\n")

    os.chdir(ROOT)
    os.execv(sys.executable, [sys.executable, str(ROOT / "telegram_bot.py")])


if __name__ == "__main__":
    main()
