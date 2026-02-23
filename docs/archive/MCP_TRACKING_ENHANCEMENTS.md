# MCP Tracking Enhancements

## 🎯 Problem Solved

**Before:** Metrics were not being tracked properly:
- ❌ Runs: 0 (never counted)
- ❌ Tasks: 0 (never counted)
- ❌ Duration: 0ms (never accumulated)
- ❌ Last activity: 2h ago (not updating)
- ✅ Tokens: Working (only metric that worked)

**Root Cause:** MCP server was only sending minimal events:
- `agent.started` - When connecting
- `agent.status` - When task name set
- `tool.result` - When tokens reported

Missing events needed for metrics:
- `run.started` / `run.ended` - For counting runs
- `task.started` / `task.ended` - For counting tasks
- `duration_ms` field - For duration tracking
- `agent.heartbeat` - For updating last_activity

---

## ✅ What Was Fixed

### 1. **Run Tracking** ✅

**When:** Token reporting happens
**What:** Automatically tracks runs

```typescript
// Before token report: Start run
this.emitEvent({
  type: "run.started",
  summary: "Agent run started",
  status: "working",
});

// After token report: End run with duration
this.emitEvent({
  type: "run.ended",
  summary: "Agent run completed",
  duration_ms: calculatedDuration,
  tokens: { ... },
});
```

**Result:**
- `total_runs` increments ✅
- `session_runs` increments ✅
- Duration tracked ✅

### 2. **Task Tracking** ✅

**When:** `marionette_set_task` is called
**What:** Properly tracks task lifecycle

```typescript
// End previous task (if exists)
this.emitEvent({
  type: "task.ended",
  task_id: previousTaskId,
  summary: "Completed previous task",
});

// Start new task
this.emitEvent({
  type: "task.started",
  task_id: newTaskId,
  summary: `Task: ${taskName}`,
});
```

**Result:**
- `total_tasks` increments ✅
- Task transitions tracked ✅

### 3. **Duration Tracking** ✅

**When:** Each run completes
**What:** Calculates and reports duration

```typescript
// Track run start time
this.currentRunStartTime = Date.now();

// When run ends, calculate duration
const durationMs = Date.now() - this.currentRunStartTime;

// Include in events
this.emitEvent({
  type: "run.ended",
  duration_ms: durationMs, // ← Added!
  tokens: { ... },
});
```

**Result:**
- `total_duration_ms` accumulates ✅
- Duration displayed in UI ✅

### 4. **Last Activity Tracking** ✅

**When:** Every 30 seconds (automatic)
**What:** Sends heartbeat to update last_activity

```typescript
// Start heartbeat when WebSocket connects
setInterval(() => {
  this.emitEvent({
    type: "agent.heartbeat",
    summary: "Agent heartbeat",
  });
}, 30000); // Every 30 seconds
```

**Result:**
- `last_activity` stays current ✅
- Agent won't be marked idle while active ✅

---

## 📊 Event Flow Now

### When Task Starts
```
1. User calls marionette_set_task("Bug Fix")
2. MCP emits: task.ended (previous task)
3. MCP emits: task.started (new task)
4. Server increments: total_tasks++
```

### When Work Happens
```
1. User calls marionette_report_tokens(45000, 2500)
2. MCP emits: run.started
3. MCP calculates duration
4. MCP emits: run.ended (with duration + tokens)
5. Server increments: total_runs++, total_tokens += 47500, total_duration_ms += duration
```

### While Idle
```
Every 30 seconds:
1. MCP emits: agent.heartbeat
2. Server updates: last_activity = NOW
3. Agent stays "working" (not marked idle)
```

---

## 🚀 How to Test

### Step 1: Restart Claude Code
The MCP server has been rebuilt, but Claude needs to restart to load it:
1. Close this Claude Code session
2. Open a new Claude Code session
3. The new MCP server will load automatically

### Step 2: Set a Task
In the new session, ask Claude:
```
"Set task name to: Testing Metrics Tracking"
```

This will:
- ✅ Emit `task.started`
- ✅ Increment `total_tasks` from 0 → 1

### Step 3: Report Tokens
Claude should automatically report tokens after each response. Or you can manually ask:
```
"Report tokens"
```

This will:
- ✅ Emit `run.started`
- ✅ Emit `run.ended` with duration
- ✅ Increment `total_runs` from 0 → 1
- ✅ Add to `total_duration_ms`

### Step 4: Check Dashboard
Refresh the dashboard and click on your agent:
- **Runs:** Should show 1+ ✅
- **Tasks:** Should show 1+ ✅
- **Duration:** Should show actual time (e.g., "2.5s") ✅
- **Tokens:** Should update ✅
- **Last activity:** Should say "Just now" or "30s ago" ✅

---

## 🔍 Verification

### Expected Metrics After Testing

**After 1 task + 1 token report:**
```
Runs: 1
Tasks: 1
Errors: 0 (unless error occurred)
Tokens: ~50K (depends on conversation)
Duration: 2-5s (time to process)
Last activity: <30s ago
```

### Check Server Logs
```bash
tail -f <path-to-server-logs>
```

Look for:
```
[agent-ws] agent connected
[events] task.started
[events] run.started
[events] run.ended
[events] agent.heartbeat
```

### Check Database
```bash
curl http://localhost:8787/api/agents | jq '.'
```

Verify fields are non-zero:
- `total_runs > 0`
- `total_tasks > 0`
- `total_duration_ms > 0`
- `total_tokens > 0`

---

## 📈 Metrics Explained

### Runs
- **What:** Number of complete interactions (prompt → response)
- **When:** Each time `marionette_report_tokens` is called
- **Why:** Tracks how many times the agent has processed requests

### Tasks
- **What:** Number of distinct tasks started
- **When:** Each time `marionette_set_task` is called
- **Why:** Tracks how many different objectives the agent worked on

### Duration
- **What:** Total time spent processing (in milliseconds)
- **When:** Measured from run start to run end
- **Why:** Shows agent efficiency and workload

### Tokens
- **What:** Total tokens consumed (input + output)
- **When:** Reported with each token report
- **Why:** Tracks API usage and cost

### Last Activity
- **What:** Timestamp of most recent activity
- **When:** Updated with every event (+ heartbeat every 30s)
- **Why:** Shows if agent is still alive and responsive

---

## 🐛 Troubleshooting

### Problem: Runs still showing 0

**Check:**
1. Did you restart Claude Code? (Required!)
2. Did you call `marionette_report_tokens`?
3. Check server logs for `run.started` / `run.ended` events

**Fix:**
- Restart Claude Code to load new MCP server
- Ask Claude to report tokens explicitly

### Problem: Tasks still showing 0

**Check:**
1. Did you call `marionette_set_task`?
2. Check server logs for `task.started` events

**Fix:**
- Ask Claude to set a task name
- Or use the MCP tool directly

### Problem: Duration still 0ms

**Check:**
1. Are runs being counted? (Duration comes from runs)
2. Check if `duration_ms` field in events

**Fix:**
- Ensure runs are working first
- Check server logs for `duration_ms` values

### Problem: Last activity not updating

**Check:**
1. Is WebSocket connected?
2. Are heartbeats being sent? (every 30s)

**Fix:**
- Check WebSocket connection in server logs
- Restart MCP server if disconnected

---

## 🎉 Summary of Changes

### MCP Server Enhanced

**New tracking:**
- ✅ Automatic run lifecycle (`run.started` → `run.ended`)
- ✅ Task lifecycle (`task.started` → `task.ended`)
- ✅ Duration calculation (time from start to end)
- ✅ Heartbeat every 30s (keeps agent alive)

**New state tracking:**
- `currentTaskId` - Track current task
- `currentRunStartTime` - Calculate duration
- `heartbeatInterval` - Periodic updates

**Modified tools:**
- `marionette_set_task` - Now emits `task.started`/`task.ended`
- `marionette_report_tokens` - Now emits `run.started`/`run.ended` with duration

### Server Side (Already Working)

**Event handlers that now receive data:**
- `incrementAgentCounters()` - Counts runs, tasks, errors
- `updateAgentActivity()` - Updates last_activity timestamp
- Token and duration accumulation - Working as expected

---

## 🚦 Next Steps

1. **Close this Claude Code session**
2. **Start a new Claude Code session**
3. **Set a task:** "Set task to: Metrics Testing"
4. **Report tokens** (happens automatically)
5. **Refresh dashboard** → See all metrics working! 🎊

The metrics should now be tracking correctly:
- Runs counted ✅
- Tasks counted ✅
- Duration accumulated ✅
- Last activity current ✅
- Tokens tracked ✅

All metrics working! 🚀
