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

# Compiled JS hooks are in packages/hooks/dist/ (relative to repo root)
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
HOOKS_DIST_DIR="$REPO_ROOT/packages/hooks/dist"

setup_hooks() {
    print_header "Setting Up Claude Hooks"

    # Build the hooks package if dist/ doesn't exist yet
    if [ ! -f "$HOOKS_DIST_DIR/on-stop.js" ]; then
        echo "  Building @marionette/hooks..."
        pnpm --filter @marionette/hooks build
    fi

    # Create .claude directory if it doesn't exist
    mkdir -p "$CLAUDE_CONFIG_DIR"
    print_success "Claude config directory ready: $CLAUDE_CONFIG_DIR"

    # In dev mode, we reference the hooks from their repo dist path directly.
    # Do NOT copy — the compiled JS imports @marionette/shared, which is only
    # resolvable via node_modules inside the repo (pnpm workspace).
    # Copying to a standalone dir breaks the module resolution.
    print_success "Using hooks from repo: $HOOKS_DIST_DIR"
    # HOOKS_DIST_DIR is used below as the path written into settings.json

    # ---------------------------------------------------------------------------
    # Write Claude Code settings.json hooks using the correct hook event names:
    #   PreToolUse   – fires before every tool call; session start detection
    #   Stop         – fires after every complete Claude response; mid-turn kill detection
    #   Notification – fires on errors/alerts; POSTs a log.error event
    #
    # Each hook command receives JSON on stdin from Claude Code.
    # Scripts are plain Node.js — no bash required, works on macOS/Linux/Windows.
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

hooks_dir = "$HOOKS_DIST_DIR"

# Our hooks configuration using Claude Code's actual hook event names
marionette_hooks = {
    "PreToolUse": [
        {
            "hooks": [
                {
                    "type": "command",
                    "command": f"node {hooks_dir}/on-session-start.js",
                    "timeout": 10
                }
            ]
        }
    ],
    "Stop": [
        {
            "hooks": [
                {
                    "type": "command",
                    "command": f"node {hooks_dir}/on-stop.js",
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
                    "command": f"node {hooks_dir}/on-error.js",
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
    echo -e "    ${GREEN}•${NC} PreToolUse    ${CYAN}→ on-session-start.js${NC}"
    echo -e "    ${GREEN}•${NC} Stop          ${CYAN}→ on-stop.js (mid-turn kill detection)${NC}"
    echo -e "    ${GREEN}•${NC} Notification  ${CYAN}→ on-error.js (log.error)${NC}"
    echo ""
    echo -e "  ${CYAN}Hooks running from:${NC} $HOOKS_DIST_DIR"
}

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    setup_hooks
fi
