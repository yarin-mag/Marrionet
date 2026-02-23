import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300",
        primary:
          "border border-primary/20 bg-primary/10 text-primary dark:border-primary/30 dark:bg-primary/20",
        success:
          "border border-success/20 bg-[hsl(var(--success-light))] text-[hsl(var(--success))] dark:border-success/30 dark:bg-success/20",
        warning:
          "border border-warning/20 bg-[hsl(var(--warning-light))] text-[hsl(var(--warning))] dark:border-warning/30 dark:bg-warning/20",
        error:
          "border border-error/20 bg-[hsl(var(--error-light))] text-[hsl(var(--error))] dark:border-error/30 dark:bg-error/20",
        info:
          "border border-info/20 bg-[hsl(var(--info-light))] text-[hsl(var(--info))] dark:border-info/30 dark:bg-info/20",
        outline: "border border-border text-foreground",
        secondary:
          "border border-gray-200 bg-gray-100 text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200",
        destructive:
          "border border-error/20 bg-[hsl(var(--error-light))] text-[hsl(var(--error))] dark:border-error/30 dark:bg-error/20",
      },
      size: {
        sm: "px-2 py-0.5 text-[10px] leading-tight",
        md: "px-2.5 py-1 text-xs",
        lg: "px-3 py-1.5 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  /** Show animated dot indicator (for live status) */
  showDot?: boolean;
  /** Custom color for the dot indicator */
  dotColor?: string;
}

/**
 * Badge component - Displays status or category labels
 * @example
 * <Badge variant="success" size="sm" showDot>Working</Badge>
 */
function Badge({
  className,
  variant,
  size,
  showDot,
  dotColor,
  children,
  ...props
}: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {showDot && (
        <span
          className={cn(
            "inline-block h-1.5 w-1.5 rounded-full animate-pulse",
            dotColor || "bg-current"
          )}
        />
      )}
      {children}
    </div>
  );
}

export { Badge, badgeVariants };
