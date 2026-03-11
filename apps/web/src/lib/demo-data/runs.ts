import type { RunHistoryItem } from "../../features/agents/hooks/useAgentRuns";

const now = Date.now();

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
