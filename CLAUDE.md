# CLAUDE.md

This file documents the repository for AI assistants working in this codebase.

## Repository Overview

**Name:** claude  
**Topic:** AI  
**Status:** Early-stage / greenfield — only a README exists so far.

This is a fresh repository. No source code, tests, build tooling, or dependencies have been committed yet. Update this file as the project takes shape.

## Repository Structure

```
/
├── README.md      # Project title and topic ("claude / ai")
└── CLAUDE.md      # This file
```

## Development Branch

Active development happens on `claude/claude-md-docs-pdql7q`. All changes must be committed and pushed to that branch. Never push directly to `main` without an explicit instruction.

## Git Conventions

- Branch naming: `claude/<short-description>` for AI-assistant branches.
- Commit messages: imperative mood, present tense, concise first line (≤72 chars). No AI model names in commit messages or PR bodies.
- Always open a **draft PR** after pushing a new branch; do not merge without explicit user approval.
- Force-push is forbidden unless the user explicitly requests it.

## Coding Conventions (to be filled in as code is added)

These defaults apply until project-specific conventions are established:

- **Language:** TBD — establish in this file when the first source files are committed.
- **Formatting:** follow the formatter/linter already configured for the chosen language; if none exists, defer to the community standard (e.g., Prettier for JS/TS, Black for Python, gofmt for Go).
- **Comments:** write comments only when the *why* is non-obvious. No explanatory narrative comments, no TODO lists embedded in code.
- **Error handling:** validate at system boundaries (user input, external APIs) only; trust internal invariants.
- **Tests:** add tests for new behaviour; do not add tests for unchanged code unless explicitly asked.

## AI-Assistant Guidelines

- Read this file at the start of every session before making changes.
- When the codebase grows, update the "Repository Structure" tree and any relevant sections here.
- Do not add features, refactor, or introduce abstractions beyond what the current task requires.
- Do not introduce security vulnerabilities (XSS, SQL injection, command injection, etc.). Fix any you notice immediately.
- Prefer editing existing files over creating new ones.
- Never commit `.env` files, credentials, or secrets.
- After every push, verify a draft PR exists for the branch.
