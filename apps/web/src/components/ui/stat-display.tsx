import * as React from "react";
import { type LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";

const variantStyles = {
  default: "border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800",
  success:
    "border-success/20 bg-[hsl(var(--success-light))] dark:border-success/30 dark:bg-success/10",
  warning:
    "border-warning/20 bg-[hsl(var(--warning-light))] dark:border-warning/30 dark:bg-warning/10",
  error:
    "border-error/20 bg-[hsl(var(--error-light))] dark:border-error/30 dark:bg-error/10",
  info: "border-info/20 bg-[hsl(var(--info-light))] dark:border-info/30 dark:bg-info/10",
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
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
