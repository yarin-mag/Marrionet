#!/usr/bin/env bash
#
# Called by Claude Code's Notification hook when an error or alert occurs.
# Stdin: JSON with session_id, message, title, cwd
# Emits a log.error MarionetteEvent to /api/events.
#

set -euo pipefail

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

AGENT_ID=$(curl -s --max-time 3 "${API_URL}/api/agents" 2>/dev/null \
  | jq -r --arg term "$TERMINAL" --arg cwd "$CWD" \
    'map(select(.terminal == $term or .cwd == $cwd)) | sort_by(.last_activity) | last | .agent_id // ""' \
    2>/dev/null || echo "")

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
