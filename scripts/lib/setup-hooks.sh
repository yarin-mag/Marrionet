#!/usr/bin/env bash
#
# Marionette - Setup Claude Hooks
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/helpers.sh"

CLAUDE_CONFIG_DIR="$HOME/.claude"
HOOKS_FILE="$CLAUDE_CONFIG_DIR/hooks.json"

setup_hooks() {
    print_header "Setting Up Claude Hooks"

    # Create .claude directory if it doesn't exist
    mkdir -p "$CLAUDE_CONFIG_DIR"
    print_success "Claude config directory ready: $CLAUDE_CONFIG_DIR"

    # Backup existing hooks if they exist
    if [ -f "$HOOKS_FILE" ]; then
        cp "$HOOKS_FILE" "$HOOKS_FILE.backup.$(date +%s)"
        print_warning "Existing hooks backed up"
    fi

    # Create hooks.json with all the hooks
    cat > "$HOOKS_FILE" << 'EOF'
{
  "version": "1.0",
  "hooks": {
    "user-prompt-submit": {
      "command": "curl",
      "args": [
        "-s",
        "-X",
        "POST",
        "${MARIONETTE_API_URL:-http://localhost:8787}/api/agent-status",
        "-H",
        "Content-Type: application/json",
        "-d",
        "{\"status\":\"working\",\"terminal\":\"${TERM_SESSION_ID:-${TERM}}\",\"cwd\":\"${PWD}\",\"event\":\"user_prompt\"}"
      ],
      "background": true,
      "timeout": 500
    },
    "agent-response-complete": {
      "command": "curl",
      "args": [
        "-s",
        "-X",
        "POST",
        "${MARIONETTE_API_URL:-http://localhost:8787}/api/agent-status",
        "-H",
        "Content-Type: application/json",
        "-d",
        "{\"status\":\"working\",\"terminal\":\"${TERM_SESSION_ID:-${TERM}}\",\"cwd\":\"${PWD}\",\"event\":\"response_complete\"}"
      ],
      "background": true,
      "timeout": 500
    },
    "tool-execution-start": {
      "command": "curl",
      "args": [
        "-s",
        "-X",
        "POST",
        "${MARIONETTE_API_URL:-http://localhost:8787}/api/agent-status",
        "-H",
        "Content-Type: application/json",
        "-d",
        "{\"status\":\"working\",\"terminal\":\"${TERM_SESSION_ID:-${TERM}}\",\"cwd\":\"${PWD}\",\"event\":\"tool_start\",\"tool\":\"${TOOL_NAME}\"}"
      ],
      "background": true,
      "timeout": 500
    },
    "tool-execution-complete": {
      "command": "curl",
      "args": [
        "-s",
        "-X",
        "POST",
        "${MARIONETTE_API_URL:-http://localhost:8787}/api/agent-status",
        "-H",
        "Content-Type: application/json",
        "-d",
        "{\"status\":\"working\",\"terminal\":\"${TERM_SESSION_ID:-${TERM}}\",\"cwd\":\"${PWD}\",\"event\":\"tool_complete\",\"tool\":\"${TOOL_NAME}\"}"
      ],
      "background": true,
      "timeout": 500
    },
    "session-start": {
      "command": "curl",
      "args": [
        "-s",
        "-X",
        "POST",
        "${MARIONETTE_API_URL:-http://localhost:8787}/api/agent-status",
        "-H",
        "Content-Type: application/json",
        "-d",
        "{\"status\":\"starting\",\"terminal\":\"${TERM_SESSION_ID:-${TERM}}\",\"cwd\":\"${PWD}\",\"event\":\"session_start\"}"
      ],
      "background": true,
      "timeout": 500
    },
    "session-end": {
      "command": "curl",
      "args": [
        "-s",
        "-X",
        "POST",
        "${MARIONETTE_API_URL:-http://localhost:8787}/api/agent-status",
        "-H",
        "Content-Type: application/json",
        "-d",
        "{\"status\":\"stopped\",\"terminal\":\"${TERM_SESSION_ID:-${TERM}}\",\"cwd\":\"${PWD}\",\"event\":\"session_end\"}"
      ],
      "background": true,
      "timeout": 500
    },
    "error": {
      "command": "curl",
      "args": [
        "-s",
        "-X",
        "POST",
        "${MARIONETTE_API_URL:-http://localhost:8787}/api/agent-status",
        "-H",
        "Content-Type: application/json",
        "-d",
        "{\"status\":\"error\",\"terminal\":\"${TERM_SESSION_ID:-${TERM}}\",\"cwd\":\"${PWD}\",\"event\":\"error\"}"
      ],
      "background": true,
      "timeout": 500
    },
    "agent-blocked": {
      "command": "curl",
      "args": [
        "-s",
        "-X",
        "POST",
        "${MARIONETTE_API_URL:-http://localhost:8787}/api/agent-status",
        "-H",
        "Content-Type: application/json",
        "-d",
        "{\"status\":\"blocked\",\"terminal\":\"${TERM_SESSION_ID:-${TERM}}\",\"cwd\":\"${PWD}\",\"event\":\"blocked\"}"
      ],
      "background": true,
      "timeout": 500
    }
  }
}
EOF

    print_success "Claude hooks configured: $HOOKS_FILE"
    echo ""
    echo -e "  ${CYAN}Hooks installed:${NC}"
    echo -e "    ${GREEN}•${NC} user-prompt-submit ${CYAN}(when you send a message)${NC}"
    echo -e "    ${GREEN}•${NC} agent-response-complete ${CYAN}(when Claude finishes)${NC}"
    echo -e "    ${GREEN}•${NC} tool-execution-start/complete ${CYAN}(during tool use)${NC}"
    echo -e "    ${GREEN}•${NC} session-start/end ${CYAN}(Claude starts/stops)${NC}"
    echo -e "    ${GREEN}•${NC} error ${CYAN}(when errors occur)${NC}"
    echo -e "    ${GREEN}•${NC} agent-blocked ${CYAN}(waiting for user input)${NC}"
}

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    setup_hooks
fi
