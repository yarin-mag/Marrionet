#!/usr/bin/env bash
#
# Called by Claude Code's Stop hook after each complete response.
# Stdin: JSON with session_id, transcript, usage (input_tokens, output_tokens, cache_*)
# Emits a run.ended MarionetteEvent to /api/events with token usage.
#

set -euo pipefail

API_URL="${MARIONETTE_API_URL:-http://localhost:8787}"
TERMINAL="${TERM_SESSION_ID:-${TERM:-default}}"
CWD="${PWD:-$(pwd)}"

# Read Claude Code's hook data from stdin (non-fatal if empty)
INPUT=$(cat 2>/dev/null || echo '{}')

# Extract session_id and token usage from the hook payload
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // ""' 2>/dev/null || echo "")
INPUT_TOKENS=$(echo "$INPUT" | jq -r '.usage.input_tokens // 0' 2>/dev/null || echo "0")
OUTPUT_TOKENS=$(echo "$INPUT" | jq -r '.usage.output_tokens // 0' 2>/dev/null || echo "0")
CACHE_READ=$(echo "$INPUT" | jq -r '.usage.cache_read_input_tokens // 0' 2>/dev/null || echo "0")
TOTAL_TOKENS=$((INPUT_TOKENS + OUTPUT_TOKENS + CACHE_READ))

RUN_ID="${SESSION_ID:-hook_${TERMINAL}_$(date +%s)}"

# Find the agent_id by matching terminal or cwd
AGENT_ID=$(curl -s --max-time 3 "${API_URL}/api/agents" 2>/dev/null \
  | jq -r --arg term "$TERMINAL" --arg cwd "$CWD" \
    'map(select(.terminal == $term or .cwd == $cwd)) | sort_by(.last_activity) | last | .agent_id // ""' \
    2>/dev/null || echo "")

if [ -z "$AGENT_ID" ]; then
  exit 0
fi

# POST run.ended event with token data
EVENT=$(jq -cn \
  --arg type "run.ended" \
  --arg run_id "$RUN_ID" \
  --arg agent_id "$AGENT_ID" \
  --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg summary "Claude response complete" \
  --argjson input_tokens "$INPUT_TOKENS" \
  --argjson output_tokens "$OUTPUT_TOKENS" \
  --argjson total_tokens "$TOTAL_TOKENS" \
  '{
    type: $type,
    run_id: $run_id,
    agent_id: $agent_id,
    ts: $ts,
    summary: $summary,
    tokens: {
      input_tokens: $input_tokens,
      output_tokens: $output_tokens,
      total_tokens: $total_tokens
    }
  }')

curl -s --max-time 5 -X POST "${API_URL}/api/events" \
  -H "Content-Type: application/json" \
  -d "$EVENT" \
  > /dev/null 2>&1

exit 0
