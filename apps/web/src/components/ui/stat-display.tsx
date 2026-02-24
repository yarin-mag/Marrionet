import * as React from "react";
import { type LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";

const variantStyles = {
  default: "border-border bg-muted/40",
  success: "border-[hsl(var(--success)/0.2)] bg-[hsl(var(--success-light))]",
  warning: "border-[hsl(var(--warning)/0.2)] bg-[hsl(var(--warning-light))]",
  error: "border-[hsl(var(--error)/0.2)] bg-[hsl(var(--error-light))]",
  info: "border-[hsl(var(--info)/0.2)] bg-[hsl(var(--info-light))]",
};

export interface StatDisplayProps {
  /** Label for the stat */
  label: string;
  /** Value to display */
  value: string | number;
  /** Optional icon (Lucide icon component) */
  icon?: LucideIcon;
  /** Color variant */
  variant?: "default" | "success" | "warning" | "error" | "info";
  /** Custom icon color */
  iconColor?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * StatDisplay component - Displays a single statistic with label and optional icon
 * @example
 * <StatDisplay label="Total" value={42} icon={Activity} variant="success" />
 */
export function StatDisplay({
  label,
  value,
  icon: Icon,
  variant = "default",
  iconColor,
  className,
}: StatDisplayProps) {
  return (
    <div
      className={cn(
        "p-3 rounded-lg border transition-colors",
        variantStyles[variant],
        className
      )}
    >
      {Icon && (
        <div className="flex items-center gap-1 mb-1">
          <Icon className={cn("h-3 w-3", iconColor || "text-muted-foreground")} />
          <div className="text-xs font-medium text-muted-foreground">{label}</div>
        </div>
      )}
      {!Icon && (
        <div className="text-xs font-medium text-muted-foreground mb-1">{label}</div>
      )}
      <div className="text-lg font-semibold text-foreground">{value}</div>
    </div>
  );
}
