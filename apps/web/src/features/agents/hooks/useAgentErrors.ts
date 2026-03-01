import { useQuery } from "@tanstack/react-query";
import { API_URL } from "../../../lib/constants";

export type AgentError = {
  id: number;
  type: string;
  summary: string | null;
  /** Normalized error message string (extracted from JSON error object if needed) */
  error: string | null;
  /** ISO timestamp mapped from the API's `ts` field */
  timestamp: string;
};

/**
 * Fetches the most recent log.error events for an agent.
 * Only fires when `enabled` is true (lazy / on-demand).
 * Maps API fields (ts → timestamp, error object → string) to a clean shape.
 */
export function useAgentErrors(agentId: string, enabled: boolean) {
  return useQuery<AgentError[]>({
    queryKey: ["agent-errors", agentId],
    queryFn: () =>
      fetch(`${API_URL}/api/events?agent_id=${encodeURIComponent(agentId)}&type=log.error&limit=5`)
        .then((r) => r.json())
        .then((events: Array<Record<string, unknown>>) =>
          events.map((e) => ({
            id: e.id as number,
            type: e.type as string,
            summary: (e.summary as string | null) ?? null,
            error:
              typeof e.error === "string"
                ? e.error
                : e.error != null && typeof (e.error as Record<string, unknown>).message === "string"
                  ? ((e.error as Record<string, unknown>).message as string)
                  : null,
            timestamp: (e.ts as string) ?? (e.created_at as string) ?? "",
          }))
        ),
    enabled,
    staleTime: 10_000,
  });
}
