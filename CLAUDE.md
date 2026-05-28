# CLAUDE.md

This file provides context and conventions for AI assistants (Claude Code and others) working in this repository.

## Repository Overview

**Name:** claude  
**Description:** ai  
**Current state:** Initial project scaffold — one branch (`main`) with a minimal README.

The project is in its earliest stage. There are no source files, build system, or tests yet.

## Repository Structure

```
/
├── README.md       # Project title only ("# claude / ai")
└── CLAUDE.md       # This file
```

Add new structure here as the project grows.

## Development Branch

Active development happens on feature branches. The current task branch is `claude/claude-md-docs-MqG3L`. Always confirm the target branch before pushing.

## Git Workflow

- **Default branch:** `main`
- **Feature branches:** descriptive names like `feature/<short-description>` or task-specific names assigned by the CI environment
- **Commits:** concise present-tense messages describing the change (e.g. `add user authentication endpoint`)
- **PRs:** always open as draft first; include a short summary and test plan in the body
- **Push:** `git push -u origin <branch-name>`

Never push directly to `main` without a pull request.

## Code Conventions (to be filled in as the stack is chosen)

Once a language/framework is selected, document here:
- Language and version
- Formatter and linter commands
- How to run tests
- How to start the dev server
- Environment variable setup (`.env.example`)

## Working in This Repository

Since the codebase is empty, the first meaningful task is to decide and document:

1. **Language / runtime** — Python, TypeScript, Go, etc.
2. **Framework** — FastAPI, Next.js, Express, etc.
3. **Package manager** — pip/uv, npm/pnpm, etc.
4. **Test framework** — pytest, Vitest, etc.

Update this file as soon as those decisions are made.

## Remote Execution Notes

This project runs in an ephemeral cloud container (Claude Code on the web). Any work must be committed and pushed before the session ends — the container is discarded after inactivity. There is no persistent local state between sessions.
