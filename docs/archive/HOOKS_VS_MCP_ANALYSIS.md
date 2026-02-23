# Claude Code Hooks vs MCP - Complete Analysis

## 🎯 The Question

**Can we solve everything with just Claude Code hooks? What do we need MCP for?**

Let's map what each system can and cannot do.

---

## 📋 What We Need to Track

| Metric | Description | Difficulty |
|--------|-------------|------------|
| **Status** | working, blocked, idle, error | Easy |
| **Task Name** | What the agent is working on | Medium |
| **Token Usage** | Input/output token counts | Hard |
| **Runs** | Number of complete interactions | Medium |
| **Duration** | Time spent on each run | Easy |
| **Errors** | Error messages and stack traces | Medium |
| **Last Activity** | Timestamp of last action | Easy |

---

## 🪝 Claude Code Hooks - What They Can Do

### Available Hooks

From Claude Code documentation:

```json
{
  "hooks": {
    "user-prompt-submit-hook": "command to run",
    "assistant-response-hook": "command to run",
    "tool-call-hook": "command to run",
    "blocked-hook": "command to run",
    "working-hook": "command to run"
  }
}
```

### What Hooks CAN Track ✅

#### 1. **Status Changes** ✅ AUTOMATIC
```bash
# blocked-hook: Runs when waiting for user input
"blocked-hook": "curl -X POST http://localhost:8787/api/agent-status -d '{\"status\":\"blocked\",\"terminal\":\"$TERM\",\"cwd\":\"$PWD\"}'"

# working-hook: Runs when starting to work
"working-hook": "curl -X POST http://localhost:8787/api/agent-status -d '{\"status\":\"working\",\"terminal\":\"$TERM\",\"cwd\":\"$PWD\"}'"
```

**Result:**
- ✅ Automatic status tracking
- ✅ No Claude intervention needed
- ✅ Real-time updates
- ✅ Works even if Claude doesn't call MCP tools

#### 2. **Timing/Duration** ✅ EASY
```bash
# assistant-response-hook: Track when response starts/ends
"assistant-response-hook": "curl -X POST http://localhost:8787/api/events -d '{\"type\":\"run.ended\",\"ts\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}'"
```

**Result:**
- ✅ Can calculate duration
- ✅ Start time = prompt submit
- ✅ End time = response complete

#### 3. **Event Timestamps** ✅ EASY
```bash
"user-prompt-submit-hook": "echo \"User prompt at $(date)\""
```

**Result:**
- ✅ Know exactly when events happen
- ✅ Can track activity timeline

### What Hooks CANNOT Track ❌

#### 1. **Token Counts** ❌ IMPOSSIBLE
```bash
# This doesn't exist - no access to token data
"assistant-response-hook": "echo $TOKENS"  # ❌ No such variable
```

**Why:**
- Claude doesn't expose token counts to shell
- No environment variable for tokens
- No way to parse from response
- Token counting happens server-side

**Workaround:** Must use MCP to have Claude report tokens explicitly

#### 2. **Task Names** ❌ HARD
```bash
# No way to know what task Claude is working on
"working-hook": "echo $CURRENT_TASK"  # ❌ Doesn't exist
```

**Why:**
- Task name is in user's mind, not a system value
- No environment variable for current task
- Can't parse reliably from prompt

**Workaround:** Must use MCP for Claude to report task name

#### 3. **Error Details** ❌ PARTIAL
```bash
# Can detect an error occurred, but not details
"tool-call-hook": "if [ $? -ne 0 ]; then echo 'error'; fi"
```

**Why:**
- Can detect exit codes
- Cannot access error messages
- Cannot get stack traces
- Cannot know error context

**Workaround:** Must use MCP for Claude to report error details

#### 4. **Run Context** ❌ IMPOSSIBLE
```bash
# No access to run_id, agent_id, conversation context
"working-hook": "echo $RUN_ID"  # ❌ Doesn't exist
```

**Why:**
- These are internal Claude concepts
- Not exposed to shell environment
- Need structured tracking

**Workaround:** Must use MCP to maintain run context

---

## 🔧 MCP Tools - What They Can Do

### What MCP CAN Track ✅

#### 1. **Token Counts** ✅ ACCURATE
```typescript
// Claude has access to its own token usage
marionette_report_tokens({
  input_tokens: 45000,
  output_tokens: 2500
})
```

**Why it works:**
- Claude can see its context window
- Knows exact token counts
- Can report after each response

#### 2. **Task Names** ✅ EXPLICIT
```typescript
// Claude knows what task it's working on
marionette_set_task({
  task_name: "Bug Investigation: CEM-24729"
})
```

**Why it works:**
- User tells Claude the task
- Claude understands context
- Can set meaningful names

#### 3. **Run Lifecycle** ✅ STRUCTURED
```typescript
// MCP can track complete run lifecycle
run.started → working → run.ended
```

**Why it works:**
- Can maintain state (currentRunId)
- Can correlate events
- Can calculate duration

#### 4. **Rich Metadata** ✅ DETAILED
```typescript
{
  type: "run.ended",
  duration_ms: 5230,
  tokens: { input: 45000, output: 2500 },
  task_id: "task_123",
  error: { message: "..." }
}
```

**Why it works:**
- MCP has full event context
- Can structure data properly
- Can include all relevant fields

### What MCP CANNOT Do ❌

#### 1. **Automatic Tracking** ❌ REQUIRES CLAUDE
```typescript
// Only works if Claude calls the tool
marionette_report_tokens(...)  // ← Claude must call this
```

**Problem:**
- Depends on Claude remembering to call
- Not automatic
- Can be missed if prompt doesn't trigger

#### 2. **Real-time Status** ❌ DELAYED
```typescript
// Status only updates when tool is called
// If Claude doesn't call, status is stale
```

**Problem:**
- Not instant
- Gaps between tool calls
- Status can be outdated

---

## 🎯 Current Architecture - Best of Both Worlds

### What We Use Hooks For ✅

```json
{
  "hooks": {
    "blocked-hook": "curl -X POST .../agent-status -d '{\"status\":\"blocked\",...}'",
    "working-hook": "curl -X POST .../agent-status -d '{\"status\":\"working\",...}'"
  }
}
```

**Responsible for:**
1. ✅ **Automatic status updates** (blocked/working)
2. ✅ **Real-time state changes**
3. ✅ **Works without Claude intervention**
4. ✅ **Terminal and CWD tracking**

### What We Use MCP For ✅

```typescript
// Tools Claude calls explicitly
- marionette_set_task() → Task tracking
- marionette_report_tokens() → Token tracking
```

**Responsible for:**
1. ✅ **Token counting**
2. ✅ **Task naming**
3. ✅ **Run tracking** (start/end)
4. ✅ **Duration calculation**
5. ✅ **Rich event data**

---

## 📊 Comparison Matrix

| Feature | Hooks | MCP | Current Solution |
|---------|-------|-----|------------------|
| **Status (working/blocked)** | ✅ Automatic | ❌ Manual | **Hooks** |
| **Token counts** | ❌ Impossible | ✅ Accurate | **MCP** |
| **Task names** | ❌ Hard | ✅ Easy | **MCP** |
| **Timing/Duration** | ✅ Easy | ✅ Easy | **Both** |
| **Run lifecycle** | ❌ Limited | ✅ Complete | **MCP** |
| **Error details** | ❌ Partial | ✅ Full | **MCP** |
| **Real-time updates** | ✅ Instant | ❌ Delayed | **Hooks** |
| **Automation** | ✅ Automatic | ❌ Manual | **Hooks** |
| **Rich metadata** | ❌ Limited | ✅ Complete | **MCP** |

---

## 🤔 Could We Use ONLY Hooks?

### Theoretical Approach

```json
{
  "hooks": {
    "user-prompt-submit-hook": "./track-start.sh",
    "assistant-response-hook": "./track-end.sh",
    "blocked-hook": "./track-blocked.sh",
    "working-hook": "./track-working.sh"
  }
}
```

### What Would Work ✅

1. **Status tracking** → Hooks work great
2. **Duration** → Calculate from timestamps
3. **Activity timeline** → Track all events
4. **CWD/Terminal** → Available in shell

### What Would NOT Work ❌

1. **Token counts** → No access ❌
2. **Task names** → Would need to parse prompts (unreliable) ❌
3. **Error details** → Only exit codes, no messages ❌
4. **Structured data** → Limited to shell vars ❌

### Example: Trying to Parse Task from Prompt

```bash
# user-prompt-submit-hook
PROMPT="$1"  # Full user prompt
TASK=$(echo "$PROMPT" | grep -oP 'task: \K.*' || echo "unknown")
curl -X POST .../events -d "{\"task\":\"$TASK\"}"
```

**Problems:**
- ❌ User might not mention task
- ❌ Format varies wildly
- ❌ Can't understand context
- ❌ False positives/negatives

---

## 🎯 Could We Use ONLY MCP?

### Theoretical Approach

```typescript
// Claude calls tools for everything
marionette_status("working")
marionette_status("blocked")
marionette_report_tokens(...)
marionette_set_task(...)
```

### What Would Work ✅

1. **Token counts** → Perfect ✅
2. **Task names** → Perfect ✅
3. **Rich metadata** → Perfect ✅
4. **Structured events** → Perfect ✅

### What Would NOT Work ❌

1. **Automatic status** → Requires Claude to remember ❌
2. **Real-time** → Delayed until tool call ❌
3. **Reliability** → Can miss if prompt doesn't trigger ❌
4. **System info** → Would need to expose via MCP ❌

### Example: Missing Automatic Status

```
User: "Tell me about X"
Claude: *starts thinking*  ← No status update!
Claude: *working on response*  ← Still no update!
Claude: "Here's the answer..."
Claude: marionette_report_tokens(...)  ← Finally updates!

Result: Status was stale for 30+ seconds
```

---

## ✅ Why We Need BOTH

### The Perfect Combination

```
┌─────────────────────────────────────┐
│         AUTOMATIC (Hooks)           │
│  - Status changes (instant)         │
│  - Working/Blocked detection        │
│  - Real-time updates                │
│  - System info (cwd, terminal)      │
└─────────────────────────────────────┘
              ↓
    ┌─────────────────┐
    │  Marionette API  │
    └─────────────────┘
              ↑
┌─────────────────────────────────────┐
│        EXPLICIT (MCP)               │
│  - Token counts (accurate)          │
│  - Task names (meaningful)          │
│  - Rich events (structured)         │
│  - Run lifecycle (complete)         │
└─────────────────────────────────────┘
```

### Benefits of Hybrid Approach

1. **Reliability** ✅
   - Hooks ensure status always updates
   - MCP provides rich data when available
   - System works even if Claude forgets to call MCP

2. **Accuracy** ✅
   - Token counts from Claude (only source)
   - Status from hooks (automatic)
   - Task names from Claude (understands context)

3. **Real-time** ✅
   - Hooks update instantly
   - No waiting for Claude to call tools
   - Dashboard always current

4. **Completeness** ✅
   - All metrics tracked
   - No gaps in data
   - Rich and accurate

---

## 🔧 Alternative: Pure Hook-Based Approach

### How It Could Work

If we wanted hooks-only, we'd need:

1. **Token Estimation** (not accurate)
```bash
# Estimate tokens from character count
CHARS=$(echo "$PROMPT" | wc -c)
TOKENS=$((CHARS / 4))  # Rough estimate
```

2. **Task Parsing** (unreliable)
```bash
# Try to extract task from prompt
TASK=$(echo "$PROMPT" | head -n1 | cut -c1-50)
```

3. **Status Only Tracking**
```bash
# Just track states, no rich data
curl -X POST .../status -d '{"status":"working"}'
```

### Limitations

- ❌ Token counts would be estimates (wildly inaccurate)
- ❌ Task names would be guesses (often wrong)
- ❌ No structured events (just status)
- ❌ No run correlation (can't tie events together)
- ❌ No error details (just failures)

### When This Might Be Acceptable

- Quick prototype
- Don't care about token accuracy
- Only need basic status monitoring
- No task tracking needed

---

## 📈 What Each System Solves

### Hooks Solve (Automatically) ✅

| Problem | Solution |
|---------|----------|
| Agent disappeared from dashboard | Heartbeat via status hooks |
| Status outdated | Real-time hook-based updates |
| Don't know if blocked | `blocked-hook` fires instantly |
| Don't know when working | `working-hook` fires instantly |
| Need CWD tracking | Available in `$PWD` |
| Need terminal tracking | Available in `$TERM` |

### MCP Solves (Explicitly) ✅

| Problem | Solution |
|---------|----------|
| Token usage unknown | `marionette_report_tokens` |
| Task name unclear | `marionette_set_task` |
| Runs not counted | `run.started` / `run.ended` events |
| Duration missing | Calculate in MCP, include in events |
| No structured data | Full event objects with metadata |
| Can't track errors | Claude reports via MCP |

---

## 🎯 Recommended Approach

### Keep Current Hybrid System ✅

**Why:**
1. Hooks provide automatic, real-time status
2. MCP provides accurate, rich data
3. Best of both worlds
4. No significant downsides

### Possible Enhancements

1. **Add More Hooks** (optional)
```json
{
  "tool-call-hook": "./track-tool.sh",
  "error-hook": "./track-error.sh"
}
```

2. **More MCP Tools** (optional)
```typescript
- marionette_report_error(error)
- marionette_start_run()
- marionette_end_run()
```

3. **Hook → MCP Bridge** (advanced)
```bash
# blocked-hook could trigger MCP
blocked-hook: "claude-mcp-call marionette_status blocked"
```

---

## 🏆 Summary

### What We Currently Use

| System | Purpose | Auto? | Accurate? |
|--------|---------|-------|-----------|
| **Hooks** | Status tracking | ✅ Yes | ✅ Yes |
| **MCP** | Rich data (tokens, tasks) | ❌ No | ✅ Yes |

### Could We Use Just One?

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| **Hooks Only** | Automatic, real-time | No tokens, no tasks | ❌ Incomplete |
| **MCP Only** | Rich data, accurate | Not automatic | ❌ Unreliable |
| **Both (Current)** | Complete, automatic | None | ✅ **Recommended** |

### The Answer

**No, we cannot solve everything with just hooks or just MCP.**

We need:
- **Hooks** for automatic, real-time status tracking
- **MCP** for rich data that only Claude can provide (tokens, meaningful task names)

The hybrid approach gives us:
- ✅ Automatic status updates
- ✅ Accurate token tracking
- ✅ Meaningful task names
- ✅ Complete run lifecycle
- ✅ Real-time dashboard
- ✅ Rich analytics

**This is the optimal architecture.** 🎯
