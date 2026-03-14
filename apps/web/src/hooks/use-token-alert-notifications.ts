import { useEffect, useMemo } from "react";
import type { AgentSnapshot } from "@marionette/shared";
import { tokenAlertStorage } from "../lib/token-alerts";

async function fireNotification(title: string, body: string): Promise<void> {
  if (typeof Notification === "undefined") return;
  if (Notification.permission === "default") {
    await Notification.requestPermission();
  }
  if (Notification.permission !== "granted") return;
  new Notification(title, { body, icon: "/favicon.ico" });
}

/**
 * Watches agent total_tokens and fires browser notifications when user-defined
 * token thresholds are exceeded. Each alert fires at most once and is then
 * permanently marked as spent in localStorage.
 */
export function useTokenAlertNotifications(agents: AgentSnapshot[]) {
  // Recalculate when any agent's total_tokens changes
  const tokenKey = useMemo(
    () => agents.map((a) => `${a.agent_id}:${a.total_tokens}`).sort().join("|"),
    [agents]
  );

  useEffect(() => {
    for (const agent of agents) {
      const alerts = tokenAlertStorage.getAlerts(agent.agent_id);
      const name = agent.agent_name ?? agent.agent_id;

      for (const alert of alerts) {
        if (!alert.fired && alert.threshold <= agent.total_tokens) {
          tokenAlertStorage.markFired(alert.id);
          void fireNotification(
            `Agent '${name}' passed ${alert.threshold.toLocaleString()} tokens`,
            `Total tokens used: ${agent.total_tokens.toLocaleString()}`
          );
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenKey]);
}
