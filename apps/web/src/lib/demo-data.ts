import type { AgentSnapshot } from "@marionette/shared";
import type { EnrichedConversationTurn } from "../features/agents/hooks/useAgentConversation";
import type { RunHistoryItem } from "../features/agents/hooks/useAgentRuns";
import type { AgentError } from "../features/agents/hooks/useAgentErrors";
import type { AgentSession } from "../services/calendar.service";

// ─── Agents ──────────────────────────────────────────────────────────────────

export const DEMO_AGENTS: AgentSnapshot[] = [
  {
    agent_id: "demo-agent-1",
    agent_name: "Aria",
    status: "working",
    current_task: "Feature: Add OAuth2 login flow with Google & GitHub providers",
    last_activity: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    terminal: "VS Code",
    cwd: "/Users/alex/projects/webapp",
    total_runs: 24,
    total_tasks: 87,
    total_errors: 3,
    total_tokens: 1_420_800,
    total_duration_ms: 14_400_000,
    session_start: new Date(Date.now() - 2.5 * 60 * 60 * 1000).toISOString(),
    session_runs: 6,
    session_errors: 0,
    session_tokens: 183_500,
    status_since: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
    metadata: {
      custom_name: "Aria",
      labels: ["auth", "backend"],
      token_budget: 500_000,
    },
  },
  {
    agent_id: "demo-agent-2",
    agent_name: "Titan",
    status: "working",
    current_task: "Bug Investigation: N+1 query causing dashboard to load in 8s",
    last_activity: new Date(Date.now() - 45 * 1000).toISOString(),
    terminal: "Windows Terminal",
    cwd: "C:/Projects/api-service",
    total_runs: 51,
    total_tasks: 210,
    total_errors: 12,
    total_tokens: 3_890_000,
    total_duration_ms: 48_600_000,
    session_start: new Date(Date.now() - 1.2 * 60 * 60 * 1000).toISOString(),
    session_runs: 4,
    session_errors: 1,
    session_tokens: 94_200,
    status_since: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    metadata: {
      custom_name: "Titan",
      labels: ["perf", "database"],
      jira_tickets: ["PROJ-441"],
    },
  },
  {
    agent_id: "demo-agent-3",
    agent_name: "Echo",
    status: "awaiting_input",
    current_task: "Refactor: Migrate class components to hooks (12 files remaining)",
    last_activity: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
    terminal: "iTerm2",
    cwd: "/home/sam/frontend",
    total_runs: 18,
    total_tasks: 63,
    total_errors: 2,
    total_tokens: 980_400,
    total_duration_ms: 9_720_000,
    session_start: new Date(Date.now() - 55 * 60 * 1000).toISOString(),
    session_runs: 3,
    session_errors: 0,
    session_tokens: 61_700,
    status_since: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
    metadata: {
      custom_name: "Echo",
      labels: ["frontend", "refactor"],
      notes: "Waiting for confirmation before deleting legacy HOC wrappers",
    },
  },
  {
    agent_id: "demo-agent-4",
    agent_name: "Nova",
    status: "blocked",
    current_task: "Research: Understanding the codebase payment module",
    last_activity: new Date(Date.now() - 11 * 60 * 1000).toISOString(),
    terminal: "Warp",
    cwd: "/workspace/payments",
    total_runs: 9,
    total_tasks: 31,
    total_errors: 5,
    total_tokens: 540_100,
    total_duration_ms: 5_400_000,
    session_start: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    session_runs: 2,
    session_errors: 2,
    session_tokens: 38_900,
    status_since: new Date(Date.now() - 11 * 60 * 1000).toISOString(),
    metadata: {
      custom_name: "Nova",
      labels: ["payments", "research"],
      jira_tickets: ["PROJ-388", "PROJ-392"],
    },
  },
  {
    agent_id: "demo-agent-5",
    agent_name: "Zion",
    status: "idle",
    current_task: undefined,
    last_activity: new Date(Date.now() - 28 * 60 * 1000).toISOString(),
    terminal: "Ghostty",
    cwd: "/Users/jordan/mobile-app",
    total_runs: 35,
    total_tasks: 140,
    total_errors: 4,
    total_tokens: 2_100_000,
    total_duration_ms: 27_000_000,
    session_start: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    session_runs: 8,
    session_errors: 0,
    session_tokens: 241_300,
    status_since: new Date(Date.now() - 28 * 60 * 1000).toISOString(),
    metadata: {
      custom_name: "Zion",
      labels: ["mobile", "ios"],
    },
  },
  {
    agent_id: "demo-agent-6",
    agent_name: "Rex",
    status: "error",
    current_task: "Deploy: Run production migration scripts",
    last_activity: new Date(Date.now() - 52 * 60 * 1000).toISOString(),
    terminal: "VS Code",
    cwd: "/srv/deploy",
    total_runs: 14,
    total_tasks: 55,
    total_errors: 18,
    total_tokens: 720_500,
    total_duration_ms: 7_200_000,
    session_start: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    session_runs: 3,
    session_errors: 4,
    session_tokens: 52_100,
    status_since: new Date(Date.now() - 52 * 60 * 1000).toISOString(),
    metadata: {
      custom_name: "Rex",
      labels: ["devops", "deploy"],
      jira_tickets: ["OPS-77"],
    },
  },
];

// ─── Conversations ────────────────────────────────────────────────────────────

const now = Date.now();

const makeConversation = (agentId: string, exchanges: Array<[string, string]>): EnrichedConversationTurn[] =>
  exchanges.flatMap(([user, assistant], i) => [
    {
      id: `${agentId}-u-${i}`,
      agent_id: agentId,
      session_id: `session-${agentId}`,
      direction: "to_agent" as const,
      role: "user" as const,
      content: user,
      content_plain: user,
      timestamp: new Date(now - (exchanges.length - i) * 90_000).toISOString(),
    },
    {
      id: `${agentId}-a-${i}`,
      agent_id: agentId,
      session_id: `session-${agentId}`,
      direction: "from_agent" as const,
      role: "assistant" as const,
      content: assistant,
      content_plain: assistant,
      timestamp: new Date(now - (exchanges.length - i) * 90_000 + 12_000).toISOString(),
      tokens: { input_tokens: 1800 + i * 120, output_tokens: 420 + i * 60 },
    },
  ]);

export const DEMO_CONVERSATIONS: Record<string, EnrichedConversationTurn[]> = {
  "demo-agent-1": makeConversation("demo-agent-1", [
    [
      "Let's start on the OAuth2 integration. We need Google and GitHub.",
      "Sure! I'll start by installing the required packages — `passport`, `passport-google-oauth20`, and `passport-github2`. Then I'll scaffold the strategy files and wire them into the Express auth router.",
    ],
    [
      "Make sure the callback URLs are configurable via env vars.",
      "Done. I've extracted `GOOGLE_CALLBACK_URL` and `GITHUB_CALLBACK_URL` from `process.env` with sensible localhost defaults for development. The strategy initialisation now happens lazily so missing vars don't crash startup.",
    ],
    [
      "Can you also add session serialization?",
      "Added `passport.serializeUser` and `passport.deserializeUser` using the DB user ID. Sessions are stored in Redis via `connect-redis` so they survive restarts. I also scoped the session cookie to `httpOnly: true, sameSite: 'lax'` for security.",
    ],
  ]),
  "demo-agent-2": makeConversation("demo-agent-2", [
    [
      "The dashboard query is taking 8 seconds. Can you dig into it?",
      "Running `EXPLAIN ANALYZE` on the main dashboard query now. Initial scan shows a sequential scan on the `events` table — 2.4 million rows. No index on `(user_id, created_at)`. That's your N+1.",
    ],
    [
      "What's the fix?",
      "Two changes: (1) Add a composite index `CREATE INDEX CONCURRENTLY idx_events_user_created ON events(user_id, created_at DESC)`. (2) Rewrite the query to use a single JOIN instead of a subquery per user. Estimated improvement: ~95% reduction in latency.",
    ],
    [
      "Apply it and run the benchmarks.",
      "Migration applied. Benchmark results: P50 dropped from 8.1s → 210ms, P99 from 14.3s → 680ms. The index is 340 MB — acceptable for this table size. Pushing the migration file now.",
    ],
  ]),
  "demo-agent-3": makeConversation("demo-agent-3", [
    [
      "Start migrating the class components in /src/components/legacy.",
      "Found 12 class components. Starting with `UserProfile` — it has `componentDidMount` and `componentDidUpdate` which map cleanly to `useEffect`. Converting now.",
    ],
    [
      "Great. How many are done?",
      "8 of 12 converted and tests passing. The remaining 4 use `getSnapshotBeforeUpdate` which needs a custom hook wrapper. Before I proceed, should I delete the legacy HOC wrappers they depend on, or keep them for the transition period?",
    ],
  ]),
  "demo-agent-4": makeConversation("demo-agent-4", [
    [
      "I need you to understand the payment module before we refactor it.",
      "Reading through `/workspace/payments/src`. The module uses Stripe Checkout v2 — already deprecated. It also hard-codes currency as USD and doesn't handle webhook signature verification.",
    ],
    [
      "Can you map out the dependencies?",
      "Dependency map done. Blocked on one thing: `payment.service.ts` imports from `@internal/vault` which isn't in the repo. I need access to that package or its type definitions before I can trace the token flow.",
    ],
  ]),
  "demo-agent-5": makeConversation("demo-agent-5", [
    [
      "Ship the push notification feature for iOS.",
      "Implemented APNs integration via the `@parse/node-apn` library. Added device token registration endpoint, notification payload builder, and retry logic for expired tokens. All unit tests green.",
    ],
    [
      "Run the full test suite and submit for review.",
      "Test suite: 247 passed, 0 failed. Coverage at 89%. PR #214 opened — 'feat: iOS push notifications via APNs'. Tagged you and the mobile lead for review.",
    ],
  ]),
  "demo-agent-6": makeConversation("demo-agent-6", [
    [
      "Run the migration scripts on prod.",
      "Running `migrate:prod`. Script started — altering `subscriptions` table to add `cancel_at` column...",
    ],
    [
      "What happened?",
      "Migration failed at step 3/7: `ERROR 1215 (HY000): Cannot add foreign key constraint`. The `cancel_at` column references `billing_periods.id` but that table has a different collation (latin1 vs utf8mb4). Rolled back. Needs schema fix before retry.",
    ],
  ]),
};

// ─── LLM Calls ───────────────────────────────────────────────────────────────

function makeCalls(_agentId: string, count: number, model = "claude-sonnet-4-6") {
  return Array.from({ length: count }, (_, i) => ({
    ts: new Date(now - (count - i) * 5 * 60_000).toISOString(),
    summary: `llm.call #${i + 1}`,
    duration_ms: 800 + Math.floor(Math.random() * 3200),
    tokens: {
      input_tokens: 1200 + i * 80,
      output_tokens: 350 + i * 40,
      cache_read_input_tokens: i > 2 ? 800 : 0,
      cache_creation_input_tokens: i === 0 ? 1200 : 0,
      cost_usd: 0.004 + i * 0.0008,
    },
    payload: {
      model,
      stop_reason: i === count - 1 ? "end_turn" : "tool_use",
      streaming: true,
      ttft_ms: 180 + Math.floor(Math.random() * 120),
      messages_count: 4 + i * 2,
      tools_count: 8,
    },
  }));
}

export const DEMO_LLM_CALLS: Record<string, ReturnType<typeof makeCalls>> = {
  "demo-agent-1": makeCalls("demo-agent-1", 12),
  "demo-agent-2": makeCalls("demo-agent-2", 8),
  "demo-agent-3": makeCalls("demo-agent-3", 6),
  "demo-agent-4": makeCalls("demo-agent-4", 5),
  "demo-agent-5": makeCalls("demo-agent-5", 18),
  "demo-agent-6": makeCalls("demo-agent-6", 4),
};

// ─── Runs ─────────────────────────────────────────────────────────────────────

function makeRuns(agentId: string, count: number): RunHistoryItem[] {
  return Array.from({ length: count }, (_, i) => {
    const startedAt = new Date(now - (count - i) * 25 * 60_000);
    const durationMs = 8 * 60_000 + Math.floor(Math.random() * 12 * 60_000);
    return {
      run_id: `${agentId}-run-${i + 1}`,
      started_at: startedAt.toISOString(),
      ended_at: i < count - 1 ? new Date(startedAt.getTime() + durationMs).toISOString() : null,
      duration_ms: i < count - 1 ? durationMs : null,
      current_task: ["Feature: OAuth2", "Bug: N+1 query", "Refactor: hooks", "Research: payments", "Deploy: push notifs", "Deploy: migration"][i % 6],
      total_tokens: 15_000 + i * 8_000,
      total_cost_usd: 0.06 + i * 0.032,
    };
  });
}

export const DEMO_RUNS: Record<string, RunHistoryItem[]> = {
  "demo-agent-1": makeRuns("demo-agent-1", 6),
  "demo-agent-2": makeRuns("demo-agent-2", 4),
  "demo-agent-3": makeRuns("demo-agent-3", 3),
  "demo-agent-4": makeRuns("demo-agent-4", 2),
  "demo-agent-5": makeRuns("demo-agent-5", 8),
  "demo-agent-6": makeRuns("demo-agent-6", 3),
};

// ─── Errors ───────────────────────────────────────────────────────────────────

// ─── Calendar Sessions ────────────────────────────────────────────────────────

// Helper: date N days ago at a specific hour:minute
function daysAgo(days: number, hours: number, minutes = 0): Date {
  const d = new Date(now);
  d.setDate(d.getDate() - days);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

export const DEMO_CALENDAR_SESSIONS: AgentSession[] = [
  // ── Aria (demo-agent-1) — OAuth2 feature across the week ──
  {
    id: "cal-aria-1",
    agentId: "demo-agent-1",
    agentName: "Aria",
    task: "Feature: OAuth2 planning & package setup",
    startTime: daysAgo(4, 9, 0),
    endTime: daysAgo(4, 11, 30),
    status: "idle",
    tokens: 48_200,
    runs: 2,
    terminal: "VS Code",
    cwd: "/Users/alex/projects/webapp",
  },
  {
    id: "cal-aria-2",
    agentId: "demo-agent-1",
    agentName: "Aria",
    task: "Feature: Passport strategy files & Express router wiring",
    startTime: daysAgo(3, 10, 0),
    endTime: daysAgo(3, 13, 15),
    status: "idle",
    tokens: 72_400,
    runs: 3,
    terminal: "VS Code",
    cwd: "/Users/alex/projects/webapp",
  },
  {
    id: "cal-aria-3",
    agentId: "demo-agent-1",
    agentName: "Aria",
    task: "Feature: Callback URLs via env vars + dev defaults",
    startTime: daysAgo(2, 9, 30),
    endTime: daysAgo(2, 12, 0),
    status: "idle",
    tokens: 61_100,
    runs: 2,
    terminal: "VS Code",
    cwd: "/Users/alex/projects/webapp",
  },
  {
    id: "cal-aria-4",
    agentId: "demo-agent-1",
    agentName: "Aria",
    task: "Feature: Session serialization + Redis store",
    startTime: daysAgo(1, 14, 0),
    endTime: daysAgo(1, 16, 45),
    status: "idle",
    tokens: 58_600,
    runs: 2,
    terminal: "VS Code",
    cwd: "/Users/alex/projects/webapp",
  },
  {
    id: "cal-aria-5",
    agentId: "demo-agent-1",
    agentName: "Aria",
    task: "Feature: Add OAuth2 login flow with Google & GitHub providers",
    startTime: new Date(now - 2.5 * 60 * 60 * 1000),
    endTime: new Date(now),
    status: "working",
    tokens: 183_500,
    runs: 6,
    terminal: "VS Code",
    cwd: "/Users/alex/projects/webapp",
  },

  // ── Titan (demo-agent-2) — N+1 perf investigation ──
  {
    id: "cal-titan-1",
    agentId: "demo-agent-2",
    agentName: "Titan",
    task: "Bug Investigation: Dashboard slowness — initial profiling",
    startTime: daysAgo(4, 15, 0),
    endTime: daysAgo(4, 17, 30),
    status: "idle",
    tokens: 31_800,
    runs: 1,
    terminal: "Windows Terminal",
    cwd: "C:/Projects/api-service",
  },
  {
    id: "cal-titan-2",
    agentId: "demo-agent-2",
    agentName: "Titan",
    task: "Bug Investigation: EXPLAIN ANALYZE — sequential scan identified",
    startTime: daysAgo(3, 9, 0),
    endTime: daysAgo(3, 11, 0),
    status: "idle",
    tokens: 44_900,
    runs: 2,
    terminal: "Windows Terminal",
    cwd: "C:/Projects/api-service",
  },
  {
    id: "cal-titan-3",
    agentId: "demo-agent-2",
    agentName: "Titan",
    task: "Bug Investigation: Composite index + query rewrite + benchmarks",
    startTime: daysAgo(2, 10, 30),
    endTime: daysAgo(2, 13, 0),
    status: "idle",
    tokens: 52_100,
    runs: 2,
    terminal: "Windows Terminal",
    cwd: "C:/Projects/api-service",
  },
  {
    id: "cal-titan-4",
    agentId: "demo-agent-2",
    agentName: "Titan",
    task: "Bug Investigation: N+1 query causing dashboard to load in 8s",
    startTime: new Date(now - 1.2 * 60 * 60 * 1000),
    endTime: new Date(now),
    status: "working",
    tokens: 94_200,
    runs: 4,
    terminal: "Windows Terminal",
    cwd: "C:/Projects/api-service",
  },

  // ── Echo (demo-agent-3) — class → hooks refactor ──
  {
    id: "cal-echo-1",
    agentId: "demo-agent-3",
    agentName: "Echo",
    task: "Refactor: Planning class → hooks migration (12 files)",
    startTime: daysAgo(3, 14, 0),
    endTime: daysAgo(3, 16, 0),
    status: "idle",
    tokens: 22_300,
    runs: 1,
    terminal: "iTerm2",
    cwd: "/home/sam/frontend",
  },
  {
    id: "cal-echo-2",
    agentId: "demo-agent-3",
    agentName: "Echo",
    task: "Refactor: First 4 components converted to hooks",
    startTime: daysAgo(2, 9, 0),
    endTime: daysAgo(2, 12, 30),
    status: "idle",
    tokens: 38_700,
    runs: 2,
    terminal: "iTerm2",
    cwd: "/home/sam/frontend",
  },
  {
    id: "cal-echo-3",
    agentId: "demo-agent-3",
    agentName: "Echo",
    task: "Refactor: Components 5–8 done, getSnapshotBeforeUpdate wrappers",
    startTime: daysAgo(1, 10, 0),
    endTime: daysAgo(1, 13, 0),
    status: "idle",
    tokens: 41_200,
    runs: 2,
    terminal: "iTerm2",
    cwd: "/home/sam/frontend",
  },
  {
    id: "cal-echo-4",
    agentId: "demo-agent-3",
    agentName: "Echo",
    task: "Refactor: Migrate class components to hooks (12 files remaining)",
    startTime: new Date(now - 55 * 60 * 1000),
    endTime: new Date(now - 4 * 60 * 1000),
    status: "awaiting_input",
    tokens: 61_700,
    runs: 3,
    terminal: "iTerm2",
    cwd: "/home/sam/frontend",
  },

  // ── Nova (demo-agent-4) — payment module research ──
  {
    id: "cal-nova-1",
    agentId: "demo-agent-4",
    agentName: "Nova",
    task: "Research: Reading payment module — Stripe Checkout v2 audit",
    startTime: daysAgo(2, 16, 0),
    endTime: daysAgo(2, 17, 30),
    status: "idle",
    tokens: 18_400,
    runs: 1,
    terminal: "Warp",
    cwd: "/workspace/payments",
  },
  {
    id: "cal-nova-2",
    agentId: "demo-agent-4",
    agentName: "Nova",
    task: "Research: Dependency map — blocked on @internal/vault",
    startTime: daysAgo(1, 13, 0),
    endTime: daysAgo(1, 16, 0),
    status: "idle",
    tokens: 29_600,
    runs: 1,
    terminal: "Warp",
    cwd: "/workspace/payments",
  },
  {
    id: "cal-nova-3",
    agentId: "demo-agent-4",
    agentName: "Nova",
    task: "Research: Understanding the codebase payment module",
    startTime: new Date(now - 3 * 60 * 60 * 1000),
    endTime: new Date(now - 11 * 60 * 1000),
    status: "blocked",
    tokens: 38_900,
    runs: 2,
    terminal: "Warp",
    cwd: "/workspace/payments",
  },

  // ── Zion (demo-agent-5) — iOS push notifications ──
  {
    id: "cal-zion-1",
    agentId: "demo-agent-5",
    agentName: "Zion",
    task: "Feature: iOS push notification design & APNs planning",
    startTime: daysAgo(4, 10, 0),
    endTime: daysAgo(4, 14, 0),
    status: "idle",
    tokens: 54_300,
    runs: 3,
    terminal: "Ghostty",
    cwd: "/Users/jordan/mobile-app",
  },
  {
    id: "cal-zion-2",
    agentId: "demo-agent-5",
    agentName: "Zion",
    task: "Feature: APNs integration via @parse/node-apn + retry logic",
    startTime: daysAgo(3, 9, 0),
    endTime: daysAgo(3, 12, 30),
    status: "idle",
    tokens: 78_200,
    runs: 4,
    terminal: "Ghostty",
    cwd: "/Users/jordan/mobile-app",
  },
  {
    id: "cal-zion-3",
    agentId: "demo-agent-5",
    agentName: "Zion",
    task: "Feature: Full test suite run — PR #214 opened",
    startTime: daysAgo(2, 13, 0),
    endTime: daysAgo(2, 15, 30),
    status: "idle",
    tokens: 62_400,
    runs: 3,
    terminal: "Ghostty",
    cwd: "/Users/jordan/mobile-app",
  },
  {
    id: "cal-zion-4",
    agentId: "demo-agent-5",
    agentName: "Zion",
    task: "Deploy: Push notification feature review & addressing feedback",
    startTime: new Date(now - 4 * 60 * 60 * 1000),
    endTime: new Date(now - 28 * 60 * 1000),
    status: "idle",
    tokens: 241_300,
    runs: 8,
    terminal: "Ghostty",
    cwd: "/Users/jordan/mobile-app",
  },

  // ── Rex (demo-agent-6) — production migration ──
  {
    id: "cal-rex-1",
    agentId: "demo-agent-6",
    agentName: "Rex",
    task: "Deploy: Migration script prep & staging dry-run",
    startTime: daysAgo(2, 11, 0),
    endTime: daysAgo(2, 12, 30),
    status: "idle",
    tokens: 19_800,
    runs: 1,
    terminal: "VS Code",
    cwd: "/srv/deploy",
  },
  {
    id: "cal-rex-2",
    agentId: "demo-agent-6",
    agentName: "Rex",
    task: "Deploy: Staging migration test — collation mismatch found",
    startTime: daysAgo(1, 11, 0),
    endTime: daysAgo(1, 14, 0),
    status: "idle",
    tokens: 33_700,
    runs: 2,
    terminal: "VS Code",
    cwd: "/srv/deploy",
  },
  {
    id: "cal-rex-3",
    agentId: "demo-agent-6",
    agentName: "Rex",
    task: "Deploy: Run production migration scripts",
    startTime: new Date(now - 5 * 60 * 60 * 1000),
    endTime: new Date(now - 52 * 60 * 1000),
    status: "error",
    tokens: 52_100,
    runs: 3,
    terminal: "VS Code",
    cwd: "/srv/deploy",
  },
];

// ─── Errors ───────────────────────────────────────────────────────────────────

export const DEMO_ERRORS: Record<string, AgentError[]> = {
  "demo-agent-6": [
    {
      id: 1,
      type: "log.error",
      summary: "Migration failed: foreign key constraint",
      error: "ERROR 1215 (HY000): Cannot add foreign key constraint — collation mismatch (latin1 vs utf8mb4)",
      timestamp: new Date(now - 52 * 60_000).toISOString(),
    },
    {
      id: 2,
      type: "log.error",
      summary: "Rollback triggered",
      error: "Transaction rolled back after step 3/7 failed. Database restored to pre-migration state.",
      timestamp: new Date(now - 51 * 60_000).toISOString(),
    },
  ],
  "demo-agent-4": [
    {
      id: 3,
      type: "log.error",
      summary: "Missing dependency: @internal/vault",
      error: "Cannot find module '@internal/vault' — package not available in current workspace",
      timestamp: new Date(now - 11 * 60_000).toISOString(),
    },
  ],
  "demo-agent-2": [
    {
      id: 4,
      type: "log.error",
      summary: "Benchmark runner timeout",
      error: "Query benchmark timed out after 30s on first run (cold cache). Subsequent runs succeeded.",
      timestamp: new Date(now - 35 * 60_000).toISOString(),
    },
  ],
};
