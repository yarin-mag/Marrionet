import type { AgentError } from "../../features/agents/hooks/useAgentErrors";

const now = Date.now();

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
