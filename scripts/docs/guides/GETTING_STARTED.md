# Getting Started

## Quick Start

Get up and running with the Marionette Claude Wrapper in minutes.

## Prerequisites

- **Node.js** 18.0.0 or higher
- **Claude CLI** installed and configured
- **Marionette Backend** running (optional for basic testing)

## Installation

### Option 1: NPM Link (Development)

```bash
# Navigate to scripts directory
cd /path/to/marionette/scripts

# Install dependencies
npm install

# Build TypeScript
npm run build

# Link globally
npm link

# Verify installation
claude-wrapper --version
```

### Option 2: Direct Installation

```bash
# Install as global package
npm install -g /path/to/marionette/scripts

# Verify installation
claude-wrapper --version
```

## Configuration

### Environment Variables

Set these environment variables to configure the wrapper:

```bash
# Required: Backend WebSocket URL
export MARIONETTE_BACKEND_URL="ws://localhost:8080"

# Optional: Use legacy JavaScript wrapper
export MARIONETTE_USE_LEGACY="false"

# Optional: Enable debug logging
export DEBUG="marionette:*"
```

### Shell Alias (Recommended)

Add to your `.bashrc`, `.zshrc`, or equivalent:

```bash
# Wrap Claude CLI with Marionette monitoring
alias claude='claude-wrapper'
```

After reloading your shell, running `claude` will automatically use the wrapper.

## First Run

### 1. Start Marionette Backend (Optional)

```bash
# In a separate terminal
cd /path/to/marionette/backend
npm run dev
```

The backend should be running on `http://localhost:8080`.

### 2. Run Claude with Wrapper

```bash
# With wrapper
claude chat

# Or directly
node /path/to/marionette/scripts/dist/index.js chat
```

You should see the startup banner:

```
[claude-wrapper] ═══════════════════════════════════════════════════
[claude-wrapper] Claude Wrapper - Conversation Capture Enabled
[claude-wrapper] ═══════════════════════════════════════════════════
[claude-wrapper] Agent ID:          agent_1234567890_abc123
[claude-wrapper] Session ID:        session_1234567890_def456
[claude-wrapper] Wrapper PID:       12345
[claude-wrapper] Terminal:          zsh
[claude-wrapper] Working Directory: /home/user/project
[claude-wrapper] Marionette:         ws://localhost:8080
[claude-wrapper] ═══════════════════════════════════════════════════
```

### 3. Verify in Dashboard

Open `http://localhost:3000` (or your dashboard URL) and verify:
- Agent appears in active agents list
- Conversation messages are being captured
- Monitoring events are streaming

## Basic Usage

### Normal Conversation

```bash
$ claude chat
> Hello, can you help me write a function?

# Your conversation will be captured and streamed to Marionette
```

### With Arguments

```bash
# Use specific model
claude chat --model opus

# Run a specific command
claude code-review file.ts

# Any Claude CLI command works
claude --help
```

### Passthrough Mode

If the backend is unavailable, the wrapper automatically falls back to passthrough mode:

```
[claude-wrapper] ⚠ Failed to connect to Marionette backend
[claude-wrapper] ⚠ Running in passthrough mode (no monitoring)
```

Claude CLI will function normally, but conversations won't be captured.

## Verification

### Check Wrapper is Active

```bash
# In your terminal, look for the startup banner
# OR check process tree
ps aux | grep claude-wrapper

# You should see the wrapper process
```

### Check Backend Connection

```bash
# Look for success message
[claude-wrapper] ✓ Connected to Marionette backend

# Check WebSocket connections in backend logs
```

### Check Events are Flowing

In the Marionette dashboard:
1. Navigate to "Active Agents"
2. Find your agent by Agent ID
3. View real-time conversation and events

## Troubleshooting

### Wrapper Not Starting

**Problem**: `claude-wrapper: command not found`

**Solution**:
```bash
# Verify npm link
npm link

# Or use full path
node /path/to/scripts/dist/index.js
```

**Problem**: `Cannot find module 'chalk'`

**Solution**:
```bash
cd /path/to/scripts
npm install
npm run build
```

### Connection Issues

**Problem**: `WebSocket connection timeout`

**Solution**:
1. Verify backend is running: `curl http://localhost:8080/health`
2. Check firewall settings
3. Verify `MARIONETTE_BACKEND_URL` environment variable
4. Try with explicit URL: `MARIONETTE_BACKEND_URL=ws://localhost:8080 claude chat`

**Problem**: Wrapper falls back to passthrough mode

**Solution**: This is expected when backend is unavailable. The wrapper will work, but without monitoring. Fix backend connectivity to enable monitoring.

### Performance Issues

**Problem**: Claude feels slower with wrapper

**Solution**:
- Check CPU usage: `top` or `htop`
- Verify < 1% CPU usage for wrapper
- Check memory usage: should be < 50MB
- If issues persist, try legacy wrapper: `MARIONETTE_USE_LEGACY=true claude chat`

**Problem**: High memory usage

**Solution**:
- Check for long-running sessions (memory grows slightly over time)
- Restart wrapper periodically for very long sessions
- Report issue if memory > 100MB

## Next Steps

- **[Development Guide](DEVELOPMENT.md)** - Learn about the development workflow
- **[Architecture Overview](../architecture/OVERVIEW.md)** - Understand system design
- **[API Reference](../api/EVENTS.md)** - Explore event types
- **[Debugging Guide](DEBUGGING.md)** - Debug issues effectively

## Quick Reference

```bash
# Install
npm install && npm run build && npm link

# Configure
export MARIONETTE_BACKEND_URL="ws://localhost:8080"

# Use
claude chat

# Test
npm run test

# Lint
npm run lint

# Format
npm run format

# Benchmark
npm run bench:startup
```

## Getting Help

- **Documentation**: Read [docs/README.md](../README.md)
- **Issues**: Report at [GitHub Issues](https://github.com/your-org/marionette/issues)
- **Discussions**: Ask at [GitHub Discussions](https://github.com/your-org/marionette/discussions)
