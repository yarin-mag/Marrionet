#!/usr/bin/env bash
#
# Marionette - Setup MCP Server Configuration
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
source "$SCRIPT_DIR/helpers.sh"

MCP_CONFIG_FILE="$HOME/.claude/mcp_settings.json"

setup_mcp_config() {
    print_header "Setting Up MCP Server"

    # Create MCP config directory
    mkdir -p "$(dirname "$MCP_CONFIG_FILE")"

    # Create or update MCP config
    if [ -f "$MCP_CONFIG_FILE" ]; then
        print_warning "MCP config already exists: $MCP_CONFIG_FILE"
        print_warning "Please manually add Marionette MCP server:"
        echo ""
        echo -e "${YELLOW}Add this to your mcpServers section:${NC}"
        echo -e "${CYAN}"
        cat << EOF
{
  "marionette": {
    "command": "node",
    "args": ["$PROJECT_ROOT/packages/mcp-server/dist/index.js"],
    "env": {
      "MARIONETTE_API_URL": "http://localhost:8787"
    }
  }
}
EOF
        echo -e "${NC}"
    else
        cat > "$MCP_CONFIG_FILE" << EOF
{
  "mcpServers": {
    "marionette": {
      "command": "node",
      "args": ["$PROJECT_ROOT/packages/mcp-server/dist/index.js"],
      "env": {
        "MARIONETTE_API_URL": "http://localhost:8787"
      }
    }
  }
}
EOF
        print_success "MCP config created: $MCP_CONFIG_FILE"
    fi
}

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    setup_mcp_config
fi
