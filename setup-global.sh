#!/bin/bash
set -e

echo "🚀 Setting up Marionette globally for Claude Code..."

# Get the absolute path to the MCP server
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MCP_SERVER_PATH="$SCRIPT_DIR/packages/mcp-server/dist/index.js"

# Check if MCP server is built
if [ ! -f "$MCP_SERVER_PATH" ]; then
    echo "❌ MCP server not built. Building now..."
    cd "$SCRIPT_DIR/packages/mcp-server"
    pnpm build
    cd -
fi

MCP_CONFIG="$HOME/.claude/mcp_settings.json"

# Check if mcp_settings.json exists
if [ ! -f "$MCP_CONFIG" ]; then
    echo "📝 Creating mcp_settings.json..."
    mkdir -p "$HOME/.claude"
    echo '{"mcpServers":{}}' > "$MCP_CONFIG"
fi

# Backup the config
cp "$MCP_CONFIG" "$MCP_CONFIG.backup"
echo "✅ Backed up config to $MCP_CONFIG.backup"

# Add Marionette to the global mcpServers
echo "📝 Adding Marionette to global MCP config..."

# Convert POSIX paths to mixed Windows paths (forward slashes) for Node.js
# cygpath -m gives "C:/Users/..." which Node.js on Windows handles fine
if command -v cygpath &> /dev/null; then
    MCP_CONFIG_WIN=$(cygpath -m "$MCP_CONFIG")
    MCP_SERVER_PATH_WIN=$(cygpath -m "$MCP_SERVER_PATH")
else
    MCP_CONFIG_WIN="$MCP_CONFIG"
    MCP_SERVER_PATH_WIN="$MCP_SERVER_PATH"
fi

# Use Node.js to safely update the JSON
node << NODESCRIPT
const fs = require('fs');
const configPath = '$MCP_CONFIG_WIN';
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Add global mcpServers if it doesn't exist
if (!config.mcpServers) {
    config.mcpServers = {};
}

// Add Marionette
config.mcpServers.marionette = {
    command: "node",
    args: ["$MCP_SERVER_PATH_WIN"],
    env: {
        MARIONETTE_API_URL: "http://localhost:8787"
    }
};

fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
console.log("✅ Marionette configured globally!");
NODESCRIPT

# Create global instructions for token reporting
echo "📝 Creating global instructions..."
cat > "$HOME/.claude/marionette-instructions.md" << 'EOF'
# Marionette Integration - Global Instructions

## Automatic Token Reporting

**IMPORTANT**: Every 5-10 messages, report your token usage to Marionette:

1. Check your current token count from context
2. Call `marionette_report_tokens` with current input and output tokens
3. This tracks resource usage in the monitoring dashboard

Example:
```
marionette_report_tokens({
  input_tokens: 45234,
  output_tokens: 12876
})
```

## Task Tracking

When starting a new task, call `marionette_set_task` with a meaningful name like:
- "Bug Investigation: CEM-24729"
- "Feature: User authentication"
- "Refactor: Database queries"

These tools help track your work in the Marionette monitoring dashboard.
EOF

echo ""
echo "✅ Setup complete!"
echo ""
echo "Marionette is now configured globally for ALL Claude Code sessions."
echo ""
echo "📋 Quick Start:"
echo "1. Start the Marionette server:"
echo "   cd $SCRIPT_DIR/apps/server && pnpm dev"
echo ""
echo "2. In another terminal, start the dashboard:"
echo "   cd $SCRIPT_DIR/apps/web && pnpm dev"
echo ""
echo "3. Open dashboard: http://localhost:5173"
echo ""
echo "4. Start Claude in any directory:"
echo "   cd ~/Documents"
echo "   claude"
echo ""
echo "📊 Features:"
echo "  • Tasks tracked automatically (e.g., 'Bug Investigation: CEM-24729')"
echo "  • Agents appear/disappear instantly via WebSocket"
echo "  • Tokens tracked when Claude reports them (every 5-10 messages)"
echo ""
echo "💡 Pro Tip:"
echo "   Ask Claude to 'report tokens to marionette' periodically for accurate tracking"
echo ""
echo "Instructions saved to: ~/.claude/marionette-instructions.md"
