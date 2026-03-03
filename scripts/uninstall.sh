#!/usr/bin/env bash
# Marionette uninstaller for macOS and Linux
# Usage: bash scripts/uninstall.sh
#   or one-liner: curl -fsSL https://raw.githubusercontent.com/yarin-mag/Marrionet/master/scripts/uninstall.sh | bash
set -euo pipefail

INSTALL_DIR="/usr/local/lib/marionette"
BIN_LINK="/usr/local/bin/marionette"
CLAUDE_DIR="$HOME/.claude"
MCP_SETTINGS="$CLAUDE_DIR/mcp_settings.json"
SETTINGS="$CLAUDE_DIR/settings.json"
LOGS_DIR="$HOME/.marionette"

OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
case "$OS" in
  darwin) OS="macos" ;;
  linux)  OS="linux" ;;
  *)      echo "Unsupported OS: $OS" >&2; exit 1 ;;
esac

echo "==> Uninstalling Marionette..."

# ── 1. Stop and remove auto-start ─────────────────────────────────────────────
if [ "$OS" = "macos" ]; then
  APP_PLIST="$HOME/Library/LaunchAgents/com.marionette.app.plist"
  PROXY_PLIST="$HOME/Library/LaunchAgents/com.marionette.proxy.plist"
  if [ -f "$APP_PLIST" ]; then
    launchctl unload "$APP_PLIST" 2>/dev/null || true
    rm -f "$APP_PLIST"
    echo "==> Removed LaunchAgent: com.marionette.app"
  fi
  if [ -f "$PROXY_PLIST" ]; then
    launchctl unload "$PROXY_PLIST" 2>/dev/null || true
    rm -f "$PROXY_PLIST"
    echo "==> Removed LaunchAgent: com.marionette.proxy"
  fi
elif [ "$OS" = "linux" ]; then
  systemctl --user disable --now marionette 2>/dev/null || true
  systemctl --user disable --now marionette-proxy 2>/dev/null || true
  SYSTEMD_DIR="$HOME/.config/systemd/user"
  rm -f "$SYSTEMD_DIR/marionette.service" "$SYSTEMD_DIR/marionette-proxy.service"
  systemctl --user daemon-reload 2>/dev/null || true
  echo "==> Removed systemd user services"
fi

# ── 2. Remove ANTHROPIC_BASE_URL from shell rc files ──────────────────────────
MARKER="# Added by Marionette"
ENV_LINE='export ANTHROPIC_BASE_URL="http://localhost:8788"'
for RC in "$HOME/.zshrc" "$HOME/.bashrc" "$HOME/.bash_profile"; do
  if [ -f "$RC" ] && grep -qF "$ENV_LINE" "$RC"; then
    perl -i -0pe "s/\n?\Q${MARKER}\E\n\Q${ENV_LINE}\E\n?//g" "$RC"
    echo "==> Removed ANTHROPIC_BASE_URL from $RC"
  fi
done

# ── 3. Remove MCP server registration ─────────────────────────────────────────
if [ -f "$MCP_SETTINGS" ] && command -v node &>/dev/null; then
  node -e "
    const fs = require('fs');
    const p = process.argv[1];
    try {
      const cfg = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (cfg.mcpServers && cfg.mcpServers.marionette) {
        delete cfg.mcpServers.marionette;
        fs.writeFileSync(p, JSON.stringify(cfg, null, 2));
        console.log('==> Removed marionette MCP server from ' + p);
      }
    } catch (e) {}
  " "$MCP_SETTINGS"
fi

# ── 4. Remove hooks from Claude Code settings ──────────────────────────────────
if [ -f "$SETTINGS" ] && command -v node &>/dev/null; then
  node -e "
    const fs = require('fs');
    const p = process.argv[1];
    try {
      const cfg = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (cfg.hooks) {
        ['PreToolUse', 'Stop', 'Notification'].forEach(k => delete cfg.hooks[k]);
        if (Object.keys(cfg.hooks).length === 0) delete cfg.hooks;
        fs.writeFileSync(p, JSON.stringify(cfg, null, 2));
        console.log('==> Removed Marionette hooks from ' + p);
      }
    } catch (e) {}
  " "$SETTINGS"
fi

# ── 5. Remove binary symlink and install directory ────────────────────────────
if [ -L "$BIN_LINK" ] || [ -f "$BIN_LINK" ]; then
  sudo rm -f "$BIN_LINK"
  echo "==> Removed $BIN_LINK"
fi
if [ -d "$INSTALL_DIR" ]; then
  sudo rm -rf "$INSTALL_DIR"
  echo "==> Removed $INSTALL_DIR"
fi

# ── 6. Remove logs directory ───────────────────────────────────────────────────
if [ -d "$LOGS_DIR" ]; then
  rm -rf "$LOGS_DIR"
  echo "==> Removed $LOGS_DIR"
fi

echo ""
echo "✓ Marionette has been uninstalled."
echo "  Restart your terminal for shell changes to take effect."