#!/bin/bash
# This hook is called when Claude needs user attention

# Get terminal and current working directory to identify agents
TERMINAL=${TERM_SESSION_ID:-${TERM:-default}}
CWD=${PWD:-$(pwd)}

# Update agent in this terminal+cwd with "blocked" status
curl -s -X POST http://localhost:8787/api/agent-status \
  -H "Content-Type: application/json" \
  -d "{\"terminal\":\"${TERMINAL}\",\"cwd\":\"${CWD}\",\"status\":\"blocked\"}" \
  > /dev/null 2>&1 &

exit 0
