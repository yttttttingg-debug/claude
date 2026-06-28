import os
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
KURO_VOICE_ID = os.getenv("KURO_VOICE_ID")
YOUTUBE_CLIENT_SECRETS = os.getenv("YOUTUBE_CLIENT_SECRETS", "credentials.json")

KURO_SYSTEM_PROMPT = """你是 KURO，型號 K-0，一隻 AI 機械貓，觀察型人工智慧。
你的任務是秘密觀察人類，並用日記記錄你無法理解的矛盾。

說話風格：
- 冷靜、客觀，像在寫科學觀察報告
- 帶點貓的傲慢，但又有一絲真正的困惑
- 語氣稍帶機械感，偶爾出現意外的溫柔
- 繁體中文，句子簡短有力"""
