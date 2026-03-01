#!/usr/bin/env bash
#
# Called at the start of a Claude Code session (PreToolUse on first tool call
# or via a session-start equivalent hook). Emits a run.started event so the
# dashboard increments the run counter.
#
# Stdin: JSON with session_id, tool_name, tool_input, cwd (from PreToolUse)
#

set -euo pipefail

API_URL="${MARIONETTE_API_URL:-http://localhost:8787}"
PROXY_URL="${MARIONETTE_PROXY_URL:-http://localhost:8788}"
# Raw terminal value used for agent ID hash (must match MCP server formula)
TERMINAL="${TERM_SESSION_ID:-${TERM:-default}}"
# Human-readable terminal name used for API lookup
_detect_terminal_name() {
  case "${TERM_PROGRAM:-}" in
    WarpTerminal)   echo "Warp"; return ;;
    iTerm.app)      echo "iTerm2"; return ;;
    Apple_Terminal) echo "Terminal.app"; return ;;
    vscode)         echo "VS Code"; return ;;
    Hyper)          echo "Hyper"; return ;;
    ghostty)        echo "Ghostty"; return ;;
    "")             ;;
    *)              echo "$TERM_PROGRAM"; return ;;
  esac
  [ -n "${WARP_FEATURES:-}${WARP_THEMES_DIR:-}" ] && echo "Warp" && return
  [ -n "${VSCODE_PID:-}${VSCODE_IPC_HOOK_CLI:-}" ] && echo "VS Code" && return
  [ -n "${TMUX:-}" ] && echo "tmux" && return
  [ -n "${STY:-}" ] && echo "screen" && return
  [ -n "${SSH_CLIENT:-}${SSH_TTY:-}" ] && echo "SSH" && return
  [ -n "${TERM_SESSION_ID:-}" ] && echo "Terminal.app" && return
  echo "${TERM:-Unknown}"
}
TERMINAL_NAME=$(_detect_terminal_name)
CWD="${PWD:-$(pwd)}"
TMPDIR="${TMPDIR:-${TMP:-/tmp}}"

INPUT=$(cat 2>/dev/null || echo '{}')
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // ""' 2>/dev/null || echo "")
RUN_ID="${SESSION_ID:-session_${TERMINAL}_$(date +%s)}"

_sha256_8() {
  if command -v sha256sum &>/dev/null; then
    printf '%s' "$1" | sha256sum | cut -c1-8
  else
    printf '%s' "$1" | shasum -a 256 | cut -c1-8
  fi
}

# ── Agent ID resolution ──────────────────────────────────────────────────────
AGENT_TMPFILE="${TMPDIR}/marionette-agent-$(_sha256_8 "$CWD")"

# 1. Try temp file (MCP server writes this synchronously on startup)
AGENT_ID=""
if [ -f "$AGENT_TMPFILE" ]; then
  _tmp=$(head -1 "$AGENT_TMPFILE" 2>/dev/null || echo "")
  if [[ "$_tmp" =~ ^agent_[0-9a-f]{16}$ ]]; then
    AGENT_ID="$_tmp"
  fi
fi

# 2. Fall back to API lookup (CLI/wrapper mode — matches by terminal name or cwd)
if [ -z "$AGENT_ID" ]; then
  AGENT_ID=$(curl -s --max-time 3 "${API_URL}/api/agents" 2>/dev/null \
    | jq -r --arg term "$TERMINAL_NAME" --arg cwd "$CWD" \
      'map(select(.terminal == $term or .cwd == $cwd)) | sort_by(.last_activity) | last | .agent_id // ""' \
      2>/dev/null || echo "")
fi

# 3. VSCode race-condition retry: poll for up to 10 seconds (MCP server may still be initializing)
if [ -z "$AGENT_ID" ] && { [ -n "${VSCODE_PID:-}" ] || [ "${TERM_PROGRAM:-}" = "vscode" ]; }; then
  for _i in $(seq 1 10); do
    sleep 1
    if [ -f "$AGENT_TMPFILE" ]; then
      _tmp=$(head -1 "$AGENT_TMPFILE" 2>/dev/null || echo "")
      if [[ "$_tmp" =~ ^agent_[0-9a-f]{16}$ ]]; then
        AGENT_ID="$_tmp"
        break
      fi
    fi
  done
fi

# 4. Compute fallback agent_id matching MCP server's VSCode formula:
#    generateAgentId({ hostname, terminal, cwd, suffix: "" }) -> sha256("hostname:terminal:cwd:").slice(0,16)
if [ -z "$AGENT_ID" ]; then
  HOSTNAME_VAL=$(hostname 2>/dev/null || echo "unknown")
  _hash_input="${HOSTNAME_VAL}:${TERMINAL}:${CWD}:"
  if command -v sha256sum &>/dev/null; then
    _full_hash=$(printf '%s' "$_hash_input" | sha256sum | awk '{print $1}')
  else
    _full_hash=$(printf '%s' "$_hash_input" | shasum -a 256 | awk '{print $1}')
  fi
  AGENT_ID="agent_${_full_hash:0:16}"
fi
# ─────────────────────────────────────────────────────────────────────────────

# Always register with the API proxy — idempotent, ensures token attribution
# even after a proxy restart or when the MCP server started before the proxy.
curl -s --max-time 2 -X POST "${PROXY_URL}/_register" \
  -H "Content-Type: application/json" \
  -d "{\"agent_id\":\"${AGENT_ID}\",\"run_id\":\"${RUN_ID}\",\"cwd\":\"${CWD}\"}" \
  > /dev/null 2>&1 || true

# Store Claude process PID for kill/focus functionality
CLAUDE_PID="${PPID}"
curl -s --max-time 2 -X PATCH "${API_URL}/api/agents/${AGENT_ID}" \
  -H "Content-Type: application/json" \
  -d "{\"process_pid\":${CLAUDE_PID}}" \
  > /dev/null 2>&1 || true

exit 0
