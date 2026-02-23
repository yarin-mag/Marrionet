#!/usr/bin/env bash
#
# Marionette - Setup Claude Wrapper
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
source "$SCRIPT_DIR/helpers.sh"

setup_wrapper() {
    print_header "Setting Up Claude Wrapper"

    # Make wrapper executable
    chmod +x "$PROJECT_ROOT/scripts/claude-wrapper.sh"
    print_success "Wrapper script made executable"

    # Detect shell
    SHELL_NAME=$(basename "$SHELL")
    case "$SHELL_NAME" in
        bash)
            SHELL_RC="$HOME/.bashrc"
            ;;
        zsh)
            SHELL_RC="$HOME/.zshrc"
            ;;
        fish)
            SHELL_RC="$HOME/.config/fish/config.fish"
            print_warning "Fish shell detected - may need manual configuration"
            ;;
        *)
            SHELL_RC="$HOME/.profile"
            ;;
    esac

    print_step "Detected shell: $SHELL_NAME (config: $SHELL_RC)"

    # Check if alias already exists
    if grep -q "claude-wrapper.sh" "$SHELL_RC" 2>/dev/null; then
        print_warning "Claude wrapper alias already exists in $SHELL_RC"
    else
        # Add wrapper alias
        echo "" >> "$SHELL_RC"
        echo "# Marionette - Claude Wrapper for process tracking" >> "$SHELL_RC"
        echo "alias claude='$PROJECT_ROOT/scripts/claude-wrapper.sh'" >> "$SHELL_RC"
        echo "" >> "$SHELL_RC"
        print_success "Claude wrapper alias added to $SHELL_RC"
    fi

    # Export Marionette URL
    if ! grep -q "MARIONETTE_API_URL" "$SHELL_RC" 2>/dev/null; then
        echo "# Marionette API URL" >> "$SHELL_RC"
        echo "export MARIONETTE_API_URL=\"http://localhost:8787\"" >> "$SHELL_RC"
        print_success "Marionette API URL configured"
    fi
}

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    setup_wrapper
fi
