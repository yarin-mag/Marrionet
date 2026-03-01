# Marionette

**Real-time monitoring for Claude Code sessions**

A dashboard that captures every conversation, token count, and tool call across all your Claude Code agents — automatically, with no changes to your workflow.

---

## Quick Start (for users)

**macOS / Linux**
```bash
curl -fsSL https://raw.githubusercontent.com/OWNER/REPO/main/scripts/install.sh | bash
```

**Windows** (PowerShell)
```powershell
irm https://raw.githubusercontent.com/OWNER/REPO/main/scripts/install.ps1 | iex
```

This downloads the latest release, installs it to `/usr/local/lib/marionette`, registers the MCP server with Claude Code, and configures auto-start.

After installing, open **http://localhost:8787**.

---

## Development Setup

### Prerequisites
- Node.js 18+
- pnpm 9+

```bash
git clone https://github.com/OWNER/REPO.git
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

## Releasing

### How it works

Every time you push a version tag (e.g. `v1.2.3`), GitHub Actions runs
**one workflow** (`.github/workflows/release.yml`) that triggers **4 parallel jobs** —
one per platform:

| Job | Runner | Output |
|---|---|---|
| `macos-arm64` | `macos-latest` (Apple Silicon) | `marionette-macos-arm64.tar.gz` |
| `macos-x64` | `macos-13` (Intel) | `marionette-macos-x64.tar.gz` |
| `linux-x64` | `ubuntu-latest` | `marionette-linux-x64.tar.gz` |
| `windows-x64` | `windows-latest` | `marionette-windows-x64.zip` |

All 4 artifacts are attached to the same GitHub Release automatically.
If one platform's build fails, the others finish anyway (`fail-fast: false`).

**There is no per-platform workflow** — it's always all 4 or nothing.
This is intentional: every release is a complete, consistent set of artifacts.

---

### Scenario 1 — Regular release (bug fix or feature, any package)

This covers the most common case: you changed something in `apps/web`, `packages/mcp-server`,
`packages/file-watcher`, or `apps/server`, and you want to ship it.

```bash
# 1. Make sure you're on main and everything is committed
git checkout main
git pull

# 2. Bump the version in the root package.json
#    Use patch (0.1.x) for bug fixes, minor (0.x.0) for features, major (x.0.0) for breaking changes
npm version patch   # or minor / major
# This updates package.json AND creates a git commit automatically

# 3. Push the commit + the new tag
git push origin main --follow-tags
```

That's it. GitHub Actions picks up the new tag, runs all 4 builds in parallel (~5–8 min),
and publishes the release with the 4 artifacts + auto-generated release notes.

---

### Scenario 2 — Web dashboard changes only

No special steps — follow Scenario 1. The build script rebuilds the web app regardless
of which package changed. All 4 platform artifacts will contain the updated dashboard.

---

### Scenario 3 — MCP server changes only

Same as Scenario 1. The build script compiles `packages/mcp-server` into `dist/mcp/` inside
the release archive. All platforms get the updated MCP server.

---

### Scenario 4 — Patch only one platform (e.g. a Windows-only bug)

**The standard answer: just push a new patch version.** All 4 platforms rebuild. The fix only
affects runtime behavior on Windows, but all artifacts are released for consistency. Users on
macOS/Linux get the same binary they had, just with the new version number.

If you truly need to replace a single artifact on an *existing* release without bumping the
version (rare edge case — e.g. a bad binary was accidentally uploaded):

```bash
# 1. Build only the affected platform locally (on a Windows machine or CI)
pwsh scripts/build-release.ps1 windows-x64

# 2. Upload and overwrite just that artifact on the existing GitHub Release
gh release upload v1.2.3 marionette-windows-x64.zip --clobber
```

`--clobber` replaces the existing file with the same name. No version bump needed.
Use this sparingly — it creates an inconsistency where the release tag points to code
that doesn't exactly match one of the artifacts.

---

### Scenario 5 — Pre-release / beta

```bash
# Tag with a pre-release suffix
git tag v1.3.0-beta.1
git push origin v1.3.0-beta.1
```

GitHub Actions will build all 4 platforms and attach them to a release marked as **pre-release**
automatically (GitHub detects the `-beta.1` suffix).

---

### Pre-release checklist

Before tagging a release, make sure:

- [ ] `pnpm build` passes with no new TypeScript errors
- [ ] `pnpm lint` is clean
- [ ] The app runs locally: `pnpm dev`, open http://localhost:8787, verify the dashboard loads
- [ ] The MCP tools work: start a Claude Code session, confirm events appear in the dashboard
- [ ] The `scripts/install.sh` `OWNER/REPO` placeholder is updated to the real GitHub repo
- [ ] The `scripts/install.ps1` `$Repo` placeholder is updated to the real GitHub repo

---

### Checking a release build locally

You can run the full release build on your machine before pushing a tag:

```bash
# macOS / Linux
bash scripts/build-release.sh

# Windows
pwsh scripts/build-release.ps1
```

Then test the extracted archive:

```bash
tar -xzf marionette-macos-arm64.tar.gz
cd marionette
./bin/marionette start          # should open http://localhost:8787
./bin/marionette setup          # should update ~/.claude/mcp_settings.json
./bin/marionette mcp            # should start the stdio MCP server
```

---

### Versioning convention

| Change type | Example | Version bump |
|---|---|---|
| Crash fix, data bug | SQLite query fix | `patch` → 0.1.1 |
| New dashboard feature | New calendar view | `minor` → 0.2.0 |
| New MCP tool | `marionette_inspect` | `minor` → 0.2.0 |
| Breaking config change | New required env var | `major` → 1.0.0 |
| Internal refactor, deps | No behavior change | `patch` |

---

## Troubleshooting install

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
