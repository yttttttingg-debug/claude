#!/usr/bin/env python3
"""Simple command-line todo list manager."""

import json
import sys
from pathlib import Path

TODO_FILE = Path.home() / ".claude_todos.json"


def load_todos() -> list[dict]:
    if not TODO_FILE.exists():
        return []
    with TODO_FILE.open() as f:
        return json.load(f)


def save_todos(todos: list[dict]) -> None:
    with TODO_FILE.open("w") as f:
        json.dump(todos, f, indent=2)


def add_todo(text: str) -> None:
    todos = load_todos()
    todos.append({"id": len(todos) + 1, "text": text, "done": False})
    save_todos(todos)
    print(f"Added: {text}")


def list_todos() -> None:
    todos = load_todos()
    if not todos:
        print("No todos yet.")
        return
    for todo in todos:
        status = "x" if todo["done"] else " "
        print(f"  [{status}] {todo['id']}. {todo['text']}")


def complete_todo(todo_id: int) -> None:
    todos = load_todos()
    for todo in todos:
        if todo["id"] == todo_id:
            todo["done"] = True
            save_todos(todos)
            print(f"Completed: {todo['text']}")
            return
    print(f"No todo with id {todo_id}.")


def delete_todo(todo_id: int) -> None:
    todos = load_todos()
    updated = [t for t in todos if t["id"] != todo_id]
    if len(updated) == len(todos):
        print(f"No todo with id {todo_id}.")
        return
    save_todos(updated)
    print(f"Deleted todo {todo_id}.")


USAGE = """Usage:
  todo.py add <text>       Add a new todo
  todo.py list             List all todos
  todo.py done <id>        Mark a todo as complete
  todo.py delete <id>      Delete a todo
"""


def main() -> None:
    args = sys.argv[1:]
    if not args:
        print(USAGE)
        return

    command = args[0]
    if command == "add" and len(args) >= 2:
        add_todo(" ".join(args[1:]))
    elif command == "list":
        list_todos()
    elif command == "done" and len(args) == 2:
        complete_todo(int(args[1]))
    elif command == "delete" and len(args) == 2:
        delete_todo(int(args[1]))
    else:
        print(USAGE)


if __name__ == "__main__":
    main()
