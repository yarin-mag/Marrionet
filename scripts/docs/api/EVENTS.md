# Event Catalog

Complete reference for all event types emitted by the Claude Wrapper.

## Table of Contents

- [Overview](#overview)
- [Event Structure](#event-structure)
- [Outgoing Events](#outgoing-events) (Wrapper → Backend)
- [Incoming Events](#incoming-events) (Backend → Wrapper)
- [Event Schemas](#event-schemas)
- [Event Timing](#event-timing)
- [Event Size Optimization](#event-size-optimization)

## Overview

The Claude Wrapper emits 15+ event types to provide comprehensive monitoring of Claude CLI sessions. All events are JSON-serialized and sent over WebSocket.

### Event Categories

1. **Lifecycle Events** - Agent start/stop, session management
2. **Conversation Events** - User messages and Claude responses
3. **Monitoring Events** - Process, network, filesystem, performance
4. **Heartbeat Events** - Keep-alive and health checks

## Event Structure

All events share a common base structure:

```typescript
interface BaseEvent {
  type: string;           // Event type identifier
  timestamp: number;      // Unix timestamp (milliseconds)
  agentId: string;        // Unique agent ID
  sessionId: string;      // Unique session ID
}
```

## Outgoing Events

Events sent from wrapper to backend.

### 1. Agent Started

Emitted when wrapper successfully starts and connects to backend.

```typescript
interface AgentStartedEvent extends BaseEvent {
  type: 'agent_started';
  wrapperPid: number;         // Wrapper process ID
  terminal: {
    shell: string;            // Shell type (bash, zsh, etc.)
    cwd: string;              // Current working directory
  };
}
```

**Example**:
```json
{
  "type": "agent_started",
  "timestamp": 1234567890000,
  "agentId": "agent_1234567890_abc123",
  "sessionId": "session_1234567890_def456",
  "wrapperPid": 12345,
  "terminal": {
    "shell": "zsh",
    "cwd": "/home/user/project"
  }
}
```

**When**: During startup, after WebSocket connection established
**Frequency**: Once per wrapper session
**Size**: ~200 bytes

---

### 2. Conversation Started

Emitted after agent started, signals beginning of conversation.

```typescript
interface ConversationStartedEvent extends BaseEvent {
  type: 'conversation_started';
}
```

**Example**:
```json
{
  "type": "conversation_started",
  "timestamp": 1234567890100,
  "agentId": "agent_1234567890_abc123",
  "sessionId": "session_1234567890_def456"
}
```

**When**: Immediately after agent_started
**Frequency**: Once per wrapper session
**Size**: ~100 bytes

---

### 3. Conversation Turn

Emitted for each user message or Claude response.

```typescript
interface ConversationTurnEvent extends BaseEvent {
  type: 'conversation_turn';
  turn: {
    id: string;              // Message ID
    role: 'user' | 'assistant';
    content: string;          // Message text
    timestamp: number;        // Message timestamp
    source: 'terminal' | 'web';  // Origin of message
  };
}
```

**Example**:
```json
{
  "type": "conversation_turn",
  "timestamp": 1234567891000,
  "agentId": "agent_1234567890_abc123",
  "sessionId": "session_1234567890_def456",
  "turn": {
    "id": "msg_1234567891_xyz789",
    "role": "user",
    "content": "Hello, can you help me?",
    "timestamp": 1234567891000,
    "source": "terminal"
  }
}
```

**When**: After each user input or Claude response
**Frequency**: 2-100+ times per conversation
**Size**: ~200-5000 bytes (varies with message length)

---

### 4. Agent Heartbeat

Periodic health check with uptime and memory stats.

```typescript
interface AgentHeartbeatEvent extends BaseEvent {
  type: 'agent_heartbeat';
  uptimeSeconds: number;    // Uptime since wrapper started
  memoryBytes: number;      // Heap memory usage
}
```

**Example**:
```json
{
  "type": "agent_heartbeat",
  "timestamp": 1234567920000,
  "agentId": "agent_1234567890_abc123",
  "sessionId": "session_1234567890_def456",
  "uptimeSeconds": 30,
  "memoryBytes": 45678901
}
```

**When**: Every 30 seconds (configurable)
**Frequency**: ~2 per minute
**Size**: ~120 bytes

---

### 5. Process Spawned

Emitted when Claude wrapper detects a child process spawn.

```typescript
interface ProcessSpawnedEvent extends BaseEvent {
  type: 'process_spawned';
  process: {
    pid: number;             // Process ID
    command: string;         // Command name
    args: string[];          // Command arguments
  };
}
```

**Example**:
```json
{
  "type": "process_spawned",
  "timestamp": 1234567891500,
  "agentId": "agent_1234567890_abc123",
  "sessionId": "session_1234567890_def456",
  "process": {
    "pid": 12346,
    "command": "git",
    "args": ["status"]
  }
}
```

**When**: Whenever `child_process.spawn()` is called
**Frequency**: Variable (0-100+ per session)
**Size**: ~150-500 bytes

---

### 6. Process Exited

Emitted when a monitored process exits.

```typescript
interface ProcessExitedEvent extends BaseEvent {
  type: 'process_exited';
  pid: number;              // Process ID
  exitCode: number | null;  // Exit code (null if killed)
  signal: string | null;    // Signal if killed
}
```

**Example**:
```json
{
  "type": "process_exited",
  "timestamp": 1234567892000,
  "agentId": "agent_1234567890_abc123",
  "sessionId": "session_1234567890_def456",
  "pid": 12346,
  "exitCode": 0,
  "signal": null
}
```

**When**: When monitored process exits
**Frequency**: Matches process_spawned frequency
**Size**: ~120 bytes

---

### 7. Network Request

Emitted when HTTP/HTTPS request is made.

```typescript
interface NetworkRequestEvent extends BaseEvent {
  type: 'network_request';
  request: {
    method: string;          // GET, POST, etc.
    url: string;             // Full URL
    headers: Record<string, string>;
  };
}
```

**Example**:
```json
{
  "type": "network_request",
  "timestamp": 1234567891200,
  "agentId": "agent_1234567890_abc123",
  "sessionId": "session_1234567890_def456",
  "request": {
    "method": "POST",
    "url": "https://api.anthropic.com/v1/messages",
    "headers": {
      "content-type": "application/json",
      "anthropic-version": "2023-06-01"
    }
  }
}
```

**When**: When http/https request is initiated
**Frequency**: Variable (10-100+ per session for API calls)
**Size**: ~300-1000 bytes

---

### 8. Network Response

Emitted when HTTP/HTTPS response is received.

```typescript
interface NetworkResponseEvent extends BaseEvent {
  type: 'network_response';
  response: {
    statusCode: number;      // HTTP status code
    url: string;             // Request URL
    durationMs: number;      // Request duration
  };
}
```

**Example**:
```json
{
  "type": "network_response",
  "timestamp": 1234567891800,
  "agentId": "agent_1234567890_abc123",
  "sessionId": "session_1234567890_def456",
  "response": {
    "statusCode": 200,
    "url": "https://api.anthropic.com/v1/messages",
    "durationMs": 589
  }
}
```

**When**: When http/https response completes
**Frequency**: Matches network_request frequency
**Size**: ~150-300 bytes

---

### 9. Network Error

Emitted when HTTP/HTTPS request fails.

```typescript
interface NetworkErrorEvent extends BaseEvent {
  type: 'network_error';
  error: {
    message: string;         // Error message
    code: string;            // Error code
    url: string;             // Request URL
  };
}
```

**Example**:
```json
{
  "type": "network_error",
  "timestamp": 1234567891900,
  "agentId": "agent_1234567890_abc123",
  "sessionId": "session_1234567890_def456",
  "error": {
    "message": "ECONNREFUSED",
    "code": "ERR_CONNECTION_REFUSED",
    "url": "https://api.example.com"
  }
}
```

**When**: When http/https request fails
**Frequency**: Rare (0-5 per session typically)
**Size**: ~200-400 bytes

---

### 10. Filesystem Change

Emitted when filesystem changes are detected.

```typescript
interface FilesystemChangeEvent extends BaseEvent {
  type: 'filesystem_change';
  change: {
    type: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir';
    path: string;            // File/directory path
  };
}
```

**Example**:
```json
{
  "type": "filesystem_change",
  "timestamp": 1234567892500,
  "agentId": "agent_1234567890_abc123",
  "sessionId": "session_1234567890_def456",
  "change": {
    "type": "change",
    "path": "/home/user/project/index.ts"
  }
}
```

**When**: When files/directories are created, modified, or deleted
**Frequency**: Variable (0-1000+ per session)
**Size**: ~150-300 bytes

---

### 11. Performance Stats

Emitted periodically with CPU and memory stats.

```typescript
interface PerformanceStatsEvent extends BaseEvent {
  type: 'performance_stats';
  stats: {
    cpu: number;             // CPU percentage (0-100)
    memory: number;          // Memory bytes
    elapsed: number;         // Time since last stat (ms)
  };
}
```

**Example**:
```json
{
  "type": "performance_stats",
  "timestamp": 1234567920000,
  "agentId": "agent_1234567890_abc123",
  "sessionId": "session_1234567890_def456",
  "stats": {
    "cpu": 2.5,
    "memory": 45678901,
    "elapsed": 30000
  }
}
```

**When**: Every 30 seconds (configurable)
**Frequency**: ~2 per minute
**Size**: ~140 bytes

---

### 12. Conversation Ended

Emitted when wrapper is shutting down gracefully.

```typescript
interface ConversationEndedEvent extends BaseEvent {
  type: 'conversation_ended';
}
```

**Example**:
```json
{
  "type": "conversation_ended",
  "timestamp": 1234567999999,
  "agentId": "agent_1234567890_abc123",
  "sessionId": "session_1234567890_def456"
}
```

**When**: During graceful shutdown
**Frequency**: Once per wrapper session
**Size**: ~100 bytes

---

### 13. Agent Stopped

Emitted when wrapper process is terminating.

```typescript
interface AgentStoppedEvent extends BaseEvent {
  type: 'agent_stopped';
}
```

**Example**:
```json
{
  "type": "agent_stopped",
  "timestamp": 1234568000000,
  "agentId": "agent_1234567890_abc123",
  "sessionId": "session_1234567890_def456"
}
```

**When**: During shutdown, after conversation_ended
**Frequency**: Once per wrapper session
**Size**: ~100 bytes

---

## Incoming Events

Events sent from backend to wrapper.

### 1. Inject Message

Backend can inject a message to Claude as if user typed it.

```typescript
interface InjectMessageEvent {
  type: 'inject_message';
  content: string;           // Message to inject
}
```

**Example**:
```json
{
  "type": "inject_message",
  "content": "Please summarize the conversation so far."
}
```

**When**: Backend wants to inject command
**Frequency**: Rare (on-demand)
**Size**: ~100-1000 bytes

---

## Event Timing

### Startup Sequence

```
0ms:    agent_started
+10ms:  conversation_started
+50ms:  (user types message)
+60ms:  conversation_turn (user)
+500ms: (Claude responds)
+1000ms: conversation_turn (assistant)
...
30000ms: agent_heartbeat
30000ms: performance_stats
```

### Shutdown Sequence

```
0ms:    (SIGINT received)
+10ms:  conversation_ended
+20ms:  agent_stopped
+30ms:  (process exits)
```

## Event Size Optimization

### Current Sizes

| Event Type | Typical Size | Max Size |
|-----------|--------------|----------|
| agent_started | ~200 bytes | ~500 bytes |
| conversation_turn | ~500 bytes | ~10KB |
| agent_heartbeat | ~120 bytes | ~150 bytes |
| process_spawned | ~300 bytes | ~1KB |
| network_request | ~500 bytes | ~2KB |
| filesystem_change | ~200 bytes | ~500 bytes |
| performance_stats | ~140 bytes | ~180 bytes |

### Optimization Strategies

1. **Message Truncation**: Limit conversation_turn content to 10KB
2. **Header Filtering**: Only send essential HTTP headers
3. **Path Truncation**: Use relative paths for filesystem events
4. **Batching**: Send multiple events in single WebSocket frame (future)
5. **Compression**: Enable WebSocket compression (future)

## Next Steps

- **[Interfaces Reference](INTERFACES.md)** - Interface contracts
- **[Types Reference](TYPES.md)** - Type definitions
- **[Configuration Reference](CONFIG.md)** - Configuration options
