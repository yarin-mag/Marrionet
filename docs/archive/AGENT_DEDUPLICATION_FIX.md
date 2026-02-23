# Agent Deduplication Fix

## 🐛 Problem

**Issue:** Dashboard showed duplicate agents even when only one Claude session was running.

**Root Cause:** The agent status hook was updating **ALL agents** instead of targeting a specific agent.

### What Was Happening

1. User starts Claude in "Documents" folder → Agent 1 created
2. User switches to "client-staging" folder (or starts another session) → Agent 2 created
3. User sends status hook (e.g., "blocked") → Server updates **ALL agents** to "blocked"
4. Result: Both agents show same status, even if only one is active

**Server code before fix:**
```typescript
// Update ALL agents to the new status ❌
result = await query(
  `UPDATE agents SET status = $1, updated_at = NOW()`,
  [status]
);
```

---

## ✅ Solution

### 1. **Smart Agent Matching**

Now the server identifies the specific agent by matching:
1. **terminal + cwd** (most specific)
2. **terminal only** (fallback)
3. **cwd only** (fallback)
4. **Most recent agent** (last resort)

**New code:**
```typescript
// Try to match by terminal AND cwd for most specific match ✅
if (terminal && cwd) {
  result = await query(
    `UPDATE agents
     SET status = $1, last_activity = NOW(), updated_at = NOW()
     WHERE terminal = $2 AND cwd = $3`,
    [status, terminal, cwd]
  );
}
// Fallback: match by terminal only
else if (terminal) {
  result = await query(
    `UPDATE agents
     SET status = $1, last_activity = NOW(), updated_at = NOW()
     WHERE terminal = $2`,
    [status, terminal]
  );
}
// ... additional fallbacks
```

### 2. **Automatic Stale Agent Cleanup**

Added background cleanup task that runs every 10 seconds:
- Removes agents with no heartbeat in 30+ seconds
- Automatically cleans up agents from crashed/closed sessions
- Broadcasts update to dashboard

**Implementation:**
```typescript
// Periodically clean up stale agents (no heartbeat in 30+ seconds)
const CLEANUP_INTERVAL_MS = 10000; // Every 10 seconds
setInterval(async () => {
  try {
    const deleted = await markStaleAgents();
    if (deleted > 0) {
      console.log(`[cleanup] Removed ${deleted} stale agent(s)`);
      // Notify dashboard clients
      broadcastToDashboard(JSON.stringify({ type: "agents_updated" }));
    }
  } catch (err) {
    console.error("[cleanup] error:", err);
  }
}, CLEANUP_INTERVAL_MS);
```

**Cleanup logic:**
```typescript
export async function markStaleAgents(): Promise<number> {
  const result = await query(
    `DELETE FROM agents
     WHERE status IN ('working', 'starting', 'blocked', 'idle')
       AND last_activity < NOW() - INTERVAL '30 seconds'
     RETURNING agent_id`
  );
  return result.length;
}
```

---

## 🔍 How It Works Now

### Scenario 1: Single Agent
1. User starts Claude → Agent created with terminal + cwd
2. Status hook arrives → Matches by terminal + cwd → **Only that agent updated** ✅
3. If agent crashes/closes → After 30s, automatically removed
4. Dashboard shows accurate single agent

### Scenario 2: Multiple Agents (Different Folders)
1. User starts Claude in "Documents" → Agent 1 (terminal=xterm, cwd=/Documents)
2. User starts Claude in "client-staging" → Agent 2 (terminal=xterm, cwd=/client-staging)
3. Agent 1 sends status "blocked" → Matches cwd=/Documents → **Only Agent 1 updated** ✅
4. Agent 2 sends status "working" → Matches cwd=/client-staging → **Only Agent 2 updated** ✅
5. Dashboard shows both agents with correct independent statuses

### Scenario 3: Agent Closes
1. User closes Claude → WebSocket disconnects
2. Server marks agent as "idle"
3. After 30 seconds of no heartbeat → Automatic cleanup removes agent
4. Dashboard updates automatically

---

## 📊 Testing Results

**Before Fix:**
```
Total Agents: 2 (but only 1 actually running)
Working: 2 (incorrect)
Both agents show "BLOCKED" when hook fires
```

**After Fix:**
```
Total Agents: 1 (correct!)
Working: 1 (correct!)
Each agent has independent status
Stale agents auto-removed after 30s
```

---

## 🚀 What Changed

### Files Modified

**`apps/server/src/index.ts`**
1. Updated `/api/agent-status` endpoint (lines 134-180)
   - Added smart agent matching logic
   - Prevents updating all agents
   - Logs warnings when no agents matched

2. Added automatic cleanup (after line 479)
   - Runs every 10 seconds
   - Removes stale agents (30+ seconds inactive)
   - Broadcasts updates to dashboard

### Server Logs

**Before:**
```
[agent-status] Hook received: status="working"
[agent-status] Updated 2 agent(s) to "working"  ← Wrong!
```

**After:**
```
[agent-status] Hook received: status="working", terminal="xterm-256color", cwd="/Users/yarinmag/Documents"
[agent-status] Updated 1 agent(s) to "working"  ← Correct!
[cleanup] Removed 1 stale agent(s)  ← Auto cleanup
```

---

## 🎯 Benefits

1. **Accurate Agent Tracking**
   - Each agent tracked independently
   - Status updates target specific agent
   - No more duplicate/ghost agents

2. **Automatic Cleanup**
   - Stale agents removed automatically
   - No manual "Clean Up" needed
   - Dashboard always shows current state

3. **Better Debugging**
   - Server logs show matching criteria
   - Warnings when no agents matched
   - Clear indication of which agent updated

4. **Reliable Monitoring**
   - Trust the agent count
   - Independent status tracking
   - Real-time accurate data

---

## 🔧 Configuration

### Adjust Cleanup Interval

Edit `apps/server/src/index.ts`:
```typescript
const CLEANUP_INTERVAL_MS = 10000; // Change this (milliseconds)
```

**Recommendations:**
- **10s** (default): Good balance of responsiveness and load
- **5s**: More aggressive cleanup, slightly higher load
- **30s**: Less frequent, lower load, slower cleanup

### Adjust Stale Timeout

Edit `apps/server/src/agents.ts`:
```typescript
export async function markStaleAgents(): Promise<number> {
  const result = await query(
    `DELETE FROM agents
     WHERE status IN ('working', 'starting', 'blocked', 'idle')
       AND last_activity < NOW() - INTERVAL '30 seconds'  // Change this
     RETURNING agent_id`
  );
  return result.length;
}
```

**Recommendations:**
- **30s** (default): Safe timeout, handles brief disconnections
- **60s**: More conservative, for unstable networks
- **15s**: Aggressive, for fast cleanup

---

## ⚠️ Important Notes

### MCP Hook Behavior

The Claude MCP server sends hooks without `agent_id`, so we rely on:
- `terminal` field (e.g., "xterm-256color")
- `cwd` field (current working directory)

**Best Case:** Both terminal + cwd provided → Exact match
**Good Case:** Only terminal or cwd → Partial match
**Fallback:** Neither provided → Updates most recent agent

### Multiple Sessions Same Folder

If you run 2+ Claude sessions in the **same folder** with the **same terminal**:
- The matching may update both (they look identical)
- Solution: Run agents in different folders or different terminals

### Manual Cleanup Still Available

The "Clean Up All" button still works and is useful for:
- Clearing all agents at once
- Development/testing
- Force reset of dashboard

---

## 🐛 Troubleshooting

### Problem: Still seeing duplicate agents

**Check:**
1. Are both agents in same folder? → Move to different folders
2. Is cleanup running? → Check server logs for `[cleanup]` messages
3. Are agents sending heartbeats? → Check `last_activity` timestamp

**Quick fix:**
- Click "Clean Up All" button
- Wait 30 seconds for auto cleanup
- Restart Claude session

### Problem: Agents disappear too quickly

**Check:**
1. Cleanup interval too aggressive?
2. Network latency causing delayed heartbeats?

**Fix:**
- Increase stale timeout from 30s to 60s
- Increase cleanup interval from 10s to 30s

### Problem: Agent status not updating

**Check server logs:**
```bash
# Look for these messages
[agent-status] Hook received: status="working", terminal="...", cwd="..."
[agent-status] Updated 1 agent(s) to "working"
[agent-status] No agents matched for update  ← Problem!
```

**If no agents matched:**
- Check if terminal/cwd fields are being sent
- Verify agent exists in database
- Check for typos in terminal/cwd values

---

## ✅ Verification

### Test 1: Single Agent
1. Start one Claude session
2. Dashboard shows 1 agent ✅
3. Check status updates correctly
4. Close Claude
5. After 30s, agent disappears ✅

### Test 2: Multiple Agents
1. Start Claude in "Documents"
2. Start Claude in "client-staging"
3. Dashboard shows 2 agents ✅
4. Send status hook from each
5. Each updates independently ✅

### Test 3: Stale Cleanup
1. Start Claude
2. Kill Claude process (force quit)
3. Wait 30 seconds
4. Agent automatically removed ✅
5. Dashboard updates

---

## 🎉 Summary

- ✅ Fixed duplicate agent display
- ✅ Smart agent matching by terminal + cwd
- ✅ Automatic stale agent cleanup every 10s
- ✅ Independent status tracking per agent
- ✅ Accurate agent counts
- ✅ Real-time dashboard updates
- ✅ Better server logging

The dashboard now accurately reflects the actual running agents! 🚀
