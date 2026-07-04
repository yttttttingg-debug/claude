"""Simple chat history manager for AI conversations."""

import json
from datetime import datetime
from typing import Literal


Role = Literal["user", "assistant", "system"]


class ChatHistory:
    """Stores and manages a conversation's message history."""

    def __init__(self, max_messages: int = 100):
        self._messages: list[dict] = []
        self.max_messages = max_messages

    def add(self, role: Role, content: str) -> None:
        """Append a message, evicting the oldest non-system message if over limit."""
        self._messages.append({
            "role": role,
            "content": content,
            "timestamp": datetime.utcnow().isoformat(),
        })
        if len(self._messages) > self.max_messages:
            # Drop oldest non-system message to preserve context
            for i, msg in enumerate(self._messages):
                if msg["role"] != "system":
                    self._messages.pop(i)
                    break

    def messages(self) -> list[dict]:
        """Return messages in API-ready format (role + content only)."""
        return [{"role": m["role"], "content": m["content"]} for m in self._messages]

    def token_count(self) -> int:
        """TODO: Return a real token count using a tokenizer."""
        # Rough heuristic: ~4 chars per token
        total_chars = sum(len(m["content"]) for m in self._messages)
        return total_chars // 4

    def export_to_json(self, path: str) -> None:
        """Serialize full history (with timestamps) to a JSON file."""
        with open(path, "w", encoding="utf-8") as f:
            json.dump({"max_messages": self.max_messages, "messages": self._messages}, f, indent=2)

    def load_from_json(self, path: str) -> None:
        """Load a previously exported history from a JSON file, replacing current state."""
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        self.max_messages = data.get("max_messages", self.max_messages)
        self._messages = data.get("messages", [])

    def clear(self) -> None:
        """Remove all messages."""
        self._messages.clear()

    def __len__(self) -> int:
        return len(self._messages)

    def __repr__(self) -> str:
        return f"ChatHistory({len(self._messages)} messages)"
