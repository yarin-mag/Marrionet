#!/bin/bash
# This hook is called when user submits input to Claude

# Get terminal and current working directory to identify agents
TERMINAL=${TERM_SESSION_ID:-${TERM:-default}}
CWD=${PWD:-$(pwd)}

# Update agent in this terminal+cwd back to "working" status
curl -s -X POST http://localhost:8787/api/agent-status \
  -H "Content-Type: application/json" \
  -d "{\"terminal\":\"${TERMINAL}\",\"cwd\":\"${CWD}\",\"status\":\"working\"}" \
  > /dev/null 2>&1 &

exit 0
