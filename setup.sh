#!/bin/bash
# Hermes AI 設定腳本
# 安裝 Python 依賴，並選擇性安裝 Ollama + Hermes 模型

set -e

echo "=== Hermes AI 設定 ==="
echo ""

# 安裝 Python 依賴
echo "[1/3] 安裝 Python 套件..."
pip install -r requirements.txt
echo "完成！"

# 詢問是否安裝 Ollama
echo ""
read -p "[2/3] 是否安裝 Ollama（本地模型支援）？[y/N] " install_ollama

if [[ "$install_ollama" =~ ^[Yy]$ ]]; then
    if command -v ollama &>/dev/null; then
        echo "Ollama 已安裝，跳過。"
    else
        echo "安裝 Ollama..."
        curl -fsSL https://ollama.com/install.sh | sh
        echo "Ollama 安裝完成！"
    fi

    echo ""
    read -p "[3/3] 是否下載 Hermes3 模型（約 4.7GB）？[y/N] " pull_hermes

    if [[ "$pull_hermes" =~ ^[Yy]$ ]]; then
        echo "下載 Hermes3 模型..."
        ollama pull hermes3
        echo "Hermes3 下載完成！"
    fi
else
    echo "[3/3] 跳過 Ollama 安裝。"
fi

echo ""
echo "=== 設定完成！==="
echo ""
echo "使用方式："
echo "  # 使用 Gemini 後端（預設）"
echo "  export GEMINI_API_KEY='你的金鑰'"
echo "  python hermes.py"
echo ""
echo "  # 使用本地 Ollama Hermes 後端"
echo "  python hermes.py --backend ollama"
echo ""
echo "  # 指定 Gemini 金鑰（不用環境變數）"
echo "  python hermes.py --key 你的金鑰"
