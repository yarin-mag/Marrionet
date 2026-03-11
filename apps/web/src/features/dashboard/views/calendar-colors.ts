import type { AgentSession } from "../../../services/calendar.service";
import type { PersonalTask } from "../../../services/personal-tasks.service";
import type { Event } from "react-big-calendar";

export interface CalendarEvent extends Event {
  type: "agent" | "personal";
  session?: AgentSession;
  personalTask?: PersonalTask;
}

export const PERSONAL_TASK_COLOR = {
  bg: "#84cc16",
  text: "#1a2e05",
  border: "#65a30d",
};

export const AGENT_COLORS = [
  { bg: "#3b82f6", text: "#ffffff", border: "#2563eb" }, // blue
  { bg: "#10b981", text: "#ffffff", border: "#059669" }, // green
  { bg: "#a855f7", text: "#ffffff", border: "#9333ea" }, // purple
  { bg: "#f97316", text: "#ffffff", border: "#ea580c" }, // orange
  { bg: "#ec4899", text: "#ffffff", border: "#db2777" }, // pink
  { bg: "#06b6d4", text: "#ffffff", border: "#0891b2" }, // cyan
  { bg: "#f59e0b", text: "#ffffff", border: "#d97706" }, // amber
  { bg: "#6366f1", text: "#ffffff", border: "#4f46e5" }, // indigo
];

export function getAgentColor(agentId: string): (typeof AGENT_COLORS)[0] {
  const hash = agentId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return AGENT_COLORS[hash % AGENT_COLORS.length];
}

export function getEventStyle(event: CalendarEvent): { style: React.CSSProperties } {
  if (event.type === "personal") {
    return {
      style: {
        backgroundColor: PERSONAL_TASK_COLOR.bg,
        color: PERSONAL_TASK_COLOR.text,
        border: `2px dashed ${PERSONAL_TASK_COLOR.border}`,
        borderRadius: "6px",
      },
    };
  }
  const colors = getAgentColor(event.session!.agentId);
  return {
    style: {
      backgroundColor: colors.bg,
      color: colors.text,
      borderLeft: `4px solid ${colors.border}`,
      borderRadius: "6px",
    },
  };
}
