#!/bin/bash

# Kuro Bot Fix Script
# Fixes OpenClaw + Claude API configuration for @Bugumimibot
#
# Usage:
#   ANTHROPIC_API_KEY=sk-ant-... TELEGRAM_BOT_TOKEN=xxx bash fix_kuro.sh

OPENCLAW_DIR="$HOME/.openclaw"
ENV_FILE="$OPENCLAW_DIR/.env"
CONFIG_FILE="$OPENCLAW_DIR/openclaw.json"

# Allow passing via env or editing here
ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-YOUR_ANTHROPIC_API_KEY_HERE}"
TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-YOUR_TELEGRAM_BOT_TOKEN_HERE}"

if [[ "$ANTHROPIC_API_KEY" == "YOUR_ANTHROPIC_API_KEY_HERE" ]]; then
  echo "❌ Please set ANTHROPIC_API_KEY before running this script."
  echo "   Example: ANTHROPIC_API_KEY=sk-ant-... bash fix_kuro.sh"
  exit 1
fi

if [[ "$TELEGRAM_BOT_TOKEN" == "YOUR_TELEGRAM_BOT_TOKEN_HERE" ]]; then
  echo "❌ Please set TELEGRAM_BOT_TOKEN before running this script."
  echo "   Example: TELEGRAM_BOT_TOKEN=xxxx bash fix_kuro.sh"
  exit 1
fi

mkdir -p "$OPENCLAW_DIR"

# Write API key to .env
cat > "$ENV_FILE" << EOF
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
EOF

echo "✅ .env written"

# Write openclaw.json config
cat > "$CONFIG_FILE" << EOF
{
  "agent": {
    "model": "anthropic/claude-sonnet-4-6"
  },
  "channels": {
    "telegram": {
      "token": "${TELEGRAM_BOT_TOKEN}"
    }
  }
}
EOF

echo "✅ openclaw.json written"

# Restart OpenClaw gateway
echo "🔄 Restarting OpenClaw..."

if command -v openclaw &> /dev/null; then
  openclaw gateway restart
  echo "✅ OpenClaw restarted"
else
  echo "⚠️  openclaw command not found. Please restart manually:"
  echo "   openclaw gateway restart"
fi

echo ""
echo "✅ Done! Try messaging @Bugumimibot on Telegram now."
