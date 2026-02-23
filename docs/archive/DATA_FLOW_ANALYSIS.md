# Marionette Data Flow Analysis

> Complete documentation of how Marionette tracks and presents all data in real-time

---

## 1. DATABASE SCHEMA

**Location**: `/Users/yarinmag/Documents/yarin/marionette/apps/server/migrations/001_initial.sql`

### Agents Table
```sql
agents (
  agent_id VARCHAR(64) PRIMARY KEY,
  agent_name VARCHAR(255),
  status VARCHAR(32),                    -- idle, working, blocked, error, crashed, disconnected, starting, finished
  terminal VARCHAR(64),                  -- TERM_SESSION_ID or TERM
  cwd TEXT,                              -- Current working directory
  last_activity TIMESTAMP,               -- Last event timestamp
  total_runs INT,                        -- Lifetime run count
  total_tasks INT,                       -- Lifetime task count
  total_errors INT,                      -- Lifetime error count
  total_tokens BIGINT,                   -- Lifetime token usage
  total_duration_ms BIGINT,              -- Lifetime duration
  session_start TIMESTAMP,               -- Session start time
  session_runs INT,                      -- Current session run count
  session_errors INT,                    -- Current session error count
  session_tokens INT,                    -- Current session token count
  metadata JSONB,                        -- Flexible metadata (name, custom_name, labels, etc)
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

**Indexes**: `status`, `last_activity DESC`, `(agent_id, terminal, cwd)`

### Events Table
```sql
events (
  id BIGSERIAL PRIMARY KEY,
  agent_id VARCHAR(64) FOREIGN KEY,
  run_id VARCHAR(64),
  task_id VARCHAR(128),
  type VARCHAR(64),                      -- run.started, run.ended, task.started, tool.result, log.error, etc.
  ts TIMESTAMP,                          -- Event timestamp
  summary TEXT,                          -- Human-readable summary
  status VARCHAR(32),                    -- working, completed, etc.
  duration_ms BIGINT,                    -- How long the operation took
  tokens JSONB,                          -- { input_tokens, output_tokens, total_tokens }
  error JSONB,                           -- { message, code, stack, recoverable }
  payload JSONB,                         -- Additional event-specific data
  trace_id VARCHAR(64),                  -- Distributed tracing ID
  span_id VARCHAR(64),                   -- Distributed tracing span
  created_at TIMESTAMP
)
```

**Indexes**: `(agent_id, ts DESC)`, `(run_id, ts DESC)`, `type`, `ts DESC`

---

## 2. DATA INPUT SOURCES

### A. MCP Server Tools (Real-time Agent Reporting)

**Location**: `/Users/yarinmag/Documents/yarin/marionette/packages/mcp-server/src/tools/`

#### Tool 1: `marionette_set_task`
- **Purpose**: Called when agent starts a new task
- **Input**: `task_name` (string)
- **Flow**:
  1. Agent calls tool → MCP Server receives
  2. SetTaskTool handler (set-task.tool.ts) processes
  3. Updates agent metadata with task name
  4. Detects Jira tickets in task name
  5. Emits `task.started` event via EventEmitterService
  6. WebSocketService sends via WebSocket to server

#### Tool 2: `marionette_report_tokens`
- **Purpose**: Called after every token-producing operation (after each response)
- **Input**: `input_tokens`, `output_tokens` (numbers)
- **Flow**:
  1. Agent calls tool → MCP Server receives
  2. ReportTokensTool handler (report-tokens.tool.ts) processes
  3. Starts/ends a `run` on the event emitter
  4. Emits token usage event with duration
  5. WebSocketService sends data

**MCP Server Architecture** (`packages/mcp-server/src/index.ts`):
```
MCP Server Creation
  ↓
Agent Identity Generation (agent_id, run_id, metadata)
  ↓
Initialize Services:
  - WebSocketService (connects to server via WS)
  - EventEmitterService (centralizes event emission)
  - JiraService (extracts tickets)
  - ToolRegistry (manages tools)
  ↓
Tool Execution → EventEmitter → WebSocket
```

### B. Hooks (Status Updates from CLI/Environment)

**Locations**:
- Setup: `/Users/yarinmag/Documents/yarin/marionette/scripts/lib/setup-hooks.sh`
- Resume hook: `/Users/yarinmag/Documents/yarin/marionette/packages/mcp-server/resume-hook.sh`
- Notify hook: `/Users/yarinmag/Documents/yarin/marionette/packages/mcp-server/notify-hook.sh`

**Hook Events** (configured in `~/.claude/hooks.json`):
```
Trigger                    → Status        → Endpoint
user-prompt-submit         → "working"     → POST /api/agent-status
agent-response-complete    → "working"     → POST /api/agent-status
tool-execution-start       → "working"     → POST /api/agent-status
tool-execution-complete    → "working"     → POST /api/agent-status
session-start              → "starting"    → POST /api/agent-status
session-end                → "stopped"     → POST /api/agent-status
error                      → "error"       → POST /api/agent-status
agent-blocked              → "blocked"     → POST /api/agent-status
```

**Hook Data Payload** (sent via curl POST):
```json
{
  "terminal": "${TERM_SESSION_ID:-${TERM}}",
  "cwd": "${PWD}",
  "status": "working|blocked|error|stopped|starting",
  "event": "user_prompt|blocked|session_start|...",
  "tool": "${TOOL_NAME}"
}
```

**Hook Execution**:
```
Claude Hook Triggers → curl POST /api/agent-status
  ↓
AgentsController.updateStatus()
  ↓
AgentMatcher.findOrCreate() or AgentService.updateStatusByCriteria()
  ↓
Updates agents table by (terminal, cwd) or agent_id
  ↓
Broadcasts to Dashboard via WebSocket
```

---

## 3. DATA STORAGE & UPDATES

**Location**: `/Users/yarinmag/Documents/yarin/marionette/apps/server/src/repositories/agent.repository.ts`

### Key Update Methods

| Method | Purpose | Updates |
|--------|---------|---------|
| `upsertForNewSession()` | New agent or session restart | Resets session counters |
| `upsertForExistingSession()` | Ongoing session | Preserves session counters |
| `updateStatus()` | Change agent status | status, last_activity |
| `updateActivity()` | Heartbeat/touch | last_activity, updated_at |
| `incrementRuns()` | Track run execution | total_runs++, session_runs++ |
| `incrementTasks()` | Track task execution | total_tasks++ |
| `incrementErrors()` | Track errors | total_errors++, session_errors++ |
| `incrementTokensAndDuration()` | Track token usage | total_tokens, session_tokens, total_duration_ms |
| `updateMetadata()` | Custom name, labels, tickets | metadata JSONB field |

### Event Processing Flow

**Location**: `/Users/yarinmag/Documents/yarin/marionette/apps/server/src/services/event.service.ts`

```
MarionetteEvent Received
  ↓
EventService.processEvent()
  ├─ Validate (run_id, type, summary required)
  ├─ Set timestamp if missing
  ├─ If agent is blocked → set status to working
  ├─ AgentService.upsertAgent()    [Insert/Update agents table]
  ├─ AgentService.updateActivity()
  ├─ AgentService.incrementCounters()
  │   ├─ run.started → incrementRuns()
  │   ├─ task.started → incrementTasks()
  │   ├─ log.error → incrementErrors()
  │   └─ Always: incrementTokensAndDuration() if tokens > 0
  └─ EventRepository.insert()      [Insert into events table]
```

### Agent Deduplication Strategy

The system identifies agents via:
1. **agent_id** (explicit) - from MCP server
2. **terminal + cwd** (implicit) - from hooks
3. **terminal only** (fallback)
4. **cwd only** (fallback)
5. **most recent agent** (last resort)

Updates target the **most recently active agent** to prevent cross-Claude interference.

---

## 4. DATA RETRIEVAL (API Endpoints)

**Location**: `/Users/yarinmag/Documents/yarin/marionette/apps/server/src/routes/`

### Agents API

| Endpoint | Method | Query Params | Returns |
|----------|--------|--------------|---------|
| `/api/agents` | GET | `status?` | `AgentSnapshot[]` |
| `/api/agents/{agentId}` | GET | - | `AgentSnapshot` |
| `/api/agents/{agentId}` | PATCH | body: metadata | `{ ok, metadata }` |
| `/api/agents/all` | DELETE | - | `{ ok, deleted }` |
| `/api/agents/crashed` | DELETE | - | `{ ok, deleted }` |

### Events API

| Endpoint | Method | Query Params | Returns |
|----------|--------|--------------|---------|
| `/api/events` | GET | `run_id?`, `agent_id?`, `type?`, `limit?` | `MarionetteEvent[]` |
| `/api/events` | POST | body: event(s) | `{ ok, received }` |

### Status API

| Endpoint | Method | Returns |
|----------|--------|---------|
| `/api/status` | GET | Agent count summary |
| `/health` | GET | Health check |

---

## 5. REAL-TIME UPDATES (WebSocket)

**Locations**:
- Server: `/Users/yarinmag/Documents/yarin/marionette/apps/server/src/services/websocket.service.ts`
- Client: `/Users/yarinmag/Documents/yarin/marionette/apps/web/src/services/ws.service.ts`

### Server-Side WebSocket Architecture

```
HTTP Server (port 8787)
  ↓
HTTP Upgrade Handler
  ├─ /stream          → Dashboard clients
  └─ /agent-stream    → Agent MCP servers

Dashboard Connection Flow:
  Client connects → WS("/stream")
  ↓
  handleDashboardConnection()
  ↓
  Send "hello" message
  ↓
  Listen for broadcast messages

Agent Connection Flow:
  MCP Server connects → WS("/agent-stream")
  ↓
  handleAgentConnection()
  ↓
  Receive MarionetteEvent
  ├─ Track agent_id
  ├─ EventService.processEvent()
  └─ Broadcast to Dashboard: { type: "events", data: [event] }
```

### Broadcast Events

When agents send events or status changes:

```typescript
broadcastToDashboard({
  type: "events",
  data: [MarionetteEvent]
})

broadcastToDashboard({
  type: "agents_updated",
  timestamp: ISO timestamp
})

broadcastToDashboard({
  type: "agents_updated"
})
```

### Client-Side WebSocket

```
ws.connect() → WS("/stream")
  ↓
ws.on("message") → JSON.parse
  ↓
Notify all subscribed listeners
  ├─ React hooks (useAgents)
  └─ Zustand stores
```

---

## 6. FRONTEND DATA FLOW

**Locations**: `/Users/yarinmag/Documents/yarin/marionette/apps/web/src/`

### Data Fetch Strategy

**useAgents Hook** (`features/agents/hooks/useAgents.ts`):

```
Component Mount
  ↓
useQuery() with React Query
  ├─ Try network fetch: apiService.getAgents()
  ├─ Cache in IndexedDB: dbService.saveAgents()
  ├─ Update Zustand store
  └─ On error: fallback to IndexedDB cache

Query Config:
  queryKey: [...QUERY_KEYS.agents, statusFilter]
  staleTime: STALE_TIME.agents (e.g., 30 seconds)
  cacheTime: persistent until manual invalidation
```

### Real-Time Update Flow

```
WebSocket Message Received
  ↓
wsService.subscribe() listener triggered
  ├─ message.type === "agents_updated"
  │   ↓
  │   queryClient.invalidateQueries(QUERY_KEYS.agents)
  │   ↓
  │   Automatic refetch
  │
  └─ message.type === "agent_update"
      ↓
      Optimistic update in React Query
      ↓
      Update Zustand store
```

### Data Layers (Offline Support)

1. **React Query Cache** - In-memory, fastest
2. **IndexedDB** - Persistent browser storage
3. **Zustand Store** - Global state management
4. **Server** - Source of truth

**Offline Fallback Chain**:
```
Network error
  ↓
Check IndexedDB cache
  ↓
Return cached data
  ↓
If no cache: throw error
```

### API Service

**Location**: `/Users/yarinmag/Documents/yarin/marionette/apps/web/src/services/api.service.ts`

```typescript
apiService.getAgents(statusFilter?)      // GET /api/agents
apiService.getAgent(agentId)              // GET /api/agents/{id}
apiService.updateAgent(agentId, updates)  // PATCH /api/agents/{id}
apiService.deleteAllAgents()              // DELETE /api/agents/all
apiService.getStatus()                    // GET /api/status
```

### IndexedDB Schema

**Location**: `/Users/yarinmag/Documents/yarin/marionette/apps/web/src/services/db.service.ts`

```
marionette (Database)
  ├─ agents (ObjectStore)
  │   ├─ keyPath: "agent_id"
  │   ├─ index: "by-status"
  │   └─ index: "by-timestamp" (last_activity)
  │
  ├─ events (ObjectStore)
  │   ├─ keyPath: "id" (autoIncrement)
  │   ├─ index: "by-agent" (agent_id)
  │   └─ index: "by-timestamp" (ts)
  │
  └─ preferences (ObjectStore)
      └─ keyPath: (none)
```

---

## 7. DATA TYPES & FIELDS

### AgentSnapshot (What's stored in DB)

```typescript
{
  agent_id: string,
  agent_name?: string,
  status: "working" | "idle" | "blocked" | "error" | "crashed" | "disconnected" | "starting" | "finished",
  current_run_id?: string,
  current_task?: string,
  last_activity: ISO string,
  terminal?: string,
  cwd?: string,

  // Lifetime counters
  total_runs: number,
  total_tasks: number,
  total_errors: number,
  total_tokens: number,
  total_duration_ms: number,

  // Session counters (reset on new session)
  session_start?: ISO string,
  session_runs: number,
  session_errors: number,
  session_tokens: number,

  // Flexible metadata
  metadata?: {
    name?: string,
    terminal?: string,
    cwd?: string,
    custom_name?: string,
    labels?: string[],
    jira_tickets?: string[],
    wrapper_session_id?: string,
    wrapper_pid?: number,
    claude_pid?: number,
    hostname?: string,
    user?: string,
    last_wrapper_update?: ISO string
  }
}
```

### MarionetteEvent (What's transmitted)

```typescript
{
  org_id?: string,
  project_id?: string,
  user_id?: string,

  run_id: string,
  agent_id?: string,
  task_id?: string,

  type: "run.started" | "run.ended" | "task.started" | "task.ended" |
        "tool.result" | "log.error" | "agent.heartbeat" | ...,
  ts: ISO string,
  summary: string,

  status?: AgentStatus | TaskStatus,
  duration_ms?: number,

  tokens?: {
    input_tokens?: number,
    output_tokens?: number,
    total_tokens?: number,
    cost_usd?: number,
    raw?: unknown
  },

  error?: {
    message: string,
    code?: string,
    stack?: string,
    recoverable?: boolean
  },

  agent_metadata?: {
    name?: string,
    terminal?: string,
    cwd?: string,
    version?: string,
    capabilities?: string[]
  },

  payload?: Record<string, unknown>,
  trace_id?: string,
  span_id?: string,
  parent_span_id?: string
}
```

---

## 8. COMPLETE DATA FLOW DIAGRAM

```
┌─────────────────────────────────────────────────────────────────────┐
│                         INPUT LAYER                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─ MCP TOOLS (Real-time) ──────────────────────────────────────┐ │
│  │  marionette_set_task                                          │ │
│  │    ↓                                                          │ │
│  │  marionette_report_tokens (input_tokens, output_tokens)       │ │
│  │    ↓                                                          │ │
│  │  MCP Server (mcp-server/src/)                                │ │
│  │    ├─ EventEmitterService.startTask()                        │ │
│  │    ├─ EventEmitterService.reportTokens()                     │ │
│  │    └─ EventEmitterService.endRun()                           │ │
│  │      ↓                                                        │ │
│  │  WebSocketService.emit(event)                                │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌─ HOOKS (Status Updates) ──────────────────────────────────────┐ │
│  │  ~/.claude/hooks.json triggers:                               │ │
│  │    user-prompt-submit → POST /api/agent-status               │ │
│  │    session-start → POST /api/agent-status                    │ │
│  │    tool-execution-start/complete → POST /api/agent-status    │ │
│  │    error → POST /api/agent-status                            │ │
│  │    agent-blocked → POST /api/agent-status                    │ │
│  │      ↓                                                        │ │
│  │  curl POST {terminal, cwd, status}                           │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────────┐
│                     BACKEND SERVER LAYER                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─ HTTP ENDPOINTS ─────────────────────────────────────────────┐ │
│  │  POST /api/agent-status        (from hooks)                   │ │
│  │  POST /api/events              (from external ingestion)      │ │
│  │  GET  /api/agents              (query agents)                 │ │
│  │  PATCH /api/agents/{id}        (update metadata)              │ │
│  └──────────────────────────────────────────────────────────────┘ │
│           ↓                                                        │
│  ┌─ CONTROLLERS ────────────────────────────────────────────────┐ │
│  │  AgentsController.updateStatus()                              │ │
│  │  EventsController.ingestEvents()                              │ │
│  │  AgentsController.getAgents()                                 │ │
│  └──────────────────────────────────────────────────────────────┘ │
│           ↓                                                        │
│  ┌─ SERVICES ───────────────────────────────────────────────────┐ │
│  │  AgentService:                                                │ │
│  │    ├─ upsertAgent()              [INSERT/UPDATE agents]       │ │
│  │    ├─ updateActivity()           [Touch last_activity]        │ │
│  │    ├─ incrementCounters()        [runs, tasks, errors, tokens]│ │
│  │    └─ updateStatusByCriteria()   [by terminal, cwd, or id]    │ │
│  │                                                               │ │
│  │  EventService:                                                │ │
│  │    └─ processEvent()             [Insert into events table]   │ │
│  │                                                               │ │
│  │  WebSocketService:                                            │ │
│  │    └─ broadcastToDashboard()     [Send to all dashboard clients] │
│  └──────────────────────────────────────────────────────────────┘ │
│           ↓                                                        │
│  ┌─ DATABASE ───────────────────────────────────────────────────┐ │
│  │  PostgreSQL                                                    │ │
│  │  ├─ agents (agent_id, status, terminal, cwd, tokens, ...)    │ │
│  │  └─ events (agent_id, run_id, type, tokens, error, ...)      │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    WEBSOCKET BROADCAST LAYER                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  WebSocketService.broadcastToDashboard()                           │
│    ├─ { type: "events", data: [MarionetteEvent] }                 │ │
│    ├─ { type: "agents_updated", timestamp: ISO }                 │ │
│    └─ Send to all connected dashboard clients                     │ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    FRONTEND APPLICATION LAYER                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─ WEBSOCKET CLIENT ───────────────────────────────────────────┐ │
│  │  ws.service.ts                                                │ │
│  │  ├─ connect() → WS("/stream")                                │ │
│  │  ├─ subscribe(callback) → notify listeners                    │ │
│  │  └─ handleMessage(JSON)                                       │ │
│  └──────────────────────────────────────────────────────────────┘ │
│           ↓                                                        │
│  ┌─ REACT HOOKS ────────────────────────────────────────────────┐ │
│  │  useAgents()                                                   │ │
│  │  ├─ useQuery() → apiService.getAgents()                       │ │
│  │  ├─ dbService.saveAgents() (IndexedDB cache)                  │ │
│  │  └─ wsService.subscribe() → invalidate on "agents_updated"    │ │
│  │                                                               │ │
│  │  On WebSocket message:                                         │ │
│  │  ├─ "agents_updated" → queryClient.invalidateQueries()        │ │
│  │  └─ Auto-refetch from GET /api/agents                         │ │
│  └──────────────────────────────────────────────────────────────┘ │
│           ↓                                                        │
│  ┌─ DATA STORES ────────────────────────────────────────────────┐ │
│  │  React Query Cache (in-memory, staleTime: 30s)                │ │
│  │  Zustand Store (global state)                                 │ │
│  │  IndexedDB (offline fallback)                                 │ │
│  └──────────────────────────────────────────────────────────────┘ │
│           ↓                                                        │
│  ┌─ REACT COMPONENTS ────────────────────────────────────────┐ │
│  │  AgentList displays agents from Zustand store               │ │
│  │  Agent detail shows tokens, tasks, status, etc.            │ │
│  │  Real-time updates via React Query invalidation            │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 9. KEY TRACKING FIELDS

| Field | Updated By | Purpose |
|-------|-----------|---------|
| **status** | Hooks + Events | Current agent state (working, blocked, idle) |
| **total_tokens** | `reportTokens` event | Cumulative LLM token usage |
| **session_tokens** | `reportTokens` event | Current session token usage |
| **total_runs** | `run.started` event | Count of completed runs |
| **session_runs** | `run.started` event | Count of runs in session |
| **total_tasks** | `task.started` event | Count of completed tasks |
| **total_errors** | `log.error` event | Count of errors |
| **session_errors** | `log.error` event | Errors in session |
| **total_duration_ms** | `run.ended` event | Total execution time |
| **last_activity** | Any event | Timestamp of last activity |
| **terminal** | Hooks + Agent metadata | Terminal session identifier |
| **cwd** | Hooks + Agent metadata | Working directory |
| **agent_name** | From metadata | Display name |

---

## 10. TIMING & POLLING

- **React Query staleTime**: Configurable (typically 30s)
- **WebSocket reconnect**: Exponential backoff (1s → 30s)
- **Idle check interval**: `config.websocket.idleCheckIntervalMs` (background task)
- **Hook debounce**: `config.hooks.debounceMs` (prevents rapid duplicate updates)
- **MCP heartbeat**: `config.heartbeat.intervalMs` (keeps connection alive)

---

## 11. KNOWN ISSUES & FIXES

### Fixed Issues
1. ✅ **Hooks missing `cwd` parameter** - Both `notify-hook.sh` and `resume-hook.sh` now include `cwd` in their payloads
2. ✅ **Status updates affecting all Claude processes** - Modified SQL queries to only update most recently active agent

### Current Limitations
1. **MCP tools not called consistently** - Agents need to call `marionette_set_task` and `marionette_report_tokens` regularly (see CLAUDE.md)
2. **Old sessions have incomplete data** - Sessions that started before Marionette setup won't have full tracking
3. **Timestamp accuracy** - `last_activity` only updates when hooks fire or MCP tools are called

---

This is the complete data flow from agent input through database storage, API retrieval, WebSocket broadcasting, and frontend display. The system is designed for real-time monitoring with offline fallback capability.
