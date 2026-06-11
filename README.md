# Hermes AI

Hermes AI 聊天助理，支援兩種後端：
- **Gemini**（預設）：使用 Google Gemini API 驅動，套用 Hermes 人格
- **Ollama**：使用本地 Hermes3 模型，完全離線

## 快速開始

### 1. 安裝依賴

```bash
bash setup.sh
```

或手動安裝：

```bash
pip install -r requirements.txt
```

### 2. 設定 Gemini API 金鑰

```bash
export GEMINI_API_KEY="你的金鑰"
```

> 取得金鑰：https://aistudio.google.com/apikey

### 3. 啟動

```bash
# 使用 Gemini（預設）
python hermes.py

# 使用本地 Ollama Hermes3
python hermes.py --backend ollama

# 指定不同的 Gemini 模型
python hermes.py --gemini-model gemini-2.0-flash
```

## 指令

| 指令 | 說明 |
|------|------|
| `/reset` | 清除目前對話 |
| `/quit` | 離開 |

## 選項

```
--backend   gemini 或 ollama（預設：gemini）
--key       Gemini API 金鑰
--gemini-model  Gemini 模型（預設：gemini-2.0-flash）
--ollama-model  Ollama 模型（預設：hermes3）
```
