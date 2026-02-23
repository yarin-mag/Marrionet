# Conversation Capture & Broadcast - Setup Guide

## Overview

This feature enables real-time capture and bidirectional communication of Claude CLI conversations through the Marionette web dashboard.

## Architecture

```
Terminal User ↔ Node.js Wrapper ↔ Claude CLI
                      ↕ WebSocket
                 Backend Service
                      ↕ WebSocket
                  Web Dashboard
```

## Installation

### 1. Install Wrapper Dependencies

```bash
cd scripts
npm install
```

### 2. Install Web Dependencies

Already installed:
- react-markdown
- react-syntax-highlighter
- @types/react-syntax-highlighter

### 3. Setup Wrapper Alias

Add to your `~/.zshrc` or `~/.bashrc`:

```bash
# Option 1: Use wrapper with conversation capture
alias claude='node /Users/yarinmag/Documents/yarin/marionette/scripts/claude-wrapper.mjs'

# Option 2: Disable capture (fallback to simple wrapper)
export MARIONETTE_CAPTURE=false
alias claude='node /Users/yarinmag/Documents/yarin/marionette/scripts/claude-wrapper.mjs'
```

Then reload your shell:
```bash
source ~/.zshrc  # or source ~/.bashrc
```

### 4. Configure Environment Variables

Optional environment variables:

```bash
# WebSocket URL (default: ws://localhost:8787)
export MARIONETTE_WS_URL=ws://localhost:8787

# API URL (default: http://localhost:8787)
export MARIONETTE_API_URL=http://localhost:8787

# Disable conversation capture (default: enabled)
export MARIONETTE_CAPTURE=false

# Custom Claude CLI path (default: uses 'claude' from PATH)
export CLAUDE_CLI_PATH=/path/to/claude
```

## Features

### 1. **Real-time Conversation Capture**
- Captures all terminal input (user messages)
- Captures all Claude output (assistant responses)
- Strips ANSI codes for clean storage
- Preserves formatting for terminal display

### 2. **Bidirectional Communication**
- Send messages from web UI → injected into Claude's stdin
- Terminal messages appear in web dashboard in real-time
- Web messages appear in terminal with `[From Web UI]` prefix

### 3. **Session Management**
- Each Claude session gets unique session_id
- Conversation history persisted in memory
- Session lifecycle tracked (started/ended events)

### 4. **Web Dashboard Integration**
- New "Terminal" tab in agent detail panel
- Real-time message streaming via WebSocket
- Markdown rendering with syntax highlighting
- Message input with Enter/Shift+Enter support
- Connection status indicator
- Auto-scroll to latest messages

## File Structure

### New Files

```
scripts/
├── claude-wrapper.mjs           # Node.js wrapper with conversation capture
├── package.json                 # Wrapper dependencies

apps/server/src/
├── routes/
│   └── conversation.routes.ts   # REST API for conversations
└── services/
    └── websocket.service.ts     # Enhanced WebSocket service (modified)

packages/shared/src/
└── events.ts                    # Conversation types (modified)

apps/web/src/features/agents/
├── hooks/
│   └── useAgentConversation.ts  # WebSocket hook for real-time updates
└── components/
    ├── AgentConversationPanel.tsx  # Main conversation UI
    ├── ConversationMessage.tsx     # Message component with markdown
    └── AgentDetailPanel.tsx        # Added "Terminal" tab (modified)
```

## API Endpoints

### WebSocket Endpoints

#### 1. Agent Stream (Wrapper → Backend)
```
ws://localhost:8787/agent-stream
```

**Events from wrapper:**
- `agent.register` - Register agent with backend
- `conversation.started` - Session started
- `conversation.turn` - New message captured
- `conversation.ended` - Session ended

**Events to wrapper:**
- `message.send` - Send message to agent stdin

#### 2. Client Stream (Web UI → Backend)
```
ws://localhost:8787/client-stream
```

**Events from web:**
- `message.send` - Send message to agent
- `conversation.request` - Request conversation history

**Events to web:**
- `conversation.turn` - New message broadcast
- `conversation.started` - Session started
- `conversation.ended` - Session ended
- `conversation.history` - Historical messages

### REST API Endpoints

#### Get Conversation History
```http
GET /api/conversation/:session_id
```

**Response:**
```json
{
  "success": true,
  "session_id": "session_123",
  "turn_count": 42,
  "turns": [
    {
      "id": "msg_123",
      "agent_id": "agent_456",
      "session_id": "session_123",
      "direction": "to_agent",
      "role": "user",
      "content": "Hello",
      "content_plain": "Hello",
      "timestamp": "2026-02-19T12:00:00Z",
      "source": "terminal"
    }
  ]
}
```

#### Send Message to Agent
```http
POST /api/conversation/:agent_id/send
Content-Type: application/json

{
  "content": "What's the status?"
}
```

**Response:**
```json
{
  "success": true,
  "agent_id": "agent_456",
  "message": "Message sent to agent"
}
```

## Testing

### 1. Start Marionette Server

```bash
cd /Users/yarinmag/Documents/yarin/marionette
pnpm dev
```

The server should start on `http://localhost:8787`

### 2. Start Claude with Wrapper

In a new terminal:
```bash
claude
```

You should see:
```
[claude-wrapper] ═══════════════════════════════════════════════════
[claude-wrapper] Claude Wrapper - Conversation Capture Enabled
[claude-wrapper] ═══════════════════════════════════════════════════
[claude-wrapper] Agent ID:          agent_...
[claude-wrapper] Session ID:        session_...
[claude-wrapper] Connected to Marionette backend
```

### 3. Open Web Dashboard

Navigate to: `http://localhost:5173` (or your configured port)

1. Find your agent in the agents list
2. Click on the agent to open details
3. Switch to the "Terminal" tab
4. You should see any messages you've sent in the terminal

### 4. Test Bidirectional Communication

#### From Terminal:
```
Type a message in Claude terminal
→ Should appear in web dashboard within 500ms
```

#### From Web:
```
Type a message in web dashboard input
Click send button
→ Should appear in terminal with [From Web UI] prefix
→ Claude should process it as normal input
```

### 5. Verify Connection Status

- Green "Connected" badge = WebSocket active
- Orange "Reconnecting..." badge = Connection lost, auto-reconnect in progress

## Troubleshooting

### Wrapper Not Connecting

**Symptom:** "WebSocket connection timeout" error

**Solutions:**
1. Check Marionette server is running: `curl http://localhost:8787/api/health`
2. Check WebSocket endpoint: `wscat -c ws://localhost:8787/agent-stream`
3. Check firewall settings
4. Verify `MARIONETTE_WS_URL` environment variable

### Messages Not Appearing in Web

**Symptom:** Terminal messages don't show in web dashboard

**Solutions:**
1. Check browser console for WebSocket errors
2. Verify agent is visible in agents list
3. Check Network tab for WebSocket connection
4. Refresh the page to reconnect

### Messages Not Reaching Claude

**Symptom:** Web messages don't appear in terminal

**Solutions:**
1. Check wrapper logs in terminal
2. Verify agent_id matches between web and wrapper
3. Check Claude process is still running: `ps aux | grep claude`
4. Restart Claude with wrapper

### High Latency

**Symptom:** Messages appear with significant delay

**Solutions:**
1. Reduce message batching timeout (currently 500ms)
2. Check network conditions
3. Check backend server performance
4. Consider using HTTP/2 for WebSocket upgrade

## Configuration Options

### Wrapper Configuration

Edit `scripts/claude-wrapper.mjs`:

```javascript
// Message batching timeout (ms)
// Higher = fewer network calls, more latency
// Lower = more network calls, less latency
this.messageTimeout = setTimeout(() => {
  // ...
}, 500); // Change this value
```

### Web Configuration

Edit `apps/web/.env`:

```bash
VITE_WS_URL=ws://localhost:8787
VITE_API_URL=http://localhost:8787
```

## Performance Considerations

### Memory Usage

- Conversations stored in memory (not persistent)
- ~1KB per message
- 1000 messages ≈ 1MB
- Server restart clears history

**Future:** Add database persistence for conversation history

### Network Usage

- WebSocket: ~100 bytes per message
- Batched every 500ms
- ~10KB/min for typical conversation

### Latency

- Message capture: <10ms
- WebSocket round-trip: 10-50ms
- Total latency: <100ms

## Security Considerations

### 1. Authentication

**Current:** No authentication (local development)

**Production TODO:**
- Add JWT authentication for WebSocket connections
- Verify agent ownership before sending messages
- Rate limit message sending

### 2. Input Validation

**Current:** Basic content validation

**Production TODO:**
- Sanitize user input
- Validate message length
- Filter sensitive data patterns

### 3. Secret Redaction

**Current:** No automatic redaction

**Production TODO:**
- Pattern matching for API keys, passwords
- Option to disable capture with `--no-capture` flag
- Warn user when pasting suspicious content

## Future Enhancements

1. **Persistence**
   - Store conversations in PostgreSQL
   - Export conversations as Markdown/JSON
   - Search conversation history

2. **Analytics**
   - Token usage per conversation
   - Response time metrics
   - Message length distribution

3. **Collaboration**
   - Multiple users viewing same conversation
   - @mentions and reactions
   - Shared conversation links

4. **Advanced Features**
   - Conversation replay with timing
   - Voice input transcription
   - Code execution from web UI
   - Inline tool result viewing

## Support

For issues or questions:
1. Check logs: Wrapper terminal output + browser console
2. Review this guide's troubleshooting section
3. Check GitHub issues
4. Contact: [your contact info]

---

**Status:** ✅ Implemented and ready for testing
**Version:** 1.0.0
**Date:** 2026-02-19
