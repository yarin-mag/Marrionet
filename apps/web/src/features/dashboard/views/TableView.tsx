import * as React from "react";
import { useState, useEffect } from "react";
import type { AgentSnapshot, AgentStatus } from "@marionette/shared";
import { Badge } from "../../../components/ui/badge";
import { EmptyState } from "../../../components/ui/empty-state";
import { formatTime, formatTokens, extractFolder, estimateSessionCost, cn } from "../../../lib/utils";
import { STATUS_COLORS } from "../../../lib/status-config";
import {
  FolderOpen, Inbox, ArrowUp, ArrowDown, ChevronsUpDown,
  Zap, PlayCircle, AlertTriangle, ChevronDown, Check, DollarSign,
} from "lucide-react";
import { useTableState, type SortKey } from "../hooks/useTableState";
import { TableToolbar } from "../components/TableToolbar";
import { useAgentsStore } from "../../agents/stores/agents.store";

interface TableViewProps {
  agents: AgentSnapshot[];
  onAgentClick: (agent: AgentSnapshot) => void;
}

/** Clickable sortable column header */
function SortTh({
  label, sortKey, activeSortKey, sortDir, onSort, className,
}: {
  label: string;
  sortKey: SortKey;
  activeSortKey: SortKey;
  sortDir: "asc" | "desc";
  onSort: (k: SortKey) => void;
  className?: string;
}) {
  const active = activeSortKey === sortKey;
  const Icon = active ? (sortDir === "asc" ? ArrowUp : ArrowDown) : ChevronsUpDown;
  return (
    <th
      onClick={() => onSort(sortKey)}
      className={cn(
        "px-4 py-3.5 text-label text-muted-foreground cursor-pointer select-none",
        "hover:text-foreground hover:bg-accent/40 transition-colors",
        active && "text-primary",
        className
      )}
    >
      <span className="flex items-center gap-1.5">
        {label}
        <Icon className={cn("h-3.5 w-3.5 shrink-0", active ? "text-primary" : "text-muted-foreground/40")} />
      </span>
    </th>
  );
}

/** Separator row between groups */
function GroupHeaderRow({ label, count, status, isCollapsed, onToggle }: {
  label: string;
  count: number;
  status?: AgentStatus;
  isCollapsed: boolean;
  onToggle: () => void;
}) {
  const variant = (status ? STATUS_COLORS[status] ?? STATUS_COLORS.disconnected : STATUS_COLORS.disconnected).badge;
  return (
    <tr onClick={onToggle} className="cursor-pointer select-none hover:bg-muted/60 transition-colors">
      <td colSpan={10} className="px-6 py-2 bg-muted/40 border-y border-border/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {label}
            </span>
            <Badge variant={variant} size="sm">{count}</Badge>
          </div>
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 text-muted-foreground transition-transform duration-200",
              !isCollapsed && "rotate-180"
            )}
          />
        </div>
      </td>
    </tr>
  );
}

export function TableView({ agents, onAgentClick }: TableViewProps) {
  const {
    search, setSearch,
    sortKey, sortDir, toggleSort,
    groupBy, setGroupBy,
    groups, totalVisible,
  } = useTableState(agents);

  const { compareSet, toggleCompare } = useAgentsStore();
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (label: string) =>
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });

  useEffect(() => {
    setCollapsedGroups(new Set());
  }, [groupBy]);

  if (agents.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="No agents found"
        description="Start monitoring agents to see them appear here"
      />
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <TableToolbar
        search={search}
        onSearchChange={setSearch}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
        sortKey={sortKey}
        sortDir={sortDir}
        totalVisible={totalVisible}
        totalAll={agents.length}
      />

      {totalVisible === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground">
          No agents match <span className="font-medium text-foreground">"{search}"</span>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/30 border-b border-border sticky top-0 z-10">
              <tr>
                <th className="pl-4 py-3.5 w-8" />
                <SortTh label="Agent" sortKey="name" activeSortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="pl-3 text-left" />
                <SortTh label="Status" sortKey="status" activeSortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-left" />
                <th className="px-4 py-3.5 text-left text-label text-muted-foreground">Task</th>
                <th className="px-4 py-3.5 text-left text-label text-muted-foreground">Location</th>
                <SortTh label="Runs" sortKey="runs" activeSortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-right" />
                <SortTh label="Tokens" sortKey="tokens" activeSortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-right" />
                <SortTh label="Cost" sortKey="cost" activeSortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-right" />
                <SortTh label="Errors" sortKey="errors" activeSortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="text-right" />
                <SortTh label="Last Active" sortKey="last_activity" activeSortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="pr-6 text-right" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {groups.map((group) => (
                <React.Fragment key={group.label || "__ungrouped__"}>
                  {group.label && (
                    <GroupHeaderRow
                      label={group.label}
                      count={group.agents.length}
                      status={group.status}
                      isCollapsed={collapsedGroups.has(group.label)}
                      onToggle={() => toggleGroup(group.label)}
                    />
                  )}
                  {!collapsedGroups.has(group.label) && group.agents.map((agent, idx) => {
                    const statusConfig = STATUS_COLORS[agent.status] ?? STATUS_COLORS.disconnected;
                    const customName = agent.metadata?.custom_name as string | undefined;
                    const displayName = customName || agent.agent_name || extractFolder(agent.cwd);
                    const isCompared = compareSet.includes(agent.agent_id);
                    const estCost = estimateSessionCost(agent.session_tokens);

                    return (
                      <tr
                        key={agent.agent_id}
                        onClick={() => onAgentClick(agent)}
                        className={cn(
                          "group cursor-pointer transition-colors",
                          "hover:bg-primary/5 dark:hover:bg-primary/10",
                          idx % 2 === 0 ? "bg-background" : "bg-muted/20"
                        )}
                      >
                        {/* Compare checkbox */}
                        <td
                          className="pl-4 py-3.5 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleCompare(agent.agent_id);
                          }}
                        >
                          <div
                            className={cn(
                              "h-4 w-4 rounded border flex items-center justify-center cursor-pointer",
                              isCompared
                                ? "bg-primary border-primary"
                                : "bg-background border-border hover:border-primary"
                            )}
                          >
                            {isCompared && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                          </div>
                        </td>

                        {/* Agent name */}
                        <td className="pl-3 pr-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="shrink-0 p-1.5 rounded-lg bg-primary/10 border border-primary/20">
                              <FolderOpen className="h-3.5 w-3.5 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                                {displayName}
                              </div>
                              {customName && agent.agent_name && (
                                <div className="text-xs text-muted-foreground truncate">{agent.agent_name}</div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3.5">
                          <Badge variant={statusConfig.badge} size="sm" showDot={agent.status === "working"}>
                            {statusConfig.label}
                          </Badge>
                        </td>

                        {/* Task */}
                        <td className="px-4 py-3.5 max-w-[260px]">
                          {agent.current_task ? (
                            <span className="text-sm truncate block">{agent.current_task}</span>
                          ) : (
                            <span className="text-xs italic text-muted-foreground/50">No active task</span>
                          )}
                        </td>

                        {/* Location */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5 text-sm text-foreground/80">
                            <FolderOpen className="h-3 w-3 text-muted-foreground shrink-0" />
                            <span className="truncate max-w-[140px]">
                              {extractFolder(agent.cwd || "") || "—"}
                            </span>
                          </div>
                          {agent.terminal && (
                            <div className="text-xs text-muted-foreground mt-0.5 pl-[18px]">{agent.terminal}</div>
                          )}
                        </td>

                        {/* Runs */}
                        <td className="px-4 py-3.5 text-right">
                          <span className="flex items-center justify-end gap-1 text-sm font-medium">
                            <PlayCircle className="h-3.5 w-3.5 text-muted-foreground" />
                            {agent.session_runs}
                          </span>
                        </td>

                        {/* Tokens */}
                        <td className="px-4 py-3.5 text-right">
                          <span className="flex items-center justify-end gap-1 text-sm font-medium">
                            <Zap className="h-3.5 w-3.5 text-amber-400" />
                            {formatTokens(agent.session_tokens)}
                          </span>
                        </td>

                        {/* Cost */}
                        <td
                          className="px-4 py-3.5 text-right"
                          title="Estimated using Sonnet 4 pricing. See agent details for exact cost."
                        >
                          {agent.session_tokens > 0 ? (
                            <span className="flex items-center justify-end gap-1 text-sm text-muted-foreground tabular-nums">
                              <DollarSign className="h-3 w-3 text-muted-foreground/50" />
                              ~{estCost.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground/40">—</span>
                          )}
                        </td>

                        {/* Errors */}
                        <td className="px-4 py-3.5 text-right">
                          {agent.session_errors > 0 ? (
                            <span className="flex items-center justify-end gap-1 text-sm font-semibold text-destructive">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              {agent.session_errors}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground/40">—</span>
                          )}
                        </td>

                        {/* Last Active */}
                        <td className="pl-4 pr-6 py-3.5 text-right text-sm text-muted-foreground whitespace-nowrap">
                          {formatTime(agent.last_activity)}
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
