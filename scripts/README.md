# Claude Wrapper - Process Tracking for Marionette

## Overview

The Claude Wrapper is a shell script that wraps the `claude` CLI command to provide enhanced process tracking for Marionette. It captures:

- **Process IDs (PIDs)**: Both wrapper and Claude process IDs
- **Lifecycle Events**: Start, stop, and duration tracking
- **Session Management**: Unique session IDs for each Claude instance
- **Terminal Information**: Terminal session, working directory, hostname
- **Real-time Updates**: Status updates sent to Marionette API

## Features

✅ **Process Lifecycle Tracking**
- Captures actual PIDs (wrapper + Claude process)
- Tracks start/stop timestamps
- Calculates session duration
- Monitors process exit codes

✅ **Enhanced Agent Identification**
- Unique wrapper session ID per instance
- Combines PID + timestamp for uniqueness
- No more ambiguous agent matching

✅ **Automatic Status Updates**
- Sends status to Marionette on start
- Updates on stop with duration
- Non-blocking (doesn't slow down Claude)

✅ **Terminal Integration**
- Works with bash, zsh, fish
- Simple alias installation
- No performance overhead

## Installation

### Quick Install

```bash
cd /path/to/marionette
./scripts/install-wrapper.sh
```

This will:
1. Detect your shell (bash/zsh/fish)
2. Add an alias to your shell config
3. Instructions to reload your shell

### Manual Install

Add to your `~/.zshrc` or `~/.bashrc`:

```bash
alias claude='/path/to/marionette/scripts/claude-wrapper.sh'
```

Then reload:
```bash
source ~/.zshrc  # or ~/.bashrc
```

## Usage

After installation, just use `claude` as normal:

```bash
# Start Claude with wrapper
claude

# The wrapper will:
# 1. Display tracking info
# 2. Start Claude
# 3. Send status updates to Marionette
# 4. Monitor until Claude exits
```

### Wrapper Output

```
[claude-wrapper] ═══════════════════════════════════════════════════
[claude-wrapper] Claude Wrapper - Process Tracking Enabled
[claude-wrapper] ═══════════════════════════════════════════════════
[claude-wrapper] Wrapper PID:       12345
[claude-wrapper] Session ID:        wrapper_12345_1234567890
[claude-wrapper] Terminal:          iTerm.app
[claude-wrapper] Working Directory: /Users/you/project
[claude-wrapper] Marionette API:     http://localhost:8787
[claude-wrapper] ═══════════════════════════════════════════════════
[claude-wrapper] Found Claude CLI at: /usr/local/bin/claude
[claude-wrapper] Starting Claude...
[claude-wrapper] Claude started with PID: 12346
[claude-wrapper] Monitoring Claude process (PID: 12346)...

# ... Claude runs normally ...

[claude-wrapper] Claude process ended (exit code: 0, duration: 120s)
```

## How It Works

### 1. Wrapper Starts
```bash
./claude-wrapper.sh
```
- Generates unique `wrapper_session_id`
- Captures wrapper PID
- Sends `wrapper_started` status to Marionette

### 2. Claude Launches
```bash
claude & # Background with PID capture
CLAUDE_PID=$!
```
- Launches Claude in background
- Captures Claude's actual PID
- Sends `started` status with PIDs to Marionette

### 3. Monitoring
```bash
wait $CLAUDE_PID
```
- Waits for Claude to complete
- Captures exit code
- Calculates duration

### 4. Cleanup
```bash
trap cleanup EXIT
```
- Automatically called on exit
- Sends `stopped` status with duration
- Reports exit code

## API Integration

The wrapper sends POST requests to:
```
POST /api/agent-status
```

### Payload Structure

```json
{
  "wrapper_session_id": "wrapper_12345_1234567890",
  "wrapper_pid": 12345,
  "claude_pid": 12346,
  "status": "started",
  "terminal": "iTerm.app",
  "cwd": "/Users/you/project",
  "timestamp": "2024-01-20T10:30:00Z",
  "hostname": "your-macbook.local",
  "user": "yourname"
}
```

### Status Values

- `wrapper_started` - Wrapper launched (before Claude starts)
- `started` - Claude process started
- `stopped` - Claude process ended

## Server Integration

The AgentsController handles wrapper updates:

```typescript
// Detects wrapper status updates
if (wrapper_session_id) {
  // Use wrapper_session_id as agent ID
  const effectiveAgentId = wrapper_session_id;

  // Store PID metadata
  await service.updateMetadata(effectiveAgentId, {
    wrapper_pid,
    claude_pid,
    hostname,
    user,
  });

  // Create agent with name "Claude [PID 12346]"
}
```

## Benefits

### Before Wrapper
❌ Agent ID based on terminal + cwd (ambiguous)
❌ No actual process tracking
❌ Can't distinguish multiple Claude instances
❌ No start/stop lifecycle events
❌ No duration tracking

### With Wrapper
✅ Unique session ID per instance
✅ Actual PIDs tracked (wrapper + Claude)
✅ Clear lifecycle (start → stop)
✅ Duration calculated automatically
✅ Better agent names: "Claude [PID 12346]"
✅ Perfect for debugging: "Which Claude instance is this?"

## Configuration

### Environment Variables

```bash
# Set custom Marionette URL
export MARIONETTE_API_URL="http://192.168.1.100:8787"

# Then use wrapper normally
claude
```

### Disable Wrapper Temporarily

```bash
# Use the real claude command directly
/usr/local/bin/claude

# Or unalias temporarily
\claude
```

## Troubleshooting

### Wrapper not found
```bash
# Check if wrapper exists
ls -l /path/to/marionette/scripts/claude-wrapper.sh

# Make sure it's executable
chmod +x /path/to/marionette/scripts/claude-wrapper.sh
```

### Alias not working
```bash
# Check if alias exists
alias claude

# If not, re-run installer
./scripts/install-wrapper.sh

# Reload shell
source ~/.zshrc
```

### Marionette not receiving updates
```bash
# Check if server is running
curl http://localhost:8787/health

# Check wrapper output for errors
# (wrapper fails silently by design to not break Claude)
```

## Uninstall

Remove the alias from your shell config:

```bash
# Edit your shell config
nano ~/.zshrc  # or ~/.bashrc

# Remove these lines:
# # Marionette - Claude Wrapper for process tracking
# alias claude='/path/to/marionette/scripts/claude-wrapper.sh'

# Reload shell
source ~/.zshrc
```

## Advanced Usage

### Custom Wrapper Script

Create your own wrapper based on `claude-wrapper.sh`:

```bash
#!/usr/bin/env bash
# my-custom-wrapper.sh

# Source the original wrapper
source /path/to/claude-wrapper.sh

# Add custom logic before/after
```

### Integration with Other Tools

The wrapper can be extended to:
- Send metrics to Prometheus
- Log to custom systems
- Trigger webhooks on start/stop
- Integrate with project management tools

## Technical Details

### Process Hierarchy

```
Terminal
└── Wrapper Process (PID: 12345)
    └── Claude Process (PID: 12346)
        └── MCP Server (subprocess)
            └── Tools, handlers, etc.
```

### Signal Handling

The wrapper handles:
- `EXIT` - Normal termination
- `INT` (Ctrl+C) - User interrupt
- `TERM` - Termination signal

All signals trigger the cleanup function.

### Non-Blocking Design

- Status updates use `curl` with short timeout
- Failures are silent (don't break Claude)
- No performance impact on Claude CLI

## Examples

### Start Claude with wrapper
```bash
claude
```

### View agent in dashboard
```bash
# Open dashboard
open http://localhost:3000

# You'll see: "Claude [PID 12346]"
# Click for full details including PIDs
```

### Monitor in real-time
```bash
# Watch agent updates
curl http://localhost:8787/api/agents | jq

# Filter by wrapper session
curl "http://localhost:8787/api/agents?wrapper_session_id=wrapper_12345_1234567890"
```

## Future Enhancements

Potential additions:
- [ ] Resource usage tracking (CPU/Memory)
- [ ] Network traffic monitoring
- [ ] Token usage from wrapper level
- [ ] Multiple Claude instance management
- [ ] Wrapper dashboard UI
- [ ] Process tree visualization

## Contributing

To improve the wrapper:
1. Edit `scripts/claude-wrapper.sh`
2. Test with: `./scripts/claude-wrapper.sh`
3. Submit PR with improvements

## License

Part of the Marionette project.
