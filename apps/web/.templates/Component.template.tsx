import * as React from "react";
import { cn } from "@/lib/utils";

export interface ComponentNameProps {
  /** Description of prop */
  prop: string;
  /** Optional prop */
  optionalProp?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * ComponentName - Brief description of what this component does
 *
 * @example
 * ```tsx
 * <ComponentName prop="value" />
 * ```
 */
export function ComponentName({
  prop,
  optionalProp = false,
  className,
}: ComponentNameProps) {
  return (
    <div className={cn("base-styles", className)}>
      {/* Component content */}
      {prop}
    </div>
  );
}
