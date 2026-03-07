#!/usr/bin/env bash
# Usage: bash scripts/build-release.sh [PLATFORM]
# PLATFORM defaults to "$(uname -s | tr '[:upper:]' '[:lower:]')-$(uname -m)"
# Examples: macos-arm64  macos-x64  linux-x64  windows-x64
set -euo pipefail

PLATFORM="${1:-$(uname -s | tr '[:upper:]' '[:lower:]')-$(uname -m)}"
# Normalise arch names
PLATFORM="${PLATFORM/x86_64/x64}"
PLATFORM="${PLATFORM/aarch64/arm64}"
PLATFORM="${PLATFORM/darwin/macos}"

RELEASE_DIR="release/marionette"
ARCHIVE="marionette-${PLATFORM}.tar.gz"

echo "==> Building Marionette release for platform: ${PLATFORM}"

# ── 1. Build all TypeScript packages ─────────────────────────────────────────
echo "==> Building TypeScript packages..."
pnpm --filter @marionette/shared run build
pnpm --filter @marionette/file-watcher run build
pnpm --filter @marionette/mcp-server run build
pnpm --filter @marionette/hooks run build
pnpm --filter @marionette/api-proxy run build
pnpm --filter marionette-server run build

# ── 2. Build React web app ────────────────────────────────────────────────────
echo "==> Building web app..."
pnpm --filter marionette-web run build

# ── 3. Assemble release directory ─────────────────────────────────────────────
echo "==> Assembling release directory..."
rm -rf release
mkdir -p "${RELEASE_DIR}/bin" \
         "${RELEASE_DIR}/db" \
         "${RELEASE_DIR}/dist/watcher" \
         "${RELEASE_DIR}/dist/mcp" \
         "${RELEASE_DIR}/dist/shared" \
         "${RELEASE_DIR}/dist/hooks" \
         "${RELEASE_DIR}/dist/proxy" \
         "${RELEASE_DIR}/web"

# Server + CLI compiled JS
cp -r apps/server/dist/.    "${RELEASE_DIR}/dist/"

# File-watcher compiled JS
cp -r packages/file-watcher/dist/. "${RELEASE_DIR}/dist/watcher/"

# MCP server compiled JS
cp -r packages/mcp-server/dist/.   "${RELEASE_DIR}/dist/mcp/"

# Shared types (needed by mcp-server at runtime via package resolution)
cp -r packages/shared/dist/.       "${RELEASE_DIR}/dist/shared/"

# Hooks (cross-platform Node.js — works on macOS/Linux/Windows without bash)
cp -r packages/hooks/dist/.        "${RELEASE_DIR}/dist/hooks/"

# API proxy (intercepts Claude Code → Anthropic requests for token tracking)
cp -r packages/api-proxy/dist/.    "${RELEASE_DIR}/dist/proxy/"

# Built React app
cp -r apps/web/dist/.              "${RELEASE_DIR}/web/"

# Database schema (server reads this at startup to create/migrate tables)
cp db/schema.sql                   "${RELEASE_DIR}/db/schema.sql"

# ── 4. Install production node_modules (flattened, no pnpm/workspaces) ────────
echo "==> Installing production dependencies..."
cat > "${RELEASE_DIR}/package.json" <<'EOF'
{
  "name": "marionette",
  "version": "0.1.0",
  "type": "module",
  "private": true
}
EOF

npm install --prefix "${RELEASE_DIR}" --production --legacy-peer-deps \
  "better-sqlite3@^11" \
  "ws@^8" \
  "cors@^2" \
  "express@^4" \
  "dotenv@^16" \
  "chokidar@^4" \
  "@modelcontextprotocol/sdk@^1"

# Inject @marionette/shared as a local module so MCP server can import it
SHARED_TARGET="${RELEASE_DIR}/node_modules/@marionette/shared"
mkdir -p "${SHARED_TARGET}"
cp -r packages/shared/dist/. "${SHARED_TARGET}/"
# Write a minimal package.json so Node resolves the package
cat > "${SHARED_TARGET}/package.json" <<'EOF'
{
  "name": "@marionette/shared",
  "version": "0.1.0",
  "type": "module",
  "main": "index.js",
  "exports": {
    ".": "./index.js",
    "./ids-node": "./ids-node.js"
  }
}
EOF

# ── 5. Shell wrapper (macOS / Linux) ─────────────────────────────────────────
echo "==> Writing shell wrapper..."
cat > "${RELEASE_DIR}/bin/marionette" <<'WRAPPER'
#!/bin/sh
NODE_MAJOR=$(node -e "console.log(parseInt(process.versions.node))" 2>/dev/null)
if [ "$NODE_MAJOR" != "20" ]; then
  echo "Error: Marionette requires Node.js 20 (you have Node.js ${NODE_MAJOR:-not found})." >&2
  echo "The bundled better-sqlite3 is compiled for Node.js 20." >&2
  echo "Fix:  nvm install 20 && nvm use 20   or   https://nodejs.org/en/download" >&2
  exit 1
fi
# Resolve symlinks so dirname points to the real bin/ directory, not the symlink location
SELF="$0"
while [ -L "$SELF" ]; do SELF="$(readlink "$SELF")"; done
exec node "$(dirname "$SELF")/../dist/cli/index.js" "$@"
WRAPPER
chmod +x "${RELEASE_DIR}/bin/marionette"

# ── 6. Windows batch wrapper ──────────────────────────────────────────────────
cat > "${RELEASE_DIR}/bin/marionette.cmd" <<'WRAPPER'
@echo off
for /f "delims=" %%v in ('node -e "console.log(parseInt(process.versions.node))" 2^>nul') do set NODE_MAJOR=%%v
if not "%NODE_MAJOR%"=="20" (
  echo Error: Marionette requires Node.js 20. You have Node.js %NODE_MAJOR%. 1>&2
  echo The bundled better-sqlite3 is compiled for Node.js 20. 1>&2
  echo Fix: https://nodejs.org/en/download 1>&2
  exit /b 1
)
node "%~dp0..\dist\cli\index.js" %*
WRAPPER

# ── 7. Version file ───────────────────────────────────────────────────────────
git describe --tags --always 2>/dev/null > "${RELEASE_DIR}/VERSION" || echo "dev" > "${RELEASE_DIR}/VERSION"

# ── 8. Archive ────────────────────────────────────────────────────────────────
echo "==> Creating archive: ${ARCHIVE}"
tar -czf "${ARCHIVE}" -C release marionette

echo "==> Done! Archive: ${ARCHIVE}"
echo "    Contents:"
tar -tzf "${ARCHIVE}" | head -30 || true