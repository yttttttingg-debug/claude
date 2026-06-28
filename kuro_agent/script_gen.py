import google.generativeai as genai
from config import GEMINI_API_KEY, KURO_SYSTEM_PROMPT

genai.configure(api_key=GEMINI_API_KEY)


def generate_script(topic: str = None, entry_number: int = 1) -> dict:
    model = genai.GenerativeModel("gemini-1.5-flash")

    topic_line = f"今天觀察的主題：{topic}" if topic else "請自行選擇一個人類常見的矛盾行為作為主題"

    script_prompt = f"""
{KURO_SYSTEM_PROMPT}

請寫一篇 KURO 的觀察日誌，編號 #{entry_number}。
{topic_line}

格式（300-400字，約1-3分鐘朗讀）：
- 開場：「觀察日誌，第 {entry_number} 號。」
- 描述今天觀察到的人類矛盾現象（具體、有畫面感）
- KURO 嘗試用邏輯分析但失敗的過程
- 結語：「無法理解。記錄完畢。」

只輸出腳本內容，不需要任何說明或標注。
"""

    script_resp = model.generate_content(script_prompt)
    script = script_resp.text.strip()

    meta_prompt = f"""
根據以下 KURO 觀察日誌，生成 YouTube 發布資訊。
格式嚴格如下（每項各佔一行）：

標題：[吸引人的標題，20-35字，可含 emoji]
描述：[頻道簡介+本集主題，100字以內]
標籤：[標籤1,標籤2,標籤3,標籤4,標籤5]

日誌內容：
{script}
"""

    meta_resp = model.generate_content(meta_prompt)
    title, description, tags = "", "", []

    for line in meta_resp.text.strip().splitlines():
        if line.startswith("標題："):
            title = line.removeprefix("標題：").strip()
        elif line.startswith("描述："):
            description = line.removeprefix("描述：").strip()
        elif line.startswith("標籤："):
            tags = [t.strip() for t in line.removeprefix("標籤：").split(",")]

    return {
        "entry_number": entry_number,
        "script": script,
        "title": title,
        "description": description,
        "tags": tags,
    }
