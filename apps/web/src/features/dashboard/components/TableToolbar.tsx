import React from "react";
import { Search, X, Minus, Tag, MapPin, ArrowUpDown } from "lucide-react";
import type { GroupBy, SortDir, SortKey } from "../hooks/useTableState";
import { cn } from "../../../lib/utils";

interface TableToolbarProps {
  search: string;
  onSearchChange: (v: string) => void;
  groupBy: GroupBy;
  onGroupByChange: (v: GroupBy) => void;
  sortKey: SortKey;
  sortDir: SortDir;
  totalVisible: number;
  totalAll: number;
}

const GROUP_OPTIONS: { value: GroupBy; label: string; icon: React.ElementType }[] = [
  { value: "none",     label: "None",     icon: Minus   },
  { value: "status",   label: "Status",   icon: Tag     },
  { value: "location", label: "Location", icon: MapPin  },
];

export function TableToolbar({
  search,
  onSearchChange,
  groupBy,
  onGroupByChange,
  sortKey,
  sortDir,
  totalVisible,
  totalAll,
}: TableToolbarProps) {
  const isFiltered = search.trim().length > 0;

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card flex-wrap">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by name, location, or ID…"
          className={cn(
            "h-9 w-full rounded-lg border border-border bg-background pl-9 pr-8 text-sm",
            "placeholder:text-muted-foreground",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
            "transition-colors"
          )}
        />
        {isFiltered && (
          <button
            onClick={() => onSearchChange("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Group by — segmented pill */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground select-none">Group</span>
        <div className="flex items-center gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5">
          {GROUP_OPTIONS.map(({ value, label, icon: Icon }) => {
            const active = groupBy === value;
            return (
              <button
                key={value}
                onClick={() => onGroupByChange(value)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium",
                  "transition-all duration-150 cursor-pointer",
                  active
                    ? "bg-primary/15 text-primary font-semibold border border-primary/30 dark:bg-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/60"
                )}
              >
                <Icon className="h-3 w-3 shrink-0" />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sort indicator + result count pushed right */}
      <div className="ml-auto flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ArrowUpDown className="h-3.5 w-3.5" />
          <span className="capitalize">{sortKey.replace("_", " ")}</span>
          <span className="text-muted-foreground/50">{sortDir === "asc" ? "↑" : "↓"}</span>
        </div>
        {isFiltered && (
          <span className="text-xs text-muted-foreground border-l border-border pl-3">
            {totalVisible} / {totalAll}
          </span>
        )}
      </div>
    </div>
  );
}
