import * as React from "react";
import { cn } from "../../lib/utils";
import { getFancyStatusConfig } from "../../lib/fancy-status-config";
import { FancyStatusBadge } from "./fancy-status-badge";
import type { AgentStatus } from "@marionette/shared";
import type { LucideIcon } from "lucide-react";

export interface FancyHeroSectionProps {
  title: string;
  status: AgentStatus | string;
  duration?: string;
  stats: Array<{
    icon: LucideIcon;
    label: string;
    value: string | number;
    color?: string;
  }>;
  className?: string;
}

export function FancyHeroSection({
  title,
  status,
  duration,
  stats,
  className,
}: FancyHeroSectionProps) {
  const config = getFancyStatusConfig(status);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border p-8",
        // LIGHT MODE: Gradient from card color
        "bg-gradient-to-br from-card via-card to-card/50",
        // DARK MODE: Dark gradient
        "dark:from-slate-900 dark:via-slate-900 dark:to-slate-800/50 dark:border-slate-700/50",
        config.bgClass,
        "animate-[fadeIn_0.5s_ease-out]",
        className
      )}
    >
      {/* Floating shapes background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className={cn(
          "absolute -top-10 -right-10 h-40 w-40 rounded-full opacity-10",
          "bg-gradient-to-br",
          config.gradient
        )} />
        <div className={cn(
          "absolute -bottom-10 -left-10 h-40 w-40 rounded-full opacity-5",
          "bg-gradient-to-tr",
          config.gradient
        )} />
      </div>

      {/* Content */}
      <div className="relative z-10 space-y-6">
        {/* Title and Status */}
        <div className="space-y-3">
          <h2 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
            {title}
          </h2>
          <div className="flex items-center gap-3 flex-wrap">
            <FancyStatusBadge status={status} size="md" />
            {duration && (
              <span className="text-sm text-muted-foreground px-3 py-1 rounded-full bg-muted/50">
                {duration}
              </span>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
          {stats.map((stat, index) => (
            <div
              key={index}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg",
                // LIGHT MODE: Semi-transparent card
                "bg-card/50 border border-border/50",
                // DARK MODE: Dark background
                "dark:bg-slate-800/70 dark:border-slate-700/50",
                // Hover states
                "transition-[background-color] duration-150 hover:bg-card/80 dark:hover:bg-slate-800/90",
                "animate-[slideInRight_0.3s_ease-out]"
              )}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div
                className={cn(
                  "p-2 rounded-lg",
                  stat.color || "bg-primary/10"
                )}
              >
                <stat.icon className={cn("h-5 w-5", config.iconColor)} />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold truncate">{stat.value}</p>
                <p className="text-xs text-muted-foreground truncate">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
