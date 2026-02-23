import * as React from "react";
import { cn } from "../../lib/utils";

export interface GradientBorderProps extends React.HTMLAttributes<HTMLDivElement> {
  gradient: string;
  rounded?: "sm" | "md" | "lg" | "xl";
  glow?: boolean;
  children: React.ReactNode;
}

const roundedClasses = {
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
};

const GradientBorder = React.forwardRef<HTMLDivElement, GradientBorderProps>(
  ({ className, gradient, rounded = "xl", glow = false, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "relative p-[2px]",
          "bg-gradient-to-r",
          gradient,
          roundedClasses[rounded],
          glow && "transition-all duration-300 hover:shadow-lg hover:shadow-primary/20",
          className
        )}
        {...props}
      >
        {/* Inner content with card background */}
        <div className={cn(
          "bg-card dark:bg-slate-900",
          roundedClasses[rounded],
          "relative overflow-hidden"
        )}>
          {children}
        </div>
      </div>
    );
  }
);

GradientBorder.displayName = "GradientBorder";

export { GradientBorder };
