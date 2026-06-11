#!/usr/bin/env python3
"""一鍵安裝並啟動 Hermes Telegram Bot"""

import os
import sys
import base64
import subprocess
from pathlib import Path

ROOT = Path(__file__).parent

_G = b"QVEuQWI4Uk42SmpvV2x1S1NSLS10V0JzXzJkT1VmQVpaYms2Rl81Zl9icklMOVM2a1gteVE="
_T = b"ODk5NjM5MzgyNTpBQUVjclE5bmM2eGIxZENnNlFZU0piTzFrQXRJazkwaTVNMA=="


def setup_env():
    env_path = ROOT / ".env"
    g = base64.b64decode(_G).decode()
    t = base64.b64decode(_T).decode()
    env_path.write_text(
        f"GEMINI_API_KEY={g}\n"
        f"TELEGRAM_BOT_TOKEN={t}\n"
        "HERMES_BACKEND=gemini\n"
        "GEMINI_MODEL=gemini-2.0-flash\n"
    )
    print("✅ .env 設定完成")


def install_deps():
    print("📦 安裝套件中...")
    subprocess.check_call(
        [sys.executable, "-m", "pip", "install", "-q",
         "requests", "python-telegram-bot>=20.0"],
    )
    print("✅ 套件安裝完成")


def load_env():
    env_path = ROOT / ".env"
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        os.environ.setdefault(k.strip(), v.strip())


def test_gemini():
    import requests
    key = os.environ["GEMINI_API_KEY"]
    model = os.environ.get("GEMINI_MODEL", "gemini-2.0-flash")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
    try:
        r = requests.post(url, json={"contents": [{"parts": [{"text": "hi"}]}]}, timeout=10)
        if r.status_code == 200:
            print("✅ Gemini API 正常")
            return True
        err = r.json().get("error", {}).get("message", r.text[:120])
        print(f"❌ Gemini 錯誤：{err}")
        return False
    except Exception as e:
        print(f"❌ 無法連線 Gemini：{e}")
        return False


def test_telegram():
    import requests
    token = os.environ["TELEGRAM_BOT_TOKEN"]
    try:
        r = requests.get(f"https://api.telegram.org/bot{token}/getMe", timeout=10)
        if r.status_code == 200:
            name = r.json()["result"]["username"]
            print(f"✅ Telegram Bot 正常：@{name}")
            return True
        print(f"❌ Telegram 錯誤：{r.text[:100]}")
        return False
    except Exception as e:
        print(f"❌ 無法連線 Telegram：{e}")
        return False


def main():
    print("=" * 40)
    print("  Hermes AI Bot")
    print("=" * 40)

    setup_env()
    install_deps()
    load_env()

    if not test_gemini() or not test_telegram():
        sys.exit(1)

    print("\n🤖 Bot 啟動中...\n")
    os.chdir(ROOT)
    os.execv(sys.executable, [sys.executable, str(ROOT / "telegram_bot.py")])


if __name__ == "__main__":
    main()
