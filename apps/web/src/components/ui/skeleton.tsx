import * as React from "react";
import { cn } from "../../lib/utils";

/**
 * Skeleton component - Loading placeholder with shimmer animation
 * @example
 * <Skeleton className="h-12 w-12 rounded-lg" />
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-md",
        "bg-[length:200%_100%] animate-[shimmer_1.6s_infinite_linear]",
        "bg-gradient-to-r from-muted via-muted-foreground/10 to-muted",
        className
      )}
      {...props}
    />
  );
}

/**
 * AgentCardSkeleton - Loading placeholder for AgentCard
 */
function AgentCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-6 min-w-[300px]">
      <div className="flex items-start gap-3 mb-4">
        <Skeleton className="h-12 w-12 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
      <Skeleton className="h-20 rounded-lg mb-4" />
      <div className="grid grid-cols-3 gap-3">
        <Skeleton className="h-16 rounded-lg" />
        <Skeleton className="h-16 rounded-lg" />
        <Skeleton className="h-16 rounded-lg" />
      </div>
    </div>
  );
}

export { Skeleton, AgentCardSkeleton };
