import * as React from "react";
import { type LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";

export interface EmptyStateProps {
  /** Icon to display (Lucide icon component) */
  icon: LucideIcon;
  /** Title text */
  title: string;
  /** Optional description text */
  description?: string;
  /** Optional action button or element */
  action?: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
}

/**
 * EmptyState component - Displays when no data is available
 * @example
 * <EmptyState
 *   icon={Inbox}
 *   title="No agents found"
 *   description="Start monitoring agents to see them here"
 *   action={<Button>Add Agent</Button>}
 * />
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 px-4 text-center",
        className
      )}
    >
      <div className="p-4 rounded-full bg-muted mb-4">
        <Icon className="h-10 w-10 text-muted-foreground" />
      </div>
      <h3 className="text-heading-md mb-2">{title}</h3>
      {description && (
        <p className="text-body-md text-muted-foreground max-w-md mb-6">
          {description}
        </p>
      )}
      {action}
    </div>
  );
}
