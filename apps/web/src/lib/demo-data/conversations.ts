import type { EnrichedConversationTurn } from "../../features/agents/hooks/useAgentConversation";

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
