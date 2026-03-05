# Marionette REST API

The server runs on **port 8787** and exposes a REST API under `/api` plus a WebSocket endpoint.

---

## Base URL

```
http://localhost:8787
```

All REST endpoints are prefixed with `/api`.

---

## Agents

### `GET /api/agents`

List all agents. Optionally filter by status.

**Query parameters**

| Name | Type | Description |
|---|---|---|
| `status` | string | Filter by status: `working`, `idle`, `blocked`, `error`, `crashed` |

**Response** `200`

```json
[
  {
    "agent_id": "agent_lcy1abc_deadbeef",
    "status": "working",
    "cwd": "/home/user/project",
    "terminal": "iTerm2",
    "created_at": "2025-01-01T00:00:00.000Z",
    "updated_at": "2025-01-01T00:01:00.000Z",
    "custom_name": null,
    "current_task": "Fixing auth bug",
    "token_budget": null,
    "cost_budget_usd": null
  }
]
```

---

### `GET /api/agents/:agentId`

Get a single agent by ID.

**Response** `200` — agent object (same shape as list item)

**Response** `404`

```json
{ "error": "Agent not found" }
```

---

### `PATCH /api/agents/:agentId`

Update an agent's metadata fields.

**Request body** (all fields optional)

```json
{
  "custom_name": "Auth Service Bot",
  "labels": ["backend", "auth"],
  "jira_tickets": ["PROJ-123"],
  "source_file": "src/auth.ts",
  "current_task": "Refactoring login flow",
  "notes": "Needs review",
  "process_pid": 12345,
  "token_budget": 100000,
  "cost_budget_usd": 5.0
}
```

**Response** `200`

```json
{ "ok": true, "metadata": { ... } }
```

---

### `DELETE /api/agents/:agentId`

Delete a specific agent and all associated data.

**Response** `200`

```json
{ "ok": true, "deleted": 1 }
```

**Response** `404`

```json
{ "error": "Agent not found" }
```

---

### `DELETE /api/agents/crashed`

Delete all agents with `status = "crashed"`.

**Response** `200`

```json
{ "ok": true, "deleted": 3 }
```

---

### `DELETE /api/agents/all`

Delete all agents.

**Response** `200`

```json
{ "ok": true, "deleted": 12 }
```

---

### `GET /api/agents/:agentId/conversation`

Get the conversation turns for an agent.

**Query parameters**

| Name | Type | Default | Max |
|---|---|---|---|
| `limit` | number | `500` | `500` |

**Response** `200`

```json
{
  "turns": [
    {
      "role": "user",
      "content": "Fix the login bug"
    },
    {
      "role": "assistant",
      "content": "I'll look into the auth flow...",
      "tokens": { "input_tokens": 1200, "output_tokens": 340 }
    }
  ],
  "total": 2
}
```

---

### `GET /api/agents/:agentId/runs`

Get the list of runs (sessions) for an agent.

**Query parameters**

| Name | Type | Default | Max |
|---|---|---|---|
| `limit` | number | `50` | `100` |

**Response** `200`

```json
{ "runs": [ ... ] }
```

---

### `GET /api/agents/:agentId/llm-calls`

Get LLM call events for an agent.

**Query parameters**

| Name | Type | Default | Max |
|---|---|---|---|
| `limit` | number | `100` | `500` |

**Response** `200`

```json
{
  "calls": [
    {
      "ts": "2025-01-01T00:00:00.000Z",
      "summary": "Tool use — write file",
      "duration_ms": 3200,
      "tokens": { "input_tokens": 800, "output_tokens": 120 },
      "payload": { ... }
    }
  ]
}
```

---

### `POST /api/agents/:agentId/commands`

Send a command to an agent (requires command service to be running).

**Request body**

```json
{
  "command": "stop",
  "args": {}
}
```

**Response** `200` — command result

**Response** `503`

```json
{ "error": "Command service not available" }
```

---

### `POST /api/agents/:agentId/focus`

Bring the agent's terminal window to the foreground. Platform-specific — uses AppleScript on macOS, `code` CLI on Linux, PowerShell Win32 on Windows.

**Response** `200`

```json
{ "ok": true, "method": "applescript", "app": "iTerm2" }
```

**Response** `501` — when the terminal is unrecognized or unsupported on the current platform

```json
{ "error": "Focus not supported: unsupported terminal \"xterm\"" }
```

---

## Events

### `GET /api/events`

Query stored events with optional filters.

**Query parameters**

| Name | Type | Description |
|---|---|---|
| `agentId` | string | Filter by agent ID |
| `type` | string | Filter by event type (e.g. `llm.call`, `conversation.turn`) |
| `limit` | number | Max results (default 500, max 2000) |

**Response** `200`

```json
[
  {
    "id": "evt_...",
    "agent_id": "agent_...",
    "type": "llm.call",
    "ts": "2025-01-01T00:00:00.000Z",
    "summary": "LLM call",
    "tokens": { ... },
    "payload": { ... }
  }
]
```

---

### `POST /api/events`

Ingest one or more events. Used internally by the file-watcher and MCP server.

**Request body**

```json
{
  "events": [
    {
      "type": "llm.call",
      "agent_id": "agent_...",
      "ts": "2025-01-01T00:00:00.000Z",
      "payload": { ... }
    }
  ]
}
```

**Response** `200`

```json
{ "ok": true, "ingested": 1 }
```

---

### `GET /api/agents/:agentId/events`

Get all events for a specific agent (shorthand route, same filters apply).

---

## Status

### `GET /health`

Health check endpoint. Returns immediately with no DB access.

**Response** `200`

```json
{ "ok": true }
```

---

### `GET /api/status`

Live system summary.

**Response** `200`

```json
{
  "total_agents": 5,
  "working": 2,
  "idle": 2,
  "blocked": 0,
  "errors": 1,
  "crashed": 0,
  "needs_attention": 1
}
```

---

## Personal Tasks

### `GET /api/personal-tasks`

List all personal tasks.

### `POST /api/personal-tasks`

Create a personal task.

**Request body**

```json
{ "title": "Review PR", "description": "...", "status": "todo" }
```

### `GET /api/personal-tasks/:id`

Get one task by ID.

### `PATCH /api/personal-tasks/:id`

Update a task.

### `DELETE /api/personal-tasks/:id`

Delete a task.

---

## Preferences

### `GET /api/preferences`

Get user preferences.

**Response** `200`

```json
{ "theme": "dark", "timezone": "UTC" }
```

### `PUT /api/preferences`

Set user preferences (full replace).

**Request body** — any key/value preference object

---

## WebSocket

Connect to `ws://localhost:8787` to receive real-time push events.

The server broadcasts JSON messages whenever agent state changes:

```json
{ "type": "agents_updated" }
```

```json
{ "type": "event", "event": { ... } }
```

The dashboard frontend uses this to update agent cards and token counts without polling.
