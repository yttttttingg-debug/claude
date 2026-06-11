#!/usr/bin/env python3
"""Hermes AI - 使用 Gemini API 驅動，具備 Hermes 人格的聊天助理"""

import os
import sys
import json
import requests
import google.generativeai as genai
from typing import Optional

HERMES_SYSTEM_PROMPT = """You are Hermes, a helpful, harmless, and honest AI assistant developed by NousResearch.
You are highly capable, thoughtful, and direct in your responses. You provide detailed and accurate information.
You have strong analytical and reasoning capabilities, and you always aim to be genuinely helpful.
You communicate in the user's language — if they write in Chinese, you respond in Chinese; if in English, in English.
You are knowledgeable across many domains including science, coding, math, writing, and general knowledge."""


class HermesGemini:
    """Hermes AI using Google Gemini as the LLM backend."""

    def __init__(self, api_key: str, model_name: str = "gemini-2.0-flash"):
        genai.configure(api_key=api_key)
        self.gemini_model = genai.GenerativeModel(
            model_name=model_name,
            system_instruction=HERMES_SYSTEM_PROMPT,
        )
        self.chat_session = self.gemini_model.start_chat(history=[])
        self.model_name = model_name

    def send(self, message: str) -> str:
        response = self.chat_session.send_message(message)
        return response.text

    def reset(self):
        self.chat_session = self.gemini_model.start_chat(history=[])


class HermesOllama:
    """Hermes AI using local Ollama as the LLM backend."""

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
            print("錯誤：請設定 GEMINI_API_KEY 環境變數或使用 --key 參數")
            sys.exit(1)
        return HermesGemini(api_key=api_key, model_name=gemini_model)
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
    print("輸入訊息開始對話。輸入 /reset 清除對話，/quit 離開。\n")

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
    parser.add_argument(
        "--backend",
        choices=["gemini", "ollama"],
        default="gemini",
        help="選擇後端：gemini（預設）或 ollama（本地）",
    )
    parser.add_argument("--key", help="Gemini API 金鑰（也可設定 GEMINI_API_KEY 環境變數）")
    parser.add_argument(
        "--gemini-model",
        default="gemini-2.0-flash",
        help="Gemini 模型名稱（預設：gemini-2.0-flash）",
    )
    parser.add_argument(
        "--ollama-model",
        default="hermes3",
        help="Ollama 模型名稱（預設：hermes3）",
    )
    args = parser.parse_args()

    api_key = args.key or os.environ.get("GEMINI_API_KEY")
    hermes = build_backend(args.backend, api_key, args.gemini_model, args.ollama_model)
    run_interactive(hermes)


if __name__ == "__main__":
    main()
