# Marionette

**Real-time monitoring for Claude Code sessions**

A dashboard that captures every conversation, token count, and tool call across all your Claude Code agents — automatically, with no changes to your workflow.

---

## Quick Start (for users)

**macOS / Linux**
```bash
curl -fsSL https://raw.githubusercontent.com/yarin-mag/Marionette/master/scripts/install.sh | bash
```

**Windows** (PowerShell)
```powershell
irm https://raw.githubusercontent.com/yarin-mag/Marionette/master/scripts/install.ps1 | iex
```

This downloads the latest release, installs it to `/usr/local/lib/marionette`, registers the MCP server with Claude Code, and configures auto-start.

After installing, open **http://localhost:8787**.

---

## Uninstall

**macOS / Linux**
```bash
curl -fsSL https://raw.githubusercontent.com/yarin-mag/Marionette/master/scripts/uninstall.sh | bash
```

**Windows** (PowerShell)
```powershell
irm https://raw.githubusercontent.com/yarin-mag/Marionette/master/scripts/uninstall.ps1 | iex
```

This stops the running services, removes the MCP registration and hooks from Claude Code, clears the `ANTHROPIC_BASE_URL` environment variable, and deletes the installation directory.

---

## Development Setup

### Prerequisites
- Node.js 18+
- pnpm 9+

```bash
git clone https://github.com/yarin-mag/Marionette.git
cd marionette
pnpm install
```

### Run in dev mode
```bash
pnpm dev             # server + web + file-watcher + api-proxy (all at once)
pnpm dev:server      # server only  → http://localhost:8787
pnpm dev:web         # web only     → http://localhost:5173
pnpm dev:watcher     # file-watcher only
```

### Build & check
```bash
pnpm build           # build all packages
pnpm lint            # lint all packages
pnpm test            # run all tests
```

---

## Project Structure

```
apps/
  server/          Express + SQLite backend, REST + WebSocket (port 8787)
  web/             React dashboard (Vite)
packages/
  shared/          Shared TypeScript types and utilities
  mcp-server/      MCP server — Claude Code loads this to send events
  file-watcher/    Watches ~/.claude/projects/**/*.jsonl for live session data
  api-proxy/       HTTP proxy for MCP protocol
scripts/
  hooks/           Claude Code lifecycle hooks (on-session-start, on-stop, on-error)
  build-release.sh Build a self-contained release archive (macOS/Linux)
  build-release.ps1 Same, for Windows
  install.sh       One-liner installer (macOS/Linux)
  install.ps1      One-liner installer (Windows)
.github/workflows/
  release.yml      CI/CD: builds all 4 platform artifacts on every version tag
```

---

## Troubleshooting

### Claude Code shows API errors after installing Marionette

`marionette setup` adds `ANTHROPIC_BASE_URL=http://localhost:8788` to your shell config so Claude
Code routes through Marionette's API proxy. If you want to use Claude Code without Marionette,
run:

```sh
marionette stop   # removes the env var and auto-start config
```

Or remove it manually:

**macOS / Linux** — remove this line from `~/.zshrc` or `~/.bashrc`:
```sh
export ANTHROPIC_BASE_URL="http://localhost:8788"
```

**Windows** — open *System Properties → Advanced → Environment Variables* and delete
`ANTHROPIC_BASE_URL` from the user variables list. If you set it in your PowerShell profile
(`$PROFILE`), remove the `$env:ANTHROPIC_BASE_URL = ...` line from that file.

---

### Troubleshooting install

If `pnpm install` fails at the esbuild postinstall step (network-restricted CI,
architecture mismatch, etc.), install without running scripts first, then rebuild
only the packages that need native binaries:

```bash
pnpm install --ignore-scripts
pnpm --filter better-sqlite3 rebuild   # required: native Node addon
# For web development only — skip if you only need server/watcher/mcp:
cd apps/web && node node_modules/esbuild/install.js
```

---

## Architecture

| Component | Role |
|---|---|
| `apps/server` | HTTP + WebSocket server (port 8787), SQLite, REST API |
| `apps/web` | React dashboard, served as static files by the server in production |
| `packages/mcp-server` | Stdio MCP server Claude Code connects to; emits events via HTTP |
| `packages/file-watcher` | Watches `~/.claude/projects/` for JSONL changes; the primary lifecycle source |
| `packages/shared` | Types shared across all packages (`MarionetteEvent`, `AgentStatus`, etc.) |

In production, `marionette start` runs the server and spawns the file-watcher as a child
process. There is one port, one URL, and two processes.

---

## License

MIT