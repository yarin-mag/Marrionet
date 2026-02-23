import type { AgentStatus } from "@marionette/shared";

export interface FancyStatusConfig {
  gradient: string;
  glow: string;
  bgClass: string;
  iconColor: string;
}

export const fancyStatusConfig: Record<AgentStatus | string, FancyStatusConfig> = {
  working: {
    gradient: "from-emerald-400 to-teal-500",
    glow: "shadow-[0_0_20px_rgba(16,185,129,0.4)]",
    bgClass: "bg-gradient-to-br from-emerald-500/10 to-teal-500/10",
    iconColor: "text-emerald-400",
  },
  blocked: {
    gradient: "from-amber-400 to-orange-500",
    glow: "shadow-[0_0_20px_rgba(245,158,11,0.4)]",
    bgClass: "bg-gradient-to-br from-amber-500/10 to-orange-500/10",
    iconColor: "text-amber-400",
  },
  error: {
    gradient: "from-rose-400 to-red-500",
    glow: "shadow-[0_0_20px_rgba(239,68,68,0.4)]",
    bgClass: "bg-gradient-to-br from-rose-500/10 to-red-500/10",
    iconColor: "text-rose-400",
  },
  crashed: {
    gradient: "from-rose-400 to-red-500",
    glow: "shadow-[0_0_20px_rgba(239,68,68,0.4)]",
    bgClass: "bg-gradient-to-br from-rose-500/10 to-red-500/10",
    iconColor: "text-rose-400",
  },
  idle: {
    gradient: "from-gray-400 to-gray-500",
    glow: "",
    bgClass: "bg-gray-500/5",
    iconColor: "text-gray-400",
  },
  starting: {
    gradient: "from-cyan-400 to-blue-500",
    glow: "shadow-[0_0_20px_rgba(59,130,246,0.4)]",
    bgClass: "bg-gradient-to-br from-cyan-500/10 to-blue-500/10",
    iconColor: "text-cyan-400",
  },
  finished: {
    gradient: "from-gray-400 to-gray-500",
    glow: "",
    bgClass: "bg-gray-500/5",
    iconColor: "text-gray-400",
  },
  disconnected: {
    gradient: "from-gray-400 to-gray-500",
    glow: "",
    bgClass: "bg-gray-500/5",
    iconColor: "text-gray-400",
  },
};

export function getFancyStatusConfig(status: AgentStatus | string): FancyStatusConfig {
  return fancyStatusConfig[status] || fancyStatusConfig.idle;
}
