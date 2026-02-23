# 🔧 Claude Wrapper - Quick Start Guide

## What Problem Does This Solve?

**Before Wrapper:**
```
❌ Claude process → Unknown PID
❌ No start/stop tracking
❌ Ambiguous agent identification (terminal + cwd)
❌ Multiple instances = confusion
❌ Can't tell which Claude is which
```

**With Wrapper:**
```
✅ Claude process → Known PID (12346)
✅ Wrapper PID tracked (12345)
✅ Unique session ID per instance
✅ Start/stop lifecycle events
✅ Clear naming: "Claude [PID 12346]"
✅ Perfect tracking in Marionette
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Terminal                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ $ claude
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   claude-wrapper.sh                         │
│  • Wrapper PID: 12345                                       │
│  • Session ID: wrapper_12345_1234567890                     │
│  • Sends: POST /api/agent-status {"status": "started"}     │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Launch Claude
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Claude CLI Process                       │
│  • Claude PID: 12346                                        │
│  • Tracked by wrapper                                       │
│  • Monitored via wait $PID                                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ On exit
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Cleanup Handler                          │
│  • Calculate duration                                       │
│  • Send: POST /api/agent-status {"status": "stopped"}      │
│  • Exit with Claude's exit code                            │
└─────────────────────────────────────────────────────────────┘
```

## Quick Install

### 1. Run Installer
```bash
cd /path/to/marionette
./scripts/install-wrapper.sh
```

### 2. Reload Shell
```bash
source ~/.zshrc  # or ~/.bashrc
```

### 3. Use Claude
```bash
claude
```

**That's it!** 🎉

## What You'll See

### Terminal Output
```bash
$ claude

[claude-wrapper] ═══════════════════════════════════════════════════
[claude-wrapper] Claude Wrapper - Process Tracking Enabled
[claude-wrapper] ═══════════════════════════════════════════════════
[claude-wrapper] Wrapper PID:       12345
[claude-wrapper] Session ID:        wrapper_12345_1709123456
[claude-wrapper] Terminal:          iTerm.app
[claude-wrapper] Working Directory: /Users/you/myproject
[claude-wrapper] Marionette API:     http://localhost:8787
[claude-wrapper] ═══════════════════════════════════════════════════
[claude-wrapper] Found Claude CLI at: /usr/local/bin/claude
[claude-wrapper] Starting Claude...
[claude-wrapper] Claude started with PID: 12346
[claude-wrapper] Monitoring Claude process (PID: 12346)...

# Claude runs normally here...

[claude-wrapper] Claude process ended (exit code: 0, duration: 180s)
```

### Marionette Dashboard
```
┌─────────────────────────────────────────────────────────┐
│ Agent: Claude [PID 12346]                    ● Working  │
├─────────────────────────────────────────────────────────┤
│ Session:    wrapper_12345_1709123456                    │
│ Wrapper:    PID 12345                                   │
│ Claude:     PID 12346                                   │
│ Terminal:   iTerm.app                                   │
│ Directory:  /Users/you/myproject                        │
│ Started:    2m ago                                      │
│ Hostname:   your-macbook.local                          │
├─────────────────────────────────────────────────────────┤
│ Status: 🟢 Active - Running tasks                       │
└─────────────────────────────────────────────────────────┘
```

## API Updates Flow

### 1. Wrapper Starts
```bash
POST /api/agent-status
{
  "wrapper_session_id": "wrapper_12345_1709123456",
  "wrapper_pid": 12345,
  "status": "wrapper_started",
  "terminal": "iTerm.app",
  "cwd": "/Users/you/myproject",
  "timestamp": "2024-01-20T10:30:00Z",
  "hostname": "your-macbook.local",
  "user": "yourname"
}
```

### 2. Claude Starts
```bash
POST /api/agent-status
{
  "wrapper_session_id": "wrapper_12345_1709123456",
  "wrapper_pid": 12345,
  "claude_pid": 12346,  # ← Now we know Claude's PID!
  "status": "started",
  "terminal": "iTerm.app",
  "cwd": "/Users/you/myproject",
  "timestamp": "2024-01-20T10:30:02Z"
}
```

### 3. Claude Stops
```bash
POST /api/agent-status
{
  "wrapper_session_id": "wrapper_12345_1709123456",
  "wrapper_pid": 12345,
  "claude_pid": 12346,
  "status": "stopped",
  "duration": 180,  # ← 3 minutes
  "exit_code": 0,
  "timestamp": "2024-01-20T10:33:02Z"
}
```

## Benefits for Your Use Case

### 🎯 Perfect Agent Identification
```bash
# Old way (ambiguous)
Agent ID: agent_terminal_cwd_hash

# New way (crystal clear)
Agent ID: wrapper_12345_1709123456
Display: Claude [PID 12346]
```

### 📊 Lifecycle Tracking
```bash
# You can now see:
✅ When Claude started (exact timestamp)
✅ When Claude stopped (exact timestamp)
✅ How long it ran (duration)
✅ Exit code (success/failure)
✅ Which terminal/directory
```

### 🔍 Process Management
```bash
# Find specific Claude instance
ps aux | grep 12346

# Kill specific instance if needed
kill 12346

# See process tree
pstree -p 12345
```

### 🚀 Multiple Claude Instances
```bash
# Terminal 1
claude  # → wrapper_12345_xxx, Claude PID 12346

# Terminal 2
claude  # → wrapper_12347_xxx, Claude PID 12348

# Dashboard shows BOTH clearly:
# 1. Claude [PID 12346] - Working on Feature X
# 2. Claude [PID 12348] - Working on Bug Y
```

## Configuration

### Custom Marionette URL
```bash
# Set in ~/.zshrc or ~/.bashrc
export MARIONETTE_API_URL="http://192.168.1.100:8787"
```

### Disable Wrapper (Use Real Claude)
```bash
# Temporarily
\claude

# Or use full path
/usr/local/bin/claude
```

## Troubleshooting

### "claude: command not found"
```bash
# Install Claude CLI first
# (wrapper requires Claude to be installed)
```

### Wrapper not sending updates
```bash
# Check if Marionette server is running
curl http://localhost:8787/health

# Wrapper fails silently - Claude still works
```

### Multiple instances conflicting
```bash
# Each wrapper instance is unique
# Check Session ID in wrapper output
# Dashboard shows all instances separately
```

## Advanced Features

### Monitor from Command Line
```bash
# Watch agents in real-time
watch -n 1 'curl -s http://localhost:8787/api/agents | jq'

# Get specific agent
curl http://localhost:8787/api/agents/wrapper_12345_1709123456 | jq
```

### Process Inspection
```bash
# See wrapper + Claude hierarchy
ps -f -p 12345  # Wrapper
ps -f --ppid 12345  # Claude (child of wrapper)

# Full process tree
pstree -p 12345
```

### Custom Agent Names
```bash
# Set before starting Claude
export MARIONETTE_AGENT_NAME="Feature: Authentication"
claude
# Shows as: "Feature: Authentication [PID 12346]"
```

## Comparison

| Feature | Without Wrapper | With Wrapper |
|---------|----------------|--------------|
| **PID Tracking** | ❌ No | ✅ Yes (wrapper + Claude) |
| **Unique ID** | ⚠️ Ambiguous | ✅ Guaranteed unique |
| **Start Time** | ⚠️ Approximate | ✅ Exact timestamp |
| **Stop Time** | ❌ Unknown | ✅ Exact timestamp |
| **Duration** | ❌ Not tracked | ✅ Calculated |
| **Exit Code** | ❌ Unknown | ✅ Captured |
| **Multiple Instances** | ⚠️ Confusing | ✅ Clear separation |
| **Process Control** | ❌ Hard to identify | ✅ Easy (know PID) |

## Implementation Details

### Files Created
```
marionette/scripts/
├── claude-wrapper.sh         # Main wrapper script
├── install-wrapper.sh        # Installation helper
├── README.md                 # Full documentation
└── WRAPPER_GUIDE.md         # This quick guide
```

### Server Changes
```typescript
// AgentsController - handles wrapper updates
if (wrapper_session_id) {
  // Use wrapper session as agent ID
  const agentId = wrapper_session_id;

  // Store PID metadata
  metadata = {
    wrapper_pid,
    claude_pid,
    hostname,
    user,
    display_name: `Claude [PID ${claude_pid}]`
  };

  // Create/update agent
}
```

## Next Steps

1. ✅ **Install wrapper**: `./scripts/install-wrapper.sh`
2. ✅ **Start Claude**: `claude`
3. ✅ **Open dashboard**: http://localhost:3000
4. ✅ **See your agent**: "Claude [PID xxxxx]"
5. 🎉 **Enjoy perfect tracking!**

---

**Questions?** See full docs in `scripts/README.md`
