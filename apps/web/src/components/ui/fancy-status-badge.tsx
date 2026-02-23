import * as React from "react";
import { cn } from "../../lib/utils";
import { getFancyStatusConfig } from "../../lib/fancy-status-config";
import type { AgentStatus } from "@marionette/shared";
import { Activity, AlertCircle, CheckCircle, Clock, XCircle } from "lucide-react";

export interface FancyStatusBadgeProps {
  status: AgentStatus | string;
  size?: "sm" | "md" | "lg";
  animated?: boolean;
  showIcon?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: "text-xs px-2 py-1",
  md: "text-sm px-3 py-1.5",
  lg: "text-base px-4 py-2",
};

const iconSizes = {
  sm: "h-3 w-3",
  md: "h-4 w-4",
  lg: "h-5 w-5",
};

const statusIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  working: Activity,
  blocked: AlertCircle,
  error: XCircle,
  crashed: XCircle,
  idle: Clock,
  starting: Activity,
  finished: CheckCircle,
  disconnected: XCircle,
};

const statusLabels: Record<string, string> = {
  working: "Working",
  blocked: "Blocked",
  error: "Error",
  crashed: "Crashed",
  idle: "Idle",
  starting: "Starting",
  finished: "Finished",
  disconnected: "Disconnected",
};

export function FancyStatusBadge({
  status,
  size = "md",
  animated = true,
  showIcon = true,
  className,
}: FancyStatusBadgeProps) {
  const config = getFancyStatusConfig(status);
  const Icon = statusIcons[status] || Activity;
  const label = statusLabels[status] || status;

  const shouldAnimate = animated && (status === "working" || status === "starting");

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium",
        "bg-gradient-to-r",
        config.gradient,
        "text-white",
        sizeClasses[size],
        shouldAnimate && "animate-pulse",
        config.glow,
        "transition-all duration-300",
        "hover:scale-105",
        className
      )}
    >
      {showIcon && (
        <Icon
          className={cn(
            iconSizes[size],
            shouldAnimate && "animate-spin"
          )}
        />
      )}
      <span>{label}</span>
    </div>
  );
}
