import * as React from "react";
import { cn } from "../../lib/utils";

export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "bordered" | "gradient";
  glowColor?: string;
  interactive?: boolean;
  children: React.ReactNode;
}

const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, variant = "default", glowColor, interactive, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          // Base glass effect
          "relative rounded-xl border",
          // LIGHT MODE: Semi-transparent card background
          "bg-card/50",
          // DARK MODE: Dark background that actually works
          "dark:bg-slate-900/90 dark:border-slate-700/50",
          // Variants
          variant === "bordered" && "border-2",
          variant === "gradient" && "border-transparent",
          // Hover effects
          "transition-shadow duration-200 hover:shadow-lg",
          // Interactive cursor
          interactive && "cursor-pointer",
          // Glow effect
          glowColor && `hover:shadow-[0_0_20px_${glowColor}]`,
          className
        )}
        style={
          variant === "gradient"
            ? {
                background: "linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--card))/80 100%)",
                borderImage: "linear-gradient(135deg, hsl(var(--primary))/50, hsl(var(--accent))/50) 1",
              }
            : undefined
        }
        {...props}
      >
        {/* Inner shadow for depth - Light mode uses white, dark mode uses dark gray */}
        <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/5 to-transparent dark:from-slate-800/20 dark:to-transparent pointer-events-none" />

        {/* Content */}
        <div className="relative">{children}</div>
      </div>
    );
  }
);

GlassCard.displayName = "GlassCard";

export { GlassCard };
