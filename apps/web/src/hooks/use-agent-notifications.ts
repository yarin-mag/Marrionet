import { useEffect, useRef, useMemo } from "react";
import type { AgentSnapshot, AgentStatus } from "@marionette/shared";

function fireNotification(agent: AgentSnapshot) {
  if (typeof Notification === "undefined") return;
  if (Notification.permission === "granted") {
    new Notification(agent.agent_name ?? agent.agent_id, {
      body:
        agent.status === "awaiting_input"
          ? "Waiting for your input"
          : "An error occurred",
      icon: "/favicon.ico",
    });
  } else if (Notification.permission === "default") {
    Notification.requestPermission().then((p) => {
      if (p === "granted") fireNotification(agent);
    });
  }
}

/**
 * Watches for agent status transitions to `awaiting_input` or `error` and fires
 * a browser notification when one occurs.
 *
 * Uses a stable derived key (sorted "id:status" pairs) as the effect dependency so
 * the effect only runs when statuses actually change, not on every React Query refetch
 * that returns a new array reference with identical data.
 */
export function useAgentNotifications(agents: AgentSnapshot[]) {
  const prevStatuses = useRef<Record<string, AgentStatus>>({});

  // Stable string that only changes when an agent's status changes.
  const statusKey = useMemo(
    () =>
      agents
        .map((a) => `${a.agent_id}:${a.status}`)
        .sort()
        .join("|"),
    [agents]
  );

  useEffect(() => {
    // Prune entries for agents no longer present
    const currentIds = new Set(agents.map((a) => a.agent_id));
    for (const id of Object.keys(prevStatuses.current)) {
      if (!currentIds.has(id)) delete prevStatuses.current[id];
    }

    for (const agent of agents) {
      const prev = prevStatuses.current[agent.agent_id];
      const curr = agent.status;
      if (prev && prev !== curr) {
        if (curr === "awaiting_input" || curr === "error") {
          fireNotification(agent);
        }
      }
      prevStatuses.current[agent.agent_id] = curr;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusKey]);
}
