# Marionette - Complete Setup Guide

One-command installation for the complete Marionette monitoring system.

## Quick Install

```bash
git clone https://github.com/your-org/marionette.git
cd marionette
./install.sh
```

This will:
1. ✅ Install all dependencies (backend, web app, scripts, database)
2. ✅ Build the Claude wrapper
3. ✅ Install wrapper globally (intercepts `claude` command)
4. ✅ Set up MCP servers
5. ✅ Initialize database
6. ✅ Configure environment variables
7. ✅ Start all services

## What Gets Installed

### 1. Claude Wrapper (scripts/)
- **Location**: `~/.local/bin/claude-wrapper` (or `/usr/local/bin/`)
- **Function**: Intercepts Claude CLI, captures conversations
- **Command**: `claude` → automatically uses wrapper

### 2. Backend Server (backend/)
- **Port**: 8080
- **Function**: WebSocket server, event storage, API
- **Auto-start**: Yes (via systemd or pm2)

### 3. Web Dashboard (web/)
- **Port**: 3000
- **Function**: Real-time monitoring UI
- **Auto-start**: Yes

### 4. Database (db/)
- **Type**: PostgreSQL or SQLite
- **Function**: Stores conversation history and events
- **Auto-init**: Yes

### 5. MCP Servers (mcp/)
- **Function**: Claude Code integrations
- **Config**: `~/.config/claude/mcp.json`
- **Auto-configure**: Yes

## Prerequisites

- **Node.js** 18+ (install via https://nodejs.org)
- **Git** (install via https://git-scm.com)
- **Claude CLI** (install via `npm install -g @anthropic-ai/claude`)
- **Optional**: PostgreSQL for production use

## Installation Steps

### 1. Clone Repository

```bash
git clone https://github.com/your-org/marionette.git
cd marionette
```

### 2. Run Installation Script

```bash
# Make installer executable
chmod +x install.sh

# Run installation
./install.sh
```

The installer will:
- Check prerequisites
- Install dependencies for all components
- Build the TypeScript wrapper
- Link the wrapper to intercept `claude` command
- Set up database schema
- Configure MCP servers
- Create systemd/pm2 services
- Start all services

### 3. Verify Installation

```bash
# Check wrapper is installed
which claude-wrapper
# Should show: /usr/local/bin/claude-wrapper (or ~/.local/bin/)

# Check services are running
./status.sh

# Or manually:
ps aux | grep marionette
```

### 4. Test the System

```bash
# Start a Claude conversation
claude chat

# You should see the wrapper banner:
[claude-wrapper] ═══════════════════════════════════════════════════
[claude-wrapper] Claude Wrapper - Conversation Capture Enabled
[claude-wrapper] ═══════════════════════════════════════════════════
```

Open dashboard at `http://localhost:3000` and verify:
- Your agent appears in "Active Agents"
- Conversation messages are being captured
- Events are streaming in real-time

## Installation Options

### Development Mode (No Background Services)

```bash
./install.sh --dev
```

This installs the wrapper and builds components, but doesn't start background services. You'll manually start components when needed.

### Production Mode (Systemd Services)

```bash
sudo ./install.sh --production
```

This installs everything as system services that start on boot.

### Custom Backend URL

```bash
BACKEND_URL=ws://your-server:8080 ./install.sh
```

### Skip Database Setup

```bash
./install.sh --no-db
```

## Manual Installation

If automatic installation fails, follow these steps:

### 1. Install Dependencies

```bash
# Root dependencies
npm install

# Backend dependencies
cd backend && npm install && cd ..

# Web dependencies
cd web && npm install && cd ..

# Scripts dependencies
cd scripts && npm install && cd ..
```

### 2. Build Wrapper

```bash
cd scripts
npm run build
npm link
cd ..
```

### 3. Verify Wrapper

```bash
which claude-wrapper
claude-wrapper --version
```

### 4. Set Up Database

```bash
cd db
# For PostgreSQL:
psql -U postgres -f schema.sql

# For SQLite:
sqlite3 marionette.db < schema.sql

cd ..
```

### 5. Configure Environment

Create `.env` files:

**backend/.env:**
```bash
PORT=8080
DATABASE_URL=postgresql://user:pass@localhost:5432/marionette
# OR for SQLite:
# DATABASE_URL=sqlite:../db/marionette.db
```

**web/.env:**
```bash
VITE_API_URL=http://localhost:8080
```

**scripts/.env:**
```bash
MARIONETTE_BACKEND_URL=ws://localhost:8080
```

### 6. Set Up MCP Servers

```bash
cd mcp
./setup-mcp.sh
cd ..
```

### 7. Start Services

```bash
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Web
cd web && npm run dev

# Terminal 3: Use Claude
claude chat
```

## Hooks Configuration

The wrapper integrates with Claude Code hooks automatically.

**Location**: `~/.config/claude/hooks/`

**Hooks added**:
- `pre-command`: Notifies Marionette before commands
- `post-command`: Captures command results
- `on-error`: Logs errors to Marionette

**Manual hook setup** (if needed):
```bash
cd scripts
./setup-hooks.sh
```

## MCP Servers Configuration

**Location**: `~/.config/claude/mcp.json`

**Servers added**:
- `marionette-monitor`: Real-time monitoring
- `marionette-history`: Conversation history
- `marionette-analytics`: Usage analytics

**Manual MCP setup** (if needed):
```bash
cd mcp
./configure-mcp.sh
```

## Uninstallation

```bash
# Run uninstall script
./uninstall.sh

# Or manually:
npm unlink claude-wrapper  # Remove wrapper
rm -rf ~/.config/claude/hooks/marionette  # Remove hooks
# Remove MCP servers from ~/.config/claude/mcp.json
# Stop and remove systemd/pm2 services
```

## Updating

```bash
# Pull latest changes
git pull origin main

# Run update script
./update.sh

# Or manually:
cd scripts && npm run build && npm link && cd ..
cd backend && npm install && cd ..
cd web && npm install && cd ..
```

## Troubleshooting

### Wrapper Not Found

```bash
# Check if linked
npm list -g | grep claude-wrapper

# Re-link
cd scripts && npm link
```

### Backend Not Starting

```bash
# Check logs
tail -f backend/logs/error.log

# Check port is free
lsof -i :8080

# Try different port
PORT=8081 npm run dev
```

### Database Connection Failed

```bash
# Check PostgreSQL is running
pg_isready

# Check connection string
cat backend/.env | grep DATABASE_URL

# Test connection
psql $DATABASE_URL
```

### Wrapper Not Intercepting Claude

```bash
# Check alias
alias claude

# Should show: claude='claude-wrapper'

# If not, add to shell config:
echo "alias claude='claude-wrapper'" >> ~/.zshrc
source ~/.zshrc
```

### MCP Servers Not Loading

```bash
# Check MCP config
cat ~/.config/claude/mcp.json

# Restart Claude Code
# (Close and reopen VS Code or terminal)
```

## Architecture

```
marionette/
├── install.sh           # Main installer
├── uninstall.sh         # Uninstaller
├── update.sh            # Updater
├── status.sh            # Check service status
├── SETUP.md             # This file
├── README.md            # Project overview
│
├── scripts/             # Claude wrapper
│   ├── src/             # TypeScript source
│   ├── dist/            # Compiled JavaScript
│   ├── setup-hooks.sh   # Hook installer
│   └── package.json
│
├── backend/             # WebSocket server & API
│   ├── src/
│   ├── package.json
│   └── .env
│
├── web/                 # React dashboard
│   ├── src/
│   ├── package.json
│   └── .env
│
├── db/                  # Database schemas
│   ├── schema.sql       # PostgreSQL schema
│   ├── schema.sqlite    # SQLite schema
│   └── migrations/
│
└── mcp/                 # MCP servers
    ├── monitor/         # Monitoring server
    ├── history/         # History server
    ├── analytics/       # Analytics server
    └── setup-mcp.sh     # MCP installer
```

## Support

- **Documentation**: See `docs/` directory
- **Issues**: https://github.com/your-org/marionette/issues
- **Discussions**: https://github.com/your-org/marionette/discussions

## Next Steps

After installation:
1. Read [Getting Started Guide](scripts/docs/guides/GETTING_STARTED.md)
2. Explore [Architecture Documentation](scripts/docs/architecture/OVERVIEW.md)
3. Try the [Development Guide](scripts/docs/guides/DEVELOPMENT.md)
4. Check out [API Reference](scripts/docs/api/EVENTS.md)
