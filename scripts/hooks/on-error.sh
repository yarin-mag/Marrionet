#!/usr/bin/env bash
#
# Called by Claude Code's Notification hook when an error or alert occurs.
# Stdin: JSON with session_id, message, title, cwd
# Emits a log.error MarionetteEvent to /api/events.
#

set -euo pipefail

# jq is required for JSON parsing — exit cleanly if unavailable
if ! command -v jq &>/dev/null; then
  exit 0
fi

API_URL="${MARIONETTE_API_URL:-http://localhost:8787}"
TERMINAL="${TERM_SESSION_ID:-${TERM:-default}}"
CWD="${PWD:-$(pwd)}"

INPUT=$(cat 2>/dev/null || echo '{}')
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // ""' 2>/dev/null || echo "")
MESSAGE=$(echo "$INPUT" | jq -r '.message // "Unknown error"' 2>/dev/null || echo "Unknown error")
TITLE=$(echo "$INPUT" | jq -r '.title // ""' 2>/dev/null || echo "")

# Only forward error-like notifications
NOTIFICATION_TYPE=$(echo "$INPUT" | jq -r '.notification_type // .type // ""' 2>/dev/null || echo "")
# If it doesn't look like an error notification, skip
if [[ "$NOTIFICATION_TYPE" != *"error"* && "$TITLE" != *"error"* && "$TITLE" != *"Error"* && "$MESSAGE" != *"error"* ]]; then
  # Still forward all notifications — the backend can filter; remove this block to send all
  : # no-op: fall through and send
fi

RUN_ID="${SESSION_ID:-error_${TERMINAL}_$(date +%s)}"

# ── Agent ID resolution ──────────────────────────────────────────────────────
TMPDIR="${TMPDIR:-${TMP:-/tmp}}"

_sha256_8() {
  if command -v sha256sum &>/dev/null; then
    printf '%s' "$1" | sha256sum | cut -c1-8
  else
    printf '%s' "$1" | shasum -a 256 | cut -c1-8
  fi
}

AGENT_TMPFILE="${TMPDIR}/marionette-agent-$(_sha256_8 "$CWD")"

# 1. Try temp file (MCP server writes this synchronously on startup)
AGENT_ID=""
if [ -f "$AGENT_TMPFILE" ]; then
  _tmp=$(cat "$AGENT_TMPFILE" 2>/dev/null || echo "")
  if [[ "$_tmp" =~ ^agent_[0-9a-f]{16}$ ]]; then
    AGENT_ID="$_tmp"
  fi
fi

# 2. Fall back to API lookup (CLI/wrapper mode — matches by terminal or cwd)
if [ -z "$AGENT_ID" ]; then
  AGENT_ID=$(curl -s --max-time 3 "${API_URL}/api/agents" 2>/dev/null \
    | jq -r --arg term "$TERMINAL" --arg cwd "$CWD" \
      'map(select(.terminal == $term or .cwd == $cwd)) | sort_by(.last_activity) | last | .agent_id // ""' \
      2>/dev/null || echo "")
fi
# ─────────────────────────────────────────────────────────────────────────────

if [ -z "$AGENT_ID" ]; then
  exit 0
fi

SUMMARY="${TITLE:+$TITLE: }${MESSAGE}"

EVENT=$(jq -cn \
  --arg type "log.error" \
  --arg run_id "$RUN_ID" \
  --arg agent_id "$AGENT_ID" \
  --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg summary "$SUMMARY" \
  --arg message "$MESSAGE" \
  '{
    type: $type,
    run_id: $run_id,
    agent_id: $agent_id,
    ts: $ts,
    summary: $summary,
    error: {
      message: $message,
      recoverable: true
    }
  }')

curl -s --max-time 5 -X POST "${API_URL}/api/events" \
  -H "Content-Type: application/json" \
  -d "$EVENT" \
  > /dev/null 2>&1

exit 0
