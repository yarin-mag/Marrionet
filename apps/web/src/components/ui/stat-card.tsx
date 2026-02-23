import * as React from "react";
import { type LucideIcon } from "lucide-react";
import { Card } from "./card";
import { cn } from "../../lib/utils";

const variantStyles = {
  default: {
    icon: "text-primary bg-primary/10 border-primary/20",
    value: "text-foreground",
  },
  success: {
    icon: "text-[hsl(var(--success))] bg-[hsl(var(--success-light))] border-success/20",
    value: "text-[hsl(var(--success))]",
  },
  warning: {
    icon: "text-[hsl(var(--warning))] bg-[hsl(var(--warning-light))] border-warning/20",
    value: "text-[hsl(var(--warning))]",
  },
  error: {
    icon: "text-[hsl(var(--error))] bg-[hsl(var(--error-light))] border-error/20",
    value: "text-[hsl(var(--error))]",
  },
  info: {
    icon: "text-[hsl(var(--info))] bg-[hsl(var(--info-light))] border-info/20",
    value: "text-[hsl(var(--info))]",
  },
};

export interface StatCardProps {
  /** Label for the stat */
  label: string;
  /** Value to display */
  value: string | number;
  /** Optional icon (Lucide icon component) */
  icon?: LucideIcon;
  /** Color variant */
  variant?: "default" | "success" | "warning" | "error" | "info";
  /** Optional click handler */
  onClick?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * StatCard component - Card displaying a statistic with icon
 * Used in dashboard for aggregate stats
 * @example
 * <StatCard label="Active Agents" value={12} icon={Activity} variant="success" />
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  variant = "default",
  onClick,
  className,
}: StatCardProps) {
  const styles = variantStyles[variant];

  return (
    <Card
      elevation="low"
      interactive={!!onClick}
      onClick={onClick}
      className={cn("p-6", className)}
    >
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <p className="text-label text-muted-foreground">{label}</p>
          <p className={cn("text-display-md font-bold", styles.value)}>{value}</p>
        </div>
        {Icon && (
          <div
            className={cn(
              "p-3 rounded-lg border",
              styles.icon
            )}
          >
            <Icon className="h-6 w-6" />
          </div>
        )}
      </div>
    </Card>
  );
}
