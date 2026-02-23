#!/usr/bin/env bash
#
# Marionette — One-shot setup script
# Works on Windows (Git Bash / MSYS2), macOS, and Linux
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ─── Colors ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

step()  { echo -e "\n${BOLD}${BLUE}▶  $*${NC}"; }
ok()    { echo -e "   ${GREEN}✓${NC}  $*"; }
warn()  { echo -e "   ${YELLOW}⚠${NC}  $*"; }
die()   { echo -e "\n   ${RED}✗  $*${NC}\n"; exit 1; }

# ─── Platform detection ───────────────────────────────────────────────────────
IS_WINDOWS=false
[[ "${OSTYPE:-}" == msys || "${OSTYPE:-}" == cygwin || -n "${WINDIR:-}" ]] && IS_WINDOWS=true

# Convert a unix-style path to a Windows path (C:/...) so Node.js can spawn it
to_win_path() {
  if [[ "$IS_WINDOWS" == true ]] && command -v cygpath &>/dev/null; then
    cygpath -m "$1"   # -m = mixed: forward slashes, Windows drive letter
  else
    echo "$1"
  fi
}

# ─── Banner ───────────────────────────────────────────────────────────────────
echo -e "${CYAN}"
cat << "EOF"
    ___                    __  ____             __
   /   |  ____ ____  ____  / /_/ __ \____ ______/ /_
  / /| | / __ `/ _ \/ __ \/ __/ / / / __ `/ ___/ __ \
 / ___ |/ /_/ /  __/ / / / /_/ /_/ / /_/ (__  ) / / /
/_/  |_|\__, /\___/_/ /_/\__/_____/\__,_/____/_/ /_/
        /____/
EOF
echo -e "${NC}${BOLD}  Marionette — One-shot Setup${NC}"
echo ""

# ─── 1. Prerequisites ─────────────────────────────────────────────────────────
step "Checking prerequisites"

command -v node &>/dev/null  || die "Node.js not found — install from https://nodejs.org"
command -v pnpm &>/dev/null  || die "pnpm not found — run: npm install -g pnpm"
ok "Node.js $(node --version)  |  pnpm $(pnpm --version)"

# Find the REAL claude binary before we create any shim.
# If our shim is already installed, extract the original path from it.
find_real_claude() {
  # Prefer an explicit env var (set by the shim if we're already inside one)
  if [[ -n "${CLAUDE_CLI_PATH:-}" ]]; then
    echo "$CLAUDE_CLI_PATH"; return
  fi

  local bin
  bin="$(command -v claude 2>/dev/null || true)"
  [[ -z "$bin" ]] && return 1

  # If it's our shim, read the CLAUDE_CLI_PATH line from inside it
  if grep -q "claude-wrapper" "$bin" 2>/dev/null; then
    local extracted
    extracted="$(grep 'CLAUDE_CLI_PATH=' "$bin" | head -1 | sed 's/.*CLAUDE_CLI_PATH=//')"
    [[ -n "$extracted" ]] && echo "$extracted" && return
  fi

  echo "$bin"
}

REAL_CLAUDE="$(find_real_claude || true)"
if [[ -z "$REAL_CLAUDE" ]]; then
  die "Claude CLI not found — install from https://claude.ai/download"
fi
ok "Claude CLI: $REAL_CLAUDE"

# ─── 2. Install dependencies ──────────────────────────────────────────────────
step "Installing workspace dependencies"
cd "$SCRIPT_DIR"
pnpm install
ok "Dependencies installed"

# ─── 3. Build packages ────────────────────────────────────────────────────────
step "Building packages"

# Shared types — everything else depends on this
cd "$SCRIPT_DIR"
if pnpm --filter "@marionette/shared" build 2>/dev/null; then
  ok "Shared types built"
else
  warn "Could not build @marionette/shared via filter, trying direct..."
  (cd "$SCRIPT_DIR/packages/shared" && pnpm build)
  ok "Shared types built"
fi

# MCP server
if pnpm --filter "@marionette/mcp-server" build 2>/dev/null; then
  ok "MCP server built"
else
  warn "Could not build @marionette/mcp-server via filter, trying direct..."
  (cd "$SCRIPT_DIR/packages/mcp-server" && pnpm build) || warn "MCP server build failed (non-fatal)"
fi

# Process wrapper — must be built last as it's a standalone package
(cd "$SCRIPT_DIR/scripts" && pnpm install && pnpm build)
ok "Process wrapper built"

# ─── 4. Install claude-wrapper globally ───────────────────────────────────────
step "Installing claude-wrapper globally"

cd "$SCRIPT_DIR/scripts"
npm link

WRAPPER_BIN="$(command -v claude-wrapper 2>/dev/null || true)"
[[ -z "$WRAPPER_BIN" ]] && die "claude-wrapper not found in PATH after npm link.\nCheck that your npm global bin dir is in PATH."
WRAPPER_DIR="$(dirname "$WRAPPER_BIN")"
ok "claude-wrapper → $WRAPPER_BIN"

# ─── 5. Create 'claude' shim ──────────────────────────────────────────────────
step "Creating 'claude' shim in $WRAPPER_DIR"

SHIM="$WRAPPER_DIR/claude"
SHIM_CMD="$WRAPPER_DIR/claude.cmd"
SHIM_PS1="$WRAPPER_DIR/claude.ps1"

# The Windows-style path Node.js needs to spawn the real Claude binary
if [[ "$IS_WINDOWS" == true ]]; then
  # Prefer the .exe if it exists alongside the binary
  if [[ -f "${REAL_CLAUDE}.exe" ]]; then
    NODE_CLAUDE_PATH="$(to_win_path "${REAL_CLAUDE}.exe")"
  else
    NODE_CLAUDE_PATH="$(to_win_path "$REAL_CLAUDE")"
  fi
else
  NODE_CLAUDE_PATH="$REAL_CLAUDE"
fi

# sed -i syntax differs: macOS (BSD sed) needs '' argument, Linux/Windows (GNU sed) does not
if [[ "$OSTYPE" == darwin* ]]; then
  SED_I=(-i '')
else
  SED_I=(-i)
fi

# Bash / MSYS2 / macOS / Linux shim
if [[ -f "$SHIM" ]] && grep -q "claude-wrapper" "$SHIM" 2>/dev/null; then
  # Shim already exists — just update the path in case claude moved
  sed "${SED_I[@]}" "s|CLAUDE_CLI_PATH=.*|CLAUDE_CLI_PATH=$NODE_CLAUDE_PATH|" "$SHIM" 2>/dev/null || true
  ok "Bash shim updated (was already present)"
else
  cat > "$SHIM" << SHIM_EOF
#!/bin/sh
# Marionette claude shim — routes through claude-wrapper for monitoring
export CLAUDE_CLI_PATH=$NODE_CLAUDE_PATH
exec $WRAPPER_DIR/claude-wrapper "\$@"
SHIM_EOF
  chmod +x "$SHIM"
  ok "Bash shim created"
fi

# Windows CMD shim
if [[ "$IS_WINDOWS" == true ]]; then
  printf '@ECHO off\r\nSETLOCAL\r\nSET CLAUDE_CLI_PATH=%s\r\nCALL "%%~dp0\\claude-wrapper.cmd" %%*\r\n' \
    "$NODE_CLAUDE_PATH" > "$SHIM_CMD"
  ok "CMD shim created"

  printf '#!/usr/bin/env pwsh\n$env:CLAUDE_CLI_PATH = "%s"\n& "$PSScriptRoot\\claude-wrapper.ps1" @args\n' \
    "$NODE_CLAUDE_PATH" > "$SHIM_PS1"
  ok "PowerShell shim created"
fi

# Verify resolution
RESOLVED_CLAUDE="$(command -v claude 2>/dev/null || true)"
if [[ "$RESOLVED_CLAUDE" == "$SHIM" ]]; then
  ok "'claude' → shim ✓"
elif [[ -n "$RESOLVED_CLAUDE" ]]; then
  warn "'claude' resolves to $RESOLVED_CLAUDE (not $SHIM)"
  warn "Ensure $WRAPPER_DIR appears before $(dirname "$REAL_CLAUDE") in PATH"
fi

# ─── 6. Configure MCP server ──────────────────────────────────────────────────
step "Configuring MCP server"

MCP_INDEX="$SCRIPT_DIR/packages/mcp-server/dist/index.js"

if [[ ! -f "$MCP_INDEX" ]]; then
  warn "MCP server dist not found, skipping MCP setup"
else
  MCP_PATH="$(to_win_path "$MCP_INDEX")"

  if CLAUDE_CLI_PATH="$REAL_CLAUDE" claude mcp list 2>/dev/null | grep -q "marionette"; then
    warn "MCP server 'marionette' already configured"
    warn "To reset: CLAUDE_CLI_PATH=$REAL_CLAUDE claude mcp remove marionette"
  else
    if CLAUDE_CLI_PATH="$REAL_CLAUDE" claude mcp add marionette \
        -e MARIONETTE_API_URL=http://localhost:8787 \
        -- node "$MCP_PATH" 2>/dev/null; then
      ok "MCP server configured"
    else
      warn "MCP setup failed — run manually after setup:"
      warn "  claude mcp add marionette -e MARIONETTE_API_URL=http://localhost:8787 -- node \"$MCP_PATH\""
    fi
  fi
fi

# ─── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  Setup complete!${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${BOLD}  Start the dashboard:${NC}"
echo -e "    cd \"$SCRIPT_DIR\""
echo -e "    pnpm dev"
echo ""
echo -e "${BOLD}  Then open Claude in any terminal:${NC}"
echo -e "    claude"
echo ""
echo -e "${BOLD}  Dashboard:${NC}   http://localhost:5173"
echo -e "${BOLD}  Backend API:${NC}  http://localhost:8787"
echo ""
if [[ "$IS_WINDOWS" == true ]]; then
  echo -e "${YELLOW}  Windows note:${NC} Open a fresh terminal after setup so PATH is refreshed."
  echo ""
fi