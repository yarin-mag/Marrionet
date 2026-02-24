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
TERMINAL="${TERM_SESSION_ID:-${TERM:-default}}"
CWD="${PWD:-$(pwd)}"

INPUT=$(cat 2>/dev/null || echo '{}')
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // ""' 2>/dev/null || echo "")
RUN_ID="${SESSION_ID:-session_${TERMINAL}_$(date +%s)}"

# Find agent_id by matching terminal or cwd
AGENT_ID=$(curl -s --max-time 3 "${API_URL}/api/agents" 2>/dev/null \
  | jq -r --arg term "$TERMINAL" --arg cwd "$CWD" \
    'map(select(.terminal == $term or .cwd == $cwd)) | sort_by(.last_activity) | last | .agent_id // ""' \
    2>/dev/null || echo "")

if [ -z "$AGENT_ID" ]; then
  exit 0
fi

EVENT=$(jq -cn \
  --arg type "run.started" \
  --arg run_id "$RUN_ID" \
  --arg agent_id "$AGENT_ID" \
  --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg summary "Claude session started" \
  '{
    type: $type,
    run_id: $run_id,
    agent_id: $agent_id,
    ts: $ts,
    summary: $summary
  }')

curl -s --max-time 5 -X POST "${API_URL}/api/events" \
  -H "Content-Type: application/json" \
  -d "$EVENT" \
  > /dev/null 2>&1

exit 0
