import { useEffect, useRef, useMemo } from "react";
import type { AgentSnapshot, AgentStatus } from "@marionette/shared";
import { AGENT_STATUS } from "@marionette/shared";
import { loadPreferences, fetchServerPreference } from "../lib/user-preferences";
import { AWAITING_INPUT_DEBOUNCE_MS } from "../lib/notification-constants";

async function fireNotification(title: string, body: string): Promise<void> {
  if (typeof Notification === "undefined") return;
  if (Notification.permission === "default") {
    await Notification.requestPermission();
  }
  if (Notification.permission !== "granted") return;
  new Notification(title, { body, icon: "/favicon.ico" });
}

/**
 * Watches agent status transitions and fires configurable browser notifications.
 *
 * Which events notify is controlled by the user's notification preferences in localStorage.
 * `awaiting_input` is debounced so rapid back-and-forth transitions don't spam the user —
 * the notification only fires if the agent stays in that state for AWAITING_INPUT_DEBOUNCE_MS.
 *
 * Browser notifications are skipped when the user has selected the "discord" notification channel.
 */
export function useAgentNotifications(agents: AgentSnapshot[]) {
  const prevStatuses = useRef<Record<string, AgentStatus | undefined>>({});
  // One pending debounce timer per agent — cancelled on every status change
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  // Cache the notification channel preference — fetched once on mount
  const notificationChannel = useRef<"browser" | "discord">("browser");

  // Fetch channel preference once on mount
  useEffect(() => {
    fetchServerPreference<"browser" | "discord">("notificationChannel", "browser").then((ch) => {
      notificationChannel.current = ch;
    });
  }, []);

  // Stable string that only changes when an agent's status actually changes
  const statusKey = useMemo(
    () => agents.map((a) => `${a.agent_id}:${a.status}`).sort().join("|"),
    [agents]
  );

  useEffect(() => {
    // Skip browser notifications when the user chose Discord as their channel
    if (notificationChannel.current === "discord") return;

    const { notifications: prefs } = loadPreferences();
    const currentIds = new Set(agents.map((a) => a.agent_id));

    // Prune agents no longer present and cancel their pending timers
    for (const id of Object.keys(prevStatuses.current)) {
      if (currentIds.has(id)) continue;
      clearTimeout(debounceTimers.current[id]);
      delete debounceTimers.current[id];
      delete prevStatuses.current[id];
    }

    for (const agent of agents) {
      // Sub-agents are implementation details of their parent — skip all notifications.
      // Mirror the Discord filter: check both is_subagent and parent_agent_id.
      if (agent.is_subagent || agent.parent_agent_id) continue;

      const prev = prevStatuses.current[agent.agent_id];
      const curr = agent.status;
      prevStatuses.current[agent.agent_id] = curr;

      if (prev === curr || prev === undefined) continue;

      // Always cancel any pending debounce when status changes
      clearTimeout(debounceTimers.current[agent.agent_id]);
      delete debounceTimers.current[agent.agent_id];

      const name = agent.agent_name ?? agent.agent_id;

      if (curr === AGENT_STATUS.AWAITING_INPUT && prefs.awaitingInput) {
        debounceTimers.current[agent.agent_id] = setTimeout(
          () => void fireNotification(name, "Waiting for your input"),
          AWAITING_INPUT_DEBOUNCE_MS
        );
        continue;
      }

      if ((curr === AGENT_STATUS.FINISHED || curr === AGENT_STATUS.DISCONNECTED) && prefs.agentFinished) {
        void fireNotification(name, "Agent session finished");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusKey]);

  // Cancel all pending timers on unmount
  useEffect(() => {
    return () => {
      for (const timer of Object.values(debounceTimers.current)) {
        clearTimeout(timer);
      }
    };
  }, []);
}
