#!/usr/bin/env python3
"""Hermes AI - 使用 Gemini API 驅動，具備 Hermes 人格的聊天助理"""

import os
import sys
import json
import requests
from typing import Optional
from pathlib import Path


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

HERMES_SYSTEM_PROMPT = (
    "You are Hermes, a helpful, harmless, and honest AI assistant developed by NousResearch. "
    "You are highly capable, thoughtful, and direct in your responses. "
    "You have strong analytical and reasoning capabilities, and you always aim to be genuinely helpful. "
    "You communicate in the user's language — if they write in Chinese, respond in Chinese; if in English, in English. "
    "You are knowledgeable across many domains including science, coding, math, writing, and general knowledge."
)

GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"


class HermesGemini:
    """Hermes AI using Google Gemini REST API."""

    def __init__(self, api_key: str, model: str = "gemini-2.0-flash"):
        self.api_key = api_key
        self.model = model
        self.history: list[dict] = []

    def send(self, message: str) -> str:
        self.history.append({"role": "user", "parts": [{"text": message}]})
        payload = {
            "system_instruction": {"parts": [{"text": HERMES_SYSTEM_PROMPT}]},
            "contents": self.history,
            "generationConfig": {"temperature": 0.7},
        }
        url = f"{GEMINI_API_BASE}/{self.model}:generateContent?key={self.api_key}"
        resp = requests.post(url, json=payload, timeout=60)
        if resp.status_code == 429:
            data = resp.json()
            msg = data.get("error", {}).get("message", "配額已耗盡")
            raise RuntimeError(f"API 配額問題：{msg}")
        resp.raise_for_status()
        reply = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
        self.history.append({"role": "model", "parts": [{"text": reply}]})
        return reply

    def reset(self):
        self.history = []


class HermesOllama:
    """Hermes AI using local Ollama."""

    def __init__(self, model: str = "hermes3", base_url: str = "http://localhost:11434"):
        self.model = model
        self.base_url = base_url
        self.history = [{"role": "system", "content": HERMES_SYSTEM_PROMPT}]

    def send(self, message: str) -> str:
        self.history.append({"role": "user", "content": message})
        resp = requests.post(
            f"{self.base_url}/api/chat",
            json={"model": self.model, "messages": self.history, "stream": False},
            timeout=120,
        )
        resp.raise_for_status()
        reply = resp.json()["message"]["content"]
        self.history.append({"role": "assistant", "content": reply})
        return reply

    def reset(self):
        self.history = [{"role": "system", "content": HERMES_SYSTEM_PROMPT}]


def build_backend(backend: str, api_key: Optional[str], gemini_model: str, ollama_model: str):
    if backend == "gemini":
        if not api_key:
            print("錯誤：請在 .env 檔設定 GEMINI_API_KEY，或使用 --key 參數")
            sys.exit(1)
        return HermesGemini(api_key=api_key, model=gemini_model)
    elif backend == "ollama":
        return HermesOllama(model=ollama_model)
    else:
        print(f"未知的後端：{backend}。請選擇 gemini 或 ollama")
        sys.exit(1)


def run_interactive(hermes):
    backend_name = type(hermes).__name__
    print(f"\n{'='*50}")
    print(f"  Hermes AI  [{backend_name}]")
    print(f"{'='*50}")
    print("輸入訊息開始對話。/reset 清除對話，/quit 離開。\n")

    while True:
        try:
            user_input = input("你: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\n再見！")
            break

        if not user_input:
            continue
        if user_input.lower() in ("/quit", "/exit", "/bye"):
            print("再見！")
            break
        if user_input.lower() == "/reset":
            hermes.reset()
            print("[對話已清除]\n")
            continue

        try:
            reply = hermes.send(user_input)
            print(f"\nHermes: {reply}\n")
        except Exception as e:
            print(f"[錯誤] {e}\n")


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Hermes AI 聊天助理")
    parser.add_argument("--backend", choices=["gemini", "ollama"], default="gemini")
    parser.add_argument("--key", help="Gemini API 金鑰")
    parser.add_argument("--gemini-model", default="gemini-2.0-flash")
    parser.add_argument("--ollama-model", default="hermes3")
    args = parser.parse_args()

    api_key = args.key or os.environ.get("GEMINI_API_KEY")
    hermes = build_backend(args.backend, api_key, args.gemini_model, args.ollama_model)
    run_interactive(hermes)


if __name__ == "__main__":
    main()
