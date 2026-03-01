#!/usr/bin/env bash
#
# Called by Claude Code's Stop hook after each completed turn.
#
# Strategy: the Stop hook fires both after normal turns AND when Claude exits.
# For a normal turn, the file watcher processes the turn_duration JSONL line
# and transitions the agent to "idle" before this script finishes.
# For a mid-turn kill (Ctrl+C), no turn_duration is written, so the agent
# stays "working". We check the actual status after a short wait:
#   - already "idle"  → turn completed cleanly, file watcher handled it → no-op
#   - still "working" → killed mid-turn → emit agent.disconnected
#

# jq is required for JSON parsing — exit cleanly if unavailable
if ! command -v jq &>/dev/null; then
  exit 0
fi

API_URL="${MARIONETTE_API_URL:-http://localhost:8787}"
CWD="${PWD:-$(pwd)}"
TMPDIR="${TMPDIR:-${TMP:-/tmp}}"

INPUT=$(cat 2>/dev/null || echo '{}')
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // ""' 2>/dev/null || echo "")

_sha256_8() {
  if command -v sha256sum &>/dev/null; then
    printf '%s' "$1" | sha256sum | cut -c1-8
  else
    printf '%s' "$1" | shasum -a 256 | cut -c1-8
  fi
}

_sha256_full() {
  if command -v sha256sum &>/dev/null; then
    printf '%s' "$1" | sha256sum | awk '{print $1}'
  else
    printf '%s' "$1" | shasum -a 256 | awk '{print $1}'
  fi
}

# ── Agent ID resolution ──────────────────────────────────────────────────────
AGENT_TMPFILE="${TMPDIR}/marionette-agent-$(_sha256_8 "$CWD")"

AGENT_ID=""

# 1. MCP temp file (most reliable — written by MCP server on startup)
if [ -f "$AGENT_TMPFILE" ]; then
  _tmp=$(cat "$AGENT_TMPFILE" 2>/dev/null || echo "")
  if [[ "$_tmp" =~ ^agent_[0-9a-f]{16}$ ]]; then
    AGENT_ID="$_tmp"
  fi
fi

# 2. API lookup by cwd — find the most recently active agent in an active status
if [ -z "$AGENT_ID" ]; then
  AGENT_ID=$(curl -s --max-time 2 "${API_URL}/api/agents" 2>/dev/null \
    | jq -r --arg cwd "$CWD" \
      'map(select(.cwd == $cwd and (.status == "working" or .status == "awaiting_input" or .status == "starting")))
       | sort_by(.last_activity) | last | .agent_id // ""' \
      2>/dev/null || echo "")
fi

# No agent found — nothing to do
[ -z "$AGENT_ID" ] && exit 0
# ─────────────────────────────────────────────────────────────────────────────

# Wait for the file watcher to process the turn_duration line if the turn
# completed cleanly. The file watcher has a 100ms stabilityThreshold before
# reading + processing time + HTTP round-trip. 3 seconds gives comfortable
# headroom even on a slow machine or under load.
sleep 3

# Check the agent's current status
CURRENT_STATUS=$(curl -s --max-time 2 "${API_URL}/api/agents/${AGENT_ID}" 2>/dev/null \
  | jq -r '.status // ""' 2>/dev/null || echo "")

# If already idle/disconnected/finished — turn completed cleanly, nothing to do
if [[ "$CURRENT_STATUS" != "working" && "$CURRENT_STATUS" != "awaiting_input" && "$CURRENT_STATUS" != "starting" ]]; then
  exit 0
fi

# Still in an active status → turn_duration was never written → Claude was killed
# mid-turn. Emit agent.disconnected so the dashboard reflects reality immediately.

# Derive run_id from session_id (matches file watcher's deriveSessionRunId formula)
RUN_ID=""
if [ -n "$SESSION_ID" ]; then
  _hash=$(_sha256_full "run:${SESSION_ID}")
  RUN_ID="run_${_hash:0:16}"
fi
RUN_ID="${RUN_ID:-run_stop_$(date +%s)}"

EVENT=$(jq -cn \
  --arg agent_id "$AGENT_ID" \
  --arg run_id "$RUN_ID" \
  --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg cwd "$CWD" \
  '{
    type: "agent.disconnected",
    agent_id: $agent_id,
    run_id: $run_id,
    ts: $ts,
    summary: "Agent session ended (stop hook)",
    status: "disconnected",
    agent_metadata: { cwd: $cwd, source: "cli" }
  }')

curl -s --max-time 3 -X POST "${API_URL}/api/events" \
  -H "Content-Type: application/json" \
  -d "$EVENT" \
  > /dev/null 2>&1 || true

exit 0
