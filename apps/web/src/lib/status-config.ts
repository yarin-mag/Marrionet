import type { AgentStatus } from "@marionette/shared";

/**
 * Status configuration interface
 */
export interface StatusConfig {
  /** Border color class for card left border */
  border: string;
  /** Badge variant to use */
  badge: "success" | "info" | "warning" | "error" | "default" | "secondary" | "outline";
  /** Background color class for subtle status indication */
  bg: string;
  /** Human-readable label */
  label: string;
}

/**
 * Status color configuration map
 * Maps agent status to visual styling
 * @example
 * const config = STATUS_COLORS[agent.status];
 * <Badge variant={config.badge}>{config.label}</Badge>
 */
export const STATUS_COLORS: Record<AgentStatus, StatusConfig> = {
  working: {
    border: "border-l-[hsl(var(--success))]",
    badge: "success",
    bg: "bg-[hsl(var(--success-light))]/50",
    label: "Working",
  },
  starting: {
    border: "border-l-[hsl(var(--info))]",
    badge: "info",
    bg: "bg-[hsl(var(--info-light))]/50",
    label: "Starting",
  },
  blocked: {
    border: "border-l-[hsl(var(--warning))]",
    badge: "warning",
    bg: "bg-[hsl(var(--warning-light))]/50",
    label: "Blocked",
  },
  error: {
    border: "border-l-[hsl(var(--error))]",
    badge: "error",
    bg: "bg-[hsl(var(--error-light))]/50",
    label: "Error",
  },
  crashed: {
    border: "border-l-[hsl(var(--error))]",
    badge: "error",
    bg: "bg-[hsl(var(--error-light))]/50",
    label: "Crashed",
  },
  idle: {
    border: "border-l-gray-300",
    badge: "default",
    bg: "bg-gray-50 dark:bg-gray-800",
    label: "Idle",
  },
  finished: {
    border: "border-l-gray-300",
    badge: "secondary",
    bg: "bg-gray-50 dark:bg-gray-800",
    label: "Finished",
  },
  disconnected: {
    border: "border-l-gray-300",
    badge: "outline",
    bg: "bg-gray-50 dark:bg-gray-800",
    label: "Disconnected",
  },
  awaiting_input: {
    border: "border-l-amber-400",
    badge: "warning",
    bg: "bg-amber-50 dark:bg-amber-900/20",
    label: "Needs Attention",
  },
  delegating: {
    border: "border-l-blue-400",
    badge: "info",
    bg: "bg-blue-50 dark:bg-blue-900/20",
    label: "Delegating",
  },
} as const;
