import { cn } from "../../lib/utils";
import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export interface FancyStatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  gradient: string;
  trend?: "up" | "down" | "neutral";
  animated?: boolean;
  onClick?: () => void;
  className?: string;
}

const trendIcons = {
  up: TrendingUp,
  down: TrendingDown,
  neutral: Minus,
};

const trendColors = {
  up: "text-emerald-500",
  down: "text-rose-500",
  neutral: "text-gray-500",
};

export function FancyStatCard({
  icon: Icon,
  label,
  value,
  gradient,
  trend,
  animated = true,
  onClick,
  className,
}: FancyStatCardProps) {
  const TrendIcon = trend ? trendIcons[trend] : null;

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border p-6",
        // LIGHT MODE: Card background
        "bg-card",
        // DARK MODE: Explicit dark background
        "dark:bg-slate-900 dark:border-slate-700/50",
        "transition-shadow duration-200",
        "hover:shadow-lg",
        onClick && "cursor-pointer",
        animated && "animate-[fadeIn_0.5s_ease-out]",
        className
      )}
      onClick={onClick}
    >
      {/* Gradient background on hover */}
      <div
        className={cn(
          "absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-300",
          "bg-gradient-to-br",
          gradient
        )}
      />

      {/* Content */}
      <div className="relative space-y-3">
        {/* Icon with gradient background */}
        <div className="flex items-center justify-between">
          <div
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-full",
              "bg-gradient-to-br",
              gradient,
              "text-white shadow-lg"
            )}
          >
            <Icon className="h-6 w-6" />
          </div>

          {/* Trend indicator */}
          {TrendIcon && (
            <TrendIcon className={cn("h-5 w-5", trendColors[trend!])} />
          )}
        </div>

        {/* Value */}
        <div>
          <p className="text-3xl font-bold tracking-tight">{value}</p>
          <p className="text-sm text-muted-foreground mt-1">{label}</p>
        </div>
      </div>

    </div>
  );
}
