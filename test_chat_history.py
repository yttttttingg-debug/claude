"""Tests for ChatHistory."""

import json
import os
import tempfile

from chat_history import ChatHistory


def test_add_and_messages():
    h = ChatHistory()
    h.add("user", "Hello")
    h.add("assistant", "Hi there!")
    assert len(h) == 2
    msgs = h.messages()
    assert msgs[0] == {"role": "user", "content": "Hello"}
    assert msgs[1] == {"role": "assistant", "content": "Hi there!"}


def test_max_messages_evicts_oldest_non_system():
    h = ChatHistory(max_messages=3)
    h.add("system", "You are a helpful assistant.")
    h.add("user", "msg1")
    h.add("user", "msg2")
    h.add("user", "msg3")  # triggers eviction of "msg1"
    assert len(h) == 3
    contents = [m["content"] for m in h.messages()]
    assert "msg1" not in contents
    assert "You are a helpful assistant." in contents


def test_export_and_load_roundtrip():
    h = ChatHistory(max_messages=50)
    h.add("user", "Hello")
    h.add("assistant", "World")

    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f:
        path = f.name
    try:
        h.export_to_json(path)

        with open(path) as f:
            raw = json.load(f)
        assert raw["max_messages"] == 50
        assert len(raw["messages"]) == 2

        h2 = ChatHistory()
        h2.load_from_json(path)
        assert len(h2) == 2
        assert h2.max_messages == 50
        assert h2.messages() == h.messages()
    finally:
        os.unlink(path)


def test_token_count_heuristic():
    h = ChatHistory()
    h.add("user", "a" * 40)  # 40 chars -> ~10 tokens
    assert h.token_count() == 10


def test_clear():
    h = ChatHistory()
    h.add("user", "hi")
    h.clear()
    assert len(h) == 0


if __name__ == "__main__":
    test_add_and_messages()
    test_max_messages_evicts_oldest_non_system()
    test_export_and_load_roundtrip()
    test_token_count_heuristic()
    test_clear()
    print("All tests passed.")
