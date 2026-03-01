import type { AgentSnapshot } from "@marionette/shared";

/**
 * Dashboard aggregate statistics
 */
export interface DashboardStats {
  /** Total number of agents */
  totalCount: number;
  /** Number of working agents */
  workingCount: number;
  /** Number of idle agents */
  idleCount: number;
  /** Number of blocked agents */
  blockedCount: number;
  /** Number of agents with errors */
  errorCount: number;
  /** Number of agents needing attention (blocked/error/crashed) */
  needsAttentionCount: number;
  /** Number of retired (disconnected) agents */
  retiredCount: number;
}

/**
 * useDashboardStats hook - Computes aggregate stats from agent list
 * Calculates counts for each status category
 * @param agents - Array of agent snapshots
 * @returns Aggregate statistics object
 * @example
 * const { totalCount, workingCount, needsAttentionCount } = useDashboardStats(agents);
 */
export function useDashboardStats(agents: AgentSnapshot[]): DashboardStats {
  return {
    totalCount: agents.filter((a) => a.status !== "disconnected").length,
    workingCount: agents.filter((a) => a.status === "working").length,
    idleCount: agents.filter((a) => a.status === "idle").length,
    blockedCount: agents.filter((a) => a.status === "blocked").length,
    errorCount: agents.filter((a) =>
      ["error", "crashed"].includes(a.status)
    ).length,
    needsAttentionCount: agents.filter((a) =>
      ["blocked", "error", "crashed", "awaiting_input"].includes(a.status)
    ).length,
    retiredCount: agents.filter((a) => a.status === "disconnected").length,
  };
}
