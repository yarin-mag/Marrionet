import type { AgentSnapshot, AgentStatus } from "@marionette/shared";
import { Badge } from "../../../components/ui/badge";
import { formatTokens, extractFolder, cn } from "../../../lib/utils";
import {
  Activity,
  Moon,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  PauseCircle,
  FolderOpen,
  Zap,
  PlayCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { BadgeProps } from "../../../components/ui/badge";

interface KanbanViewProps {
  agents: AgentSnapshot[];
  onAgentClick: (agent: AgentSnapshot) => void;
}

interface ColumnConfig {
  status: AgentStatus[];
  title: string;
  icon: LucideIcon;
  dotColor: string;
  borderColor: string;
  headerBg: string;
  headerText: string;
  headerBorder: string;
  laneBg: string;
  badgeVariant: BadgeProps["variant"];
  pulse?: boolean;
}

const statusColumns: ColumnConfig[] = [
  {
    status: ["starting"],
    title: "Starting",
    icon: Loader2,
    dotColor: "bg-blue-400",
    borderColor: "border-l-blue-400",
    headerBg: "bg-blue-50 dark:bg-blue-950/40",
    headerText: "text-blue-700 dark:text-blue-300",
    headerBorder: "border-blue-200 dark:border-blue-800/50",
    laneBg: "bg-blue-50/40 dark:bg-blue-950/10 border-blue-100 dark:border-blue-900/30",
    badgeVariant: "info",
  },
  {
    status: ["working"],
    title: "Working",
    icon: Activity,
    dotColor: "bg-green-500",
    borderColor: "border-l-green-500",
    headerBg: "bg-green-50 dark:bg-green-950/40",
    headerText: "text-green-700 dark:text-green-300",
    headerBorder: "border-green-200 dark:border-green-800/50",
    laneBg: "bg-green-50/40 dark:bg-green-950/10 border-green-100 dark:border-green-900/30",
    badgeVariant: "success",
    pulse: true,
  },
  {
    status: ["blocked"],
    title: "Blocked",
    icon: PauseCircle,
    dotColor: "bg-yellow-500",
    borderColor: "border-l-yellow-500",
    headerBg: "bg-yellow-50 dark:bg-yellow-950/40",
    headerText: "text-yellow-700 dark:text-yellow-300",
    headerBorder: "border-yellow-200 dark:border-yellow-800/50",
    laneBg: "bg-yellow-50/40 dark:bg-yellow-950/10 border-yellow-100 dark:border-yellow-900/30",
    badgeVariant: "warning",
  },
  {
    status: ["idle"],
    title: "Idle",
    icon: Moon,
    dotColor: "bg-slate-400",
    borderColor: "border-l-slate-400",
    headerBg: "bg-slate-100 dark:bg-slate-800/40",
    headerText: "text-slate-600 dark:text-slate-300",
    headerBorder: "border-slate-200 dark:border-slate-700/50",
    laneBg: "bg-slate-50/60 dark:bg-slate-800/10 border-slate-200 dark:border-slate-700/30",
    badgeVariant: "secondary",
  },
  {
    status: ["error", "crashed"],
    title: "Needs Attention",
    icon: AlertTriangle,
    dotColor: "bg-red-500",
    borderColor: "border-l-red-500",
    headerBg: "bg-red-50 dark:bg-red-950/40",
    headerText: "text-red-700 dark:text-red-300",
    headerBorder: "border-red-200 dark:border-red-800/50",
    laneBg: "bg-red-50/40 dark:bg-red-950/10 border-red-100 dark:border-red-900/30",
    badgeVariant: "error",
  },
  {
    status: ["finished", "disconnected"],
    title: "Finished",
    icon: CheckCircle2,
    dotColor: "bg-slate-300",
    borderColor: "border-l-slate-300",
    headerBg: "bg-slate-50 dark:bg-slate-800/20",
    headerText: "text-slate-500 dark:text-slate-400",
    headerBorder: "border-slate-200 dark:border-slate-700/40",
    laneBg: "bg-slate-50/30 dark:bg-slate-800/5 border-slate-200 dark:border-slate-700/20",
    badgeVariant: "secondary",
  },
];

export function KanbanView({ agents, onAgentClick }: KanbanViewProps) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-3">
      {statusColumns.map((column) => {
        const columnAgents = agents.filter((a) =>
          column.status.includes(a.status)
        );
        const Icon = column.icon;

        return (
          <div key={column.title} className="flex w-[220px] flex-shrink-0 flex-col gap-2">
            {/* Column header */}
            <div
              className={cn(
                "flex items-center justify-between rounded-xl border px-3 py-2.5",
                column.headerBg,
                column.headerBorder
              )}
            >
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "h-2 w-2 rounded-full",
                    column.dotColor,
                    column.pulse && "animate-pulse"
                  )}
                />
                <span className={cn("text-sm font-semibold", column.headerText)}>
                  {column.title}
                </span>
              </div>
              <Badge variant={column.badgeVariant} size="sm">
                {columnAgents.length}
              </Badge>
            </div>

            {/* Lane */}
            <div
              className={cn(
                "flex-1 rounded-xl border p-2 space-y-2",
                "min-h-[420px]",
                column.laneBg
              )}
            >
              {columnAgents.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-10 opacity-30">
                  <Icon className="h-6 w-6" />
                  <span className="text-xs font-medium">Empty</span>
                </div>
              ) : (
                columnAgents.map((agent) => (
                  <div
                    key={agent.agent_id}
                    className={cn(
                      "cursor-pointer rounded-lg border border-border bg-card p-3 space-y-2.5",
                      "border-l-[3px]", column.borderColor,
                      "hover:shadow-md hover:-translate-y-0.5 active:translate-y-0",
                      "transition-all duration-150"
                    )}
                    onClick={() => onAgentClick(agent)}
                  >
                    {/* Agent name */}
                    <p className="text-sm font-semibold leading-tight truncate">
                      {agent.agent_name || "Unnamed Agent"}
                    </p>

                    {/* Current task */}
                    {agent.current_task && (
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-snug">
                        {agent.current_task}
                      </p>
                    )}

                    {/* Folder */}
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <FolderOpen className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{extractFolder(agent.cwd || "") || "unknown"}</span>
                    </div>

                    {/* Stats row */}
                    <div className="flex items-center justify-between border-t border-border/50 pt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <PlayCircle className="h-3 w-3" />
                        {agent.session_runs}
                      </span>
                      <span className="flex items-center gap-1">
                        <Zap className="h-3 w-3 text-amber-400" />
                        {formatTokens(agent.session_tokens)}
                      </span>
                    </div>

                    {/* Errors */}
                    {agent.session_errors > 0 && (
                      <div className="flex items-center gap-1 text-xs font-medium text-destructive">
                        <AlertTriangle className="h-3 w-3" />
                        {agent.session_errors} error{agent.session_errors !== 1 ? "s" : ""}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
