#!/usr/bin/env bash
#
# Marionette - Setup Claude Hooks
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/helpers.sh"

CLAUDE_CONFIG_DIR="$HOME/.claude"
# Marionette hook scripts install location
HOOKS_INSTALL_DIR="$HOME/.local/share/marionette/hooks"

# Source hook scripts (relative to this script's lib/ dir, up one level to scripts/)
HOOKS_SRC_DIR="$(cd "$SCRIPT_DIR/../hooks" && pwd)"

setup_hooks() {
    print_header "Setting Up Claude Hooks"

    # Create .claude directory if it doesn't exist
    mkdir -p "$CLAUDE_CONFIG_DIR"
    print_success "Claude config directory ready: $CLAUDE_CONFIG_DIR"

    # Install hook scripts to a stable path
    mkdir -p "$HOOKS_INSTALL_DIR"
    cp "$HOOKS_SRC_DIR/on-stop.sh"          "$HOOKS_INSTALL_DIR/on-stop.sh"
    cp "$HOOKS_SRC_DIR/on-session-start.sh" "$HOOKS_INSTALL_DIR/on-session-start.sh"
    cp "$HOOKS_SRC_DIR/on-error.sh"         "$HOOKS_INSTALL_DIR/on-error.sh"
    chmod +x "$HOOKS_INSTALL_DIR"/*.sh
    print_success "Hook scripts installed: $HOOKS_INSTALL_DIR"

    # ---------------------------------------------------------------------------
    # Write Claude Code settings.json hooks using the correct hook event names:
    #   Stop         – fires after every complete Claude response; reads token usage
    #                  from stdin and POSTs a run.ended event (increments run count
    #                  + token count in one shot)
    #   Notification – fires on errors/alerts; POSTs a log.error event
    #
    # Each hook command receives JSON on stdin from Claude Code.
    # Our scripts read that stdin and POST structured MarionetteEvents to /api/events.
    # ---------------------------------------------------------------------------
    SETTINGS_FILE="$CLAUDE_CONFIG_DIR/settings.json"

    # Backup existing settings if present
    if [ -f "$SETTINGS_FILE" ]; then
        cp "$SETTINGS_FILE" "${SETTINGS_FILE}.backup.$(date +%s)"
        print_warning "Existing settings.json backed up"
    fi

    # Merge our hooks into settings.json (create file if missing)
    # We use Python as a portable JSON merge tool (avoids jq dependency for write)
    python3 - <<PYEOF
import json, os, sys

settings_file = "$SETTINGS_FILE"

# Load existing settings or start fresh
if os.path.exists(settings_file):
    with open(settings_file) as f:
        try:
            settings = json.load(f)
        except json.JSONDecodeError:
            settings = {}
else:
    settings = {}

hooks_dir = "$HOOKS_INSTALL_DIR"

# Our hooks configuration using Claude Code's actual hook event names
marionette_hooks = {
    "Stop": [
        {
            "hooks": [
                {
                    "type": "command",
                    "command": f"bash {hooks_dir}/on-stop.sh",
                    "timeout": 10
                }
            ]
        }
    ],
    "Notification": [
        {
            "hooks": [
                {
                    "type": "command",
                    "command": f"bash {hooks_dir}/on-error.sh",
                    "timeout": 5
                }
            ]
        }
    ]
}

# Merge: keep existing hooks for other event types, overwrite ours
existing_hooks = settings.get("hooks", {})
for event_name, hook_config in marionette_hooks.items():
    existing_hooks[event_name] = hook_config
settings["hooks"] = existing_hooks

with open(settings_file, "w") as f:
    json.dump(settings, f, indent=2)

print(f"Wrote hooks to {settings_file}")
PYEOF

    print_success "Claude hooks configured in: $SETTINGS_FILE"
    echo ""
    echo -e "  ${CYAN}Hooks installed (Claude Code native format):${NC}"
    echo -e "    ${GREEN}•${NC} Stop          ${CYAN}→ on-stop.sh (run.ended + token counts)${NC}"
    echo -e "    ${GREEN}•${NC} Notification  ${CYAN}→ on-error.sh (log.error)${NC}"
    echo ""
    echo -e "  ${CYAN}Scripts installed to:${NC} $HOOKS_INSTALL_DIR"
}

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    setup_hooks
fi
