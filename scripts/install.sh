#!/usr/bin/env bash
# Marionette one-liner installer for macOS and Linux
# Usage: curl -fsSL https://raw.githubusercontent.com/yarin-mag/Marionette/master/scripts/install.sh | bash
set -euo pipefail

REPO="yarin-mag/Marionette"
# Install into ~/.marionette/app — this is where the npm wrapper (@marionette-app/cli)
# always looks for the real binary, so both install paths stay in sync.
INSTALL_DIR="${HOME}/.marionette/app"

# ── Detect OS / arch ──────────────────────────────────────────────────────────
OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"

case "$OS" in
  darwin) OS="macos" ;;
  linux)  OS="linux" ;;
  *)      echo "Unsupported OS: $OS" >&2; exit 1 ;;
esac

case "$ARCH" in
  x86_64)  ARCH="x64" ;;
  arm64|aarch64) ARCH="arm64" ;;
  *)       echo "Unsupported architecture: $ARCH" >&2; exit 1 ;;
esac

PLATFORM="${OS}-${ARCH}"
echo "==> Installing Marionette for ${PLATFORM}"

# ── Verify Node.js version ────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo "Error: Node.js is not installed. Marionette requires Node.js 20." >&2
  echo "Install it: https://nodejs.org/en/download  or  nvm install 20" >&2
  exit 1
fi
NODE_MAJOR="$(node -e "console.log(parseInt(process.versions.node))" 2>/dev/null)"
if [ "$NODE_MAJOR" != "20" ]; then
  echo "Error: Marionette requires Node.js 20 (you have Node.js ${NODE_MAJOR})." >&2
  echo "The bundled better-sqlite3 native module is compiled for Node.js 20." >&2
  echo "Fix:  nvm install 20 && nvm use 20" >&2
  echo "      or download from https://nodejs.org/en/download" >&2
  exit 1
fi

# ── Fetch latest release tag ──────────────────────────────────────────────────
LATEST="$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" \
  | grep -o '"tag_name"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d '"' -f4)"

if [ -z "$LATEST" ]; then
  echo "Failed to fetch latest release. Check your internet connection or that ${REPO} has releases." >&2
  exit 1
fi

echo "==> Latest release: ${LATEST}"

URL="https://github.com/${REPO}/releases/download/${LATEST}/marionette-${PLATFORM}.tar.gz"

# ── Download & extract ────────────────────────────────────────────────────────
echo "==> Downloading ${URL}"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

curl -fsSL "$URL" | tar -xz -C "$TMP_DIR"

# ── Install ───────────────────────────────────────────────────────────────────
echo "==> Installing to ${INSTALL_DIR}"
rm -rf "$INSTALL_DIR"
mkdir -p "$(dirname "$INSTALL_DIR")"
mv "${TMP_DIR}/marionette" "$INSTALL_DIR"
chmod +x "${INSTALL_DIR}/bin/marionette"

echo "==> Installed! Running setup..."
"${INSTALL_DIR}/bin/marionette" setup

echo ""
echo "✓ Marionette is ready."
echo "  Dashboard: http://localhost:8787"
echo "  Start manually: marionette start"
echo ""
echo "IMPORTANT: ANTHROPIC_BASE_URL has been set to http://localhost:8788 in your shell config."
echo "  Claude Code will route API requests through the Marionette proxy."
echo "  The proxy starts automatically with 'marionette start'."
echo "  If the proxy is not running, Claude Code API calls will fail."
echo "  To stop using Marionette: marionette stop"
