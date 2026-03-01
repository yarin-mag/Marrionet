# Messup Fixes

Issues identified during codebase reliability review. Ordered by priority.

---

## 1. No Tests

Tests were removed (scripts/src/__tests__/ deleted). There is currently zero test coverage across the entire codebase.

**Risk:** Any refactor, dependency update, or edge-case bug has no regression safety net. The file-watcher's stateful logic (byte offsets, agent ID derivation, inactivity detection) is particularly risky to modify without tests.

**Status:** Planned for a future task.

---

## 2. TypeScript Build Errors

`noUnusedLocals: true` and `noUnusedParameters: true` are set in `tsconfig.base.json`, and both `apps/server` and `apps/web` currently fail `tsc --noEmit`.

### Server errors (6 total) — low severity, cosmetic
All are unused Express parameters (`req`, `res`, `next`) that could be prefixed with `_`:
```
apps/server/src/app.ts(29,17): error TS6133: 'res' is declared but never read.
apps/server/src/controllers/agents.controller.ts(30,23): error TS6133: 'req' is declared but never read.
apps/server/src/controllers/agents.controller.ts(36,19): error TS6133: 'req' is declared but never read.
apps/server/src/controllers/status.controller.ts(13,21): error TS6133: 'req' is declared but never read.
apps/server/src/controllers/status.controller.ts(20,19): error TS6133: 'req' is declared but never read.
apps/server/src/middleware/error-handler.ts(12,3): error TS6133: 'next' is declared but never read.
```

### Web errors (18 total) — mixed severity

**Cosmetic (noUnusedLocals):** Unused imports in UI components (`React`, `Card`, `ChevronDown`, `FancyStatCard`, `ISRAELI_TIMEZONE`, etc.)

**Actual type error (high severity):**
```
apps/web/src/features/agents/hooks/useAgents.ts(68,61): error TS2339: Property 'agent_id' does not exist on type 'WsMessage'.
apps/web/src/features/agents/hooks/useAgents.ts(72,40): error TS2339: Property 'agent_id' does not exist on type 'WsMessage'.
apps/web/src/features/agents/hooks/useAgents.ts(73,40): error TS2339: Property 'updates' does not exist on type 'WsMessage'.
apps/web/src/features/agents/hooks/useAgents.ts(78,31): error TS2339: Property 'agent_id' does not exist on type 'WsMessage'.
apps/web/src/features/agents/hooks/useAgents.ts(78,49): error TS2339: Property 'updates' does not exist on type 'WsMessage'.
```

**Root cause:** `WsMessage` in `apps/web/src/services/ws.service.ts` is typed as `{ type: string; data?: unknown }`. But `useAgents.ts` accesses `message.agent_id` and `message.updates` on `agent_update` messages. TypeScript doesn't know these fields exist, so it can't catch future renames or schema changes. It works at runtime today only by luck — if the server changes the field names, the frontend silently breaks.

**Fix:** Add an `agent_update` variant to the `WsMessage` union type, or cast properly.

---

## 3. esbuild Postinstall Fails

**What it is:** `esbuild` uses platform-specific native binaries installed via a postinstall script. On some machines (CI, restricted environments, or architecture mismatches), `pnpm install` fails at the esbuild postinstall step.

**Workaround documented in memory:** Use `pnpm install --ignore-scripts`, but this skips the binary download and then esbuild itself doesn't work.

**Impact:**
- New contributors may be completely blocked during setup with no obvious fix.
- CI pipelines on non-standard architectures (e.g., Linux ARM, some Docker images) can fail silently.
- The esbuild binary is used by Vite (web app) and potentially by mcp-server build — a broken esbuild means the web app won't build at all.

**Suggested fix:** Pin the esbuild version across packages, or add a `postinstall` fallback in the root `package.json` that catches this failure and prints a clear message. Alternatively, move to a version of Vite that bundles esbuild more reliably.

---

## 4. 5-Minute Guard on Session Counter Reset

**What it is:** When a `conversation.started` event arrives (new session), the server only resets `session_runs`, `session_errors`, and `session_tokens` to 0 if the agent's `last_activity` was **more than 5 minutes ago**.

**Location:** `apps/server/src/repositories/agent.repository.ts:68-70`
```sql
session_runs   = CASE WHEN agents.last_activity < datetime('now', '-5 minutes') THEN 0 ELSE agents.session_runs END,
session_errors = CASE WHEN agents.last_activity < datetime('now', '-5 minutes') THEN 0 ELSE agents.session_errors END,
session_tokens = CASE WHEN agents.last_activity < datetime('now', '-5 minutes') THEN 0 ELSE agents.session_tokens END,
```

**Why it exists:** To avoid resetting counters when a WebSocket reconnect triggers a spurious `conversation.started` event (WS reconnects frequently and shouldn't look like a new session).

**The bug scenario:**
1. You run Claude on project A. It uses 12,000 tokens across 3 runs. Session counters = `{ session_tokens: 12000, session_runs: 3 }`.
2. You close Claude, immediately run `/clear`, then open Claude again in the same project within 5 minutes.
3. Claude creates a new JSONL file → file-watcher emits `conversation.started`.
4. The 5-min guard fires: `last_activity` was <5 min ago → counters are **not reset**.
5. The dashboard now shows the new session with 12,000 tokens already "used" and 3 runs already counted, even though this is a fresh conversation.

**Consequence:** Session-level metrics are unreliable for power users who start conversations in rapid succession. The "this session" stats shown in the UI may be inflated.

**A better fix:** Use the actual `sessionId` from the JSONL filename (a UUID, changes on every `/clear`) to detect genuine new sessions, instead of the 5-minute time heuristic. If `sessionId` changed → reset counters. If same `sessionId` → keep.

---

## 5. Chokidar v4 Glob Broken on macOS

**What it is:** In chokidar v4, passing glob patterns like `~/.claude/projects/**/*.jsonl` directly to `chokidar.watch()` is broken on macOS (patterns don't match correctly).

**Location:** `packages/file-watcher/src/watcher.ts:416`
```typescript
// Watch the directory directly — chokidar v4 glob patterns are broken on macOS.
// Filter for .jsonl files in each event handler instead.
const watcher = chokidar.watch(config.projectsDir, { ... });
```

**What the workaround does:** Watch the entire `projectsDir` directory tree (every file and subdirectory), then manually filter for `.jsonl` in each event handler:
```typescript
watcher.on("add", (filePath: string) => {
  if (!filePath.endsWith(".jsonl")) return; // manual filter
  ...
```

**Why this matters:**
1. **Performance:** Every file write in `~/.claude/projects/` (including Claude's own temp files, lock files, etc.) fires a chokidar event, even though 99% are silently dropped. On a machine with many active Claude projects this adds unnecessary overhead.
2. **Fragility:** The workaround is a silent deviation from the intended chokidar API. If chokidar is upgraded to a version that fixes glob on macOS, the workaround won't break (it'll still work), but the intent is lost — no one will know to clean it up.
3. **No bug report / version pin:** There's no link to the upstream chokidar issue or a version pin to avoid accidentally upgrading to a broken version of chokidar v4. If the team upgrades chokidar and the glob fix isn't there yet, the bug returns silently — the watcher would start processing 0 events without any error.

**Suggested fix:** Add a `// TODO: remove manual filter when chokidar v4 glob is fixed on macOS — see <issue link>` comment, and pin the chokidar minor version in `packages/file-watcher/package.json`.

---

## 6. `source` Metadata Always `"cli"` for VS Code Sessions (File Watcher)

**What it is:** The file watcher hardcodes `source: "cli"` in `buildMetadata()`, regardless of whether the Claude instance that wrote the JSONL was running in a terminal or the VS Code extension.

**Location:** `packages/file-watcher/src/event-mapper.ts:77`
```typescript
export function buildMetadata(entry: ClaudeJsonlEntry): AgentMetadata {
  return {
    name: entry.slug ?? (entry.cwd ? basename(entry.cwd) : "claude-agent"),
    cwd: entry.cwd,
    version: entry.version,
    source: "cli",  // ← always "cli", even for VS Code sessions
  };
}
```

**Why this matters:** `AgentMetadata.source` is a `"cli" | "vscode" | "mcp"` union. The MCP server correctly sets `source: "vscode"` when it detects `VSCODE_PID`/`VSCODE_IPC_HOOK_CLI`/`TERM_PROGRAM=vscode`. But the file watcher — which is the dominant event source and fires for every session regardless of MCP — always overwrites or emits `"cli"`. So:

- If Claude Code runs inside VS Code **without** the MCP server loaded, every event is tagged `source: "cli"`. The dashboard can never tell it was a VS Code session.
- If Claude Code runs inside VS Code **with** the MCP server loaded, the `conversation.started` event (the very first lifecycle event) comes from the file watcher and is tagged `"cli"`. The MCP server's `agent.started` or `marionette_set_task` call may later patch the metadata to `"vscode"`, but the first impression is wrong.
- Any dashboard feature that branches on `source` (e.g., showing a VS Code icon, filtering by environment) will silently misclassify VS Code sessions.

**How to detect the actual source from JSONL:** Claude Code writes a `gitBranch` field and a `version` field into JSONL entries but does **not** write a `source` or `TERM_PROGRAM` field. However, the cwd-to-slug mapping and the existence of VS Code environment variables at file-watcher startup time could be used to infer this. A more reliable approach: when the MCP server writes the temp file (`agentTempFilePath(cwd)`), also write the source (`"vscode"` or `"cli"`), so the file watcher can read it at session init time.

**Suggested fix:**
1. Extend the temp file format written by `writeTempFile()` in `packages/mcp-server/src/utils/agent-ids.ts` to include the source: e.g., `agent_abc123\nvscode`.
2. Update `readMcpAgentId()` in `packages/file-watcher/src/watcher.ts` to also parse the source line.
3. Pass the source into `buildMetadata()` instead of hardcoding `"cli"`.
4. Fall back to `"cli"` when no temp file exists (no MCP server running — likely a plain terminal session).

---

## 7. Agent ID Race Condition on VS Code Session Start

**What it is:** In VS Code, Claude Code starts the MCP server slightly after the session hook fires. The `on-session-start.sh` hook has a 1-second retry for this case, but 1 second is not always enough. If the MCP server takes longer to initialize, the hook computes a **different** agent ID than what the MCP server and file watcher will use, causing the same Claude instance to appear as two separate agents in the dashboard.

**Location:** `scripts/hooks/on-session-start.sh:73-81`
```bash
# 3. VSCode race-condition retry: MCP server may still be initializing
if [ -z "$AGENT_ID" ] && { [ -n "${VSCODE_PID:-}" ] || [ "${TERM_PROGRAM:-}" = "vscode" ]; }; then
  sleep 1
  if [ -f "$AGENT_TMPFILE" ]; then
    _tmp=$(cat "$AGENT_TMPFILE" 2>/dev/null || echo "")
    if [[ "$_tmp" =~ ^agent_[0-9a-f]{16}$ ]]; then
      AGENT_ID="$_tmp"
    fi
  fi
fi
```

**The race in detail:**
1. VS Code launches Claude Code extension.
2. Claude Code fires `PreToolUse` hook → `on-session-start.sh` runs.
3. Hook checks temp file (`/tmp/marionette-agent-<hash>`) — MCP server hasn't written it yet → misses.
4. Hook falls back to API lookup (step 2 in the script) — no agent registered yet → misses.
5. Hook sleeps 1 second, retries temp file — if MCP server still initializing → misses again.
6. Hook falls back to the legacy formula: `sha256(hostname:TERM_SESSION_ID:cwd:)[0:16]`.
7. MCP server finally starts, computes agent ID from the **JSONL session file** (`deriveAgentIdFromSession`), writes temp file.
8. File watcher sees the new JSONL, also uses `deriveAgentIdFromSession` → agrees with MCP server.
9. Result: hook registered a **different** agent ID (legacy formula) than MCP server + file watcher (session-based formula) → two phantom agents, or the proxy registration points to a stale ID.

**Why the fallback formulas diverge:**
- Hook fallback: `sha256("hostname:TERM_SESSION_ID:cwd:")[0:16]`
- MCP server primary: `sha256(sessionId)[0:16]` (session UUID from JSONL filename)
- These two hashes are almost never equal.

**Current impact:** The proxy registration (the main purpose of the hook) lands on the wrong agent ID. Since `on-session-start.sh` is otherwise a no-op (file watcher owns lifecycle), the practical damage is limited to the proxy attribution. But if the hook role ever expands, this becomes a bigger issue.

**Suggested fix:** Remove the 1-second sleep + retry and instead make the hook's only job a **deferred** registration: poll the temp file for up to 10 seconds with short intervals (e.g., 10 × 1s), then give up. Alternatively, move proxy registration entirely into the MCP server startup path (it already calls `registerWithProxy()`) and delete the hook's registration logic. The hook would then be a true no-op for VS Code.
