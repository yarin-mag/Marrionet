import * as React from "react";
import { cn } from "../../lib/utils";
import type { LucideIcon } from "lucide-react";

export interface FancyMetricGridProps {
  metrics: Array<{
    icon: LucideIcon;
    label: string;
    value: string | number;
    gradient: string;
  }>;
  columns?: 2 | 3 | 4;
  className?: string;
}

export function FancyMetricGrid({
  metrics,
  columns = 4,
  className,
}: FancyMetricGridProps) {
  const gridCols = {
    2: "grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 md:grid-cols-3",
    4: "grid-cols-2 md:grid-cols-4",
  };

  return (
    <div className={cn("grid gap-4", gridCols[columns], className)}>
      {metrics.map((metric, index) => (
        <div
          key={index}
          className={cn(
            "group relative overflow-hidden rounded-xl border p-4",
            // LIGHT MODE: Card background
            "bg-card",
            // DARK MODE: Dark background
            "dark:bg-slate-900 dark:border-slate-700/50",
            "transition-all duration-300",
            "hover:shadow-lg hover:scale-105 hover:z-10",
            "animate-[fadeIn_0.5s_ease-out]"
          )}
          style={{ animationDelay: `${index * 50}ms` }}
        >
          {/* Gradient overlay on hover */}
          <div
            className={cn(
              "absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-300",
              "bg-gradient-to-br",
              metric.gradient
            )}
          />

          {/* Content */}
          <div className="relative flex items-center gap-3">
            {/* Icon */}
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                "bg-gradient-to-br",
                metric.gradient,
                "text-white shadow-md",
                "group-hover:scale-110 transition-transform duration-300"
              )}
            >
              <metric.icon className="h-5 w-5" />
            </div>

            {/* Value and Label */}
            <div className="flex-1 min-w-0">
              <p className="text-2xl font-bold tracking-tight truncate">{metric.value}</p>
              <p className="text-xs text-muted-foreground truncate">{metric.label}</p>
            </div>
          </div>

          {/* Glow effect */}
          <div
            className={cn(
              "absolute -right-2 -bottom-2 h-20 w-20 rounded-full blur-2xl",
              "opacity-0 group-hover:opacity-30 transition-opacity duration-500",
              "bg-gradient-to-br",
              metric.gradient
            )}
          />
        </div>
      ))}
    </div>
  );
}
