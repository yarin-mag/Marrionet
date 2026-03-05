# Contributing to Marionette

Thank you for your interest in contributing! This guide covers everything you need to get the project running locally and submit changes.

---

## Table of Contents

- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Code Style](#code-style)
- [Testing](#testing)
- [Submitting a Pull Request](#submitting-a-pull-request)
- [Reporting Bugs](#reporting-bugs)

---

## Getting Started

### Prerequisites

- **Node.js** 20+
- **pnpm** 9+ (`npm install -g pnpm`)
- A working [Claude Code](https://claude.ai/code) installation (optional — only needed to test the full MCP integration)

### 1. Fork & clone

```bash
git clone https://github.com/<your-username>/Marionette.git
cd Marionette
```

### 2. Install dependencies

```bash
pnpm install
```

> If this fails at the `better-sqlite3` or `esbuild` native build step, see the [troubleshooting section in the README](README.md#troubleshooting-install).

### 3. Start all services in dev mode

```bash
pnpm dev
```

This starts four processes concurrently:

| Service | URL | Package |
|---|---|---|
| Backend (HTTP + WebSocket) | http://localhost:8787 | `apps/server` |
| Frontend (React + Vite HMR) | http://localhost:5173 | `apps/web` |
| API Proxy | http://localhost:8788 | `packages/api-proxy` |
| File Watcher | — | `packages/file-watcher` |

Or start individual services:

```bash
pnpm dev:server    # backend only
pnpm dev:web       # frontend only
pnpm dev:proxy     # api-proxy only
pnpm dev:watcher   # file-watcher only
```

### 4. Database

The SQLite database is created automatically at `db/marionette.db` on first run. To apply migrations manually:

```bash
pnpm --filter marionette-server migrate
```

---

## Project Structure

```
apps/
  server/        Express + SQLite backend — REST API + WebSocket (port 8787)
  web/           React dashboard (Vite, port 5173 in dev)
packages/
  shared/        TypeScript types shared across all packages
  mcp-server/    MCP stdio server — Claude Code connects here to emit events
  file-watcher/  Watches ~/.claude/projects/**/*.jsonl for live session data
  api-proxy/     HTTP proxy that sits between Claude Code and the Anthropic API
  hooks/         Claude Code lifecycle hooks (session-start, stop, error)
scripts/
  install.sh / install.ps1     One-liner installers
  build-release.sh / .ps1      Release archive builders
```

See [apps/web/ARCHITECTURE.md](apps/web/ARCHITECTURE.md) for frontend-specific conventions.

---

## Development Workflow

### Branch naming

```
feat/<short-description>     new feature
fix/<short-description>      bug fix
chore/<short-description>    tooling, deps, refactoring
docs/<short-description>     documentation only
```

### Making changes

1. Create a branch from `master`
2. Make your changes
3. Run the checks below before pushing
4. Open a pull request

---

## Code Style

We use **ESLint** for linting and **Prettier** for formatting.

```bash
pnpm lint          # lint all packages
pnpm format        # format all files in place
pnpm format:check  # check formatting without writing (used in CI)
```

Key conventions:
- TypeScript strict mode — no `any`, no unused variables
- ES modules throughout (`"type": "module"` in all packages)
- Double quotes, 2-space indent, trailing commas (enforced by Prettier)

---

## Testing

```bash
pnpm test          # run all tests across the workspace
```

Run tests for a specific package:

```bash
pnpm --filter @marionette/file-watcher test
pnpm --filter @marionette/hooks test
pnpm --filter marionette-web test
```

Watch mode (re-runs on file changes):

```bash
pnpm --filter @marionette/file-watcher test:watch
```

When adding new functionality, please add tests alongside your code. Test files live in `__tests__/` directories next to the source they cover.

---

## Submitting a Pull Request

1. Make sure all checks pass locally:
   ```bash
   pnpm build
   pnpm lint
   pnpm test
   ```
2. Push your branch and open a PR against `master`
3. Fill out the PR template — describe what changed and why
4. A maintainer will review your PR, leave feedback, and merge when ready

**Keep PRs focused.** One feature or fix per PR makes reviewing easier.

---

## Reporting Bugs

Use [GitHub Issues](https://github.com/yarin-mag/Marionette/issues) and fill out the bug report template. Include:
- OS and Node.js version
- Steps to reproduce
- What you expected vs. what happened
- Relevant log output (check `marionette status` and the terminal where you ran `marionette start`)

---

## Questions?

Open a [GitHub Discussion](https://github.com/yarin-mag/Marionette/discussions) or file an issue.
