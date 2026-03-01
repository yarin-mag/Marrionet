import type { AgentSnapshot } from "@marionette/shared";
import { X, Zap, PlayCircle, XCircle, Activity, FolderOpen, Terminal } from "lucide-react";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { EmptyState } from "../../../components/ui/empty-state";
import { cn, formatTokens, formatDuration } from "../../../lib/utils";
import { useAgentsStore } from "../../agents/stores/agents.store";
import { useAgentLlmCalls } from "../../agents/hooks/useAgentLlmCalls";
import { useAgentDisplay } from "../../agents/hooks/useAgentDisplay";

function formatCostFull(usd: number): string {
  if (!isFinite(usd) || usd === 0) return "$0.0000";
  if (usd < 0.0001) return `$${usd.toFixed(6)}`;
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(3)}`;
}

interface CompareAgentColumnProps {
  agent: AgentSnapshot;
  onRemove: () => void;
  onOpenDetails: () => void;
}

function CompareAgentColumn({ agent, onRemove, onOpenDetails }: CompareAgentColumnProps) {
  const { displayName, statusConfig } = useAgentDisplay(agent);
  const { stats: llmStats, isLoading } = useAgentLlmCalls(agent.agent_id);

  return (
    <div className="flex flex-col gap-4 min-w-[240px] rounded-xl border border-border bg-card p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm truncate">{displayName}</p>
          {agent.cwd && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {agent.cwd.split(/[/\\]/).filter(Boolean).pop() ?? agent.cwd}
            </p>
          )}
        </div>
        <button
          onClick={onRemove}
          className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
          title="Remove from comparison"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Status */}
      <div className="flex items-center gap-2">
        <Badge
          variant={statusConfig.badge}
          size="sm"
          showDot={agent.status === "working"}
        >
          {statusConfig.label}
        </Badge>
        {agent.status_since && (
          <span className="text-xs text-muted-foreground">
            {formatDuration(Date.now() - new Date(agent.status_since).getTime())}
          </span>
        )}
      </div>

      {/* Current task */}
      {agent.current_task && (
        <div className="rounded-lg border border-border bg-muted/40 px-3 py-2">
          <p className="text-xs text-muted-foreground mb-0.5">Current task</p>
          <p className="text-sm line-clamp-3">{agent.current_task}</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
          <div className="flex items-center gap-1 text-muted-foreground mb-1">
            <PlayCircle className="h-3 w-3" />
            <span className="text-xs">Runs</span>
          </div>
          <p className="text-lg font-semibold tabular-nums">{agent.session_runs}</p>
        </div>

        <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
          <div className="flex items-center gap-1 text-muted-foreground mb-1">
            <Zap className="h-3 w-3 text-amber-400" />
            <span className="text-xs">Tokens</span>
          </div>
          <p className="text-lg font-semibold tabular-nums">{formatTokens(agent.session_tokens)}</p>
        </div>

        <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
          <div className="flex items-center gap-1 text-muted-foreground mb-1">
            <Activity className="h-3 w-3 text-emerald-400" />
            <span className="text-xs">Cost</span>
          </div>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">…</p>
          ) : (
            <p className="text-lg font-semibold tabular-nums">{formatCostFull(llmStats.totalCostUsd)}</p>
          )}
        </div>

        <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
          <div className="flex items-center gap-1 text-muted-foreground mb-1">
            <XCircle className={cn("h-3 w-3", agent.session_errors > 0 && "text-destructive")} />
            <span className="text-xs">Errors</span>
          </div>
          <p className={cn("text-lg font-semibold tabular-nums", agent.session_errors > 0 && "text-destructive")}>
            {agent.session_errors}
          </p>
        </div>
      </div>

      {/* Model + location */}
      <div className="space-y-1 text-xs text-muted-foreground">
        {llmStats.lastModel && (
          <div className="flex items-center gap-1.5">
            <Activity className="h-3 w-3 shrink-0" />
            <span className="truncate">{llmStats.lastModel}</span>
          </div>
        )}
        {agent.cwd && (
          <div className="flex items-center gap-1.5">
            <FolderOpen className="h-3 w-3 shrink-0" />
            <span className="truncate">{agent.cwd}</span>
          </div>
        )}
        {agent.terminal && (
          <div className="flex items-center gap-1.5">
            <Terminal className="h-3 w-3 shrink-0" />
            <span className="truncate">{agent.terminal}</span>
          </div>
        )}
      </div>

      <Button variant="outline" size="sm" onClick={onOpenDetails} className="w-full mt-auto">
        Open Details
      </Button>
    </div>
  );
}

interface CompareViewProps {
  agents: AgentSnapshot[];
  onAgentClick: (agent: AgentSnapshot) => void;
}

export function CompareView({ agents, onAgentClick }: CompareViewProps) {
  const { compareSet, toggleCompare } = useAgentsStore();

  const comparedAgents = compareSet
    .map((id) => agents.find((a) => a.agent_id === id))
    .filter((a): a is AgentSnapshot => a !== undefined);

  if (comparedAgents.length === 0) {
    return (
      <EmptyState
        icon={Activity}
        title="No agents selected"
        description="Check ☐ on agent cards or table rows to add agents to the comparison."
      />
    );
  }

  const colClass =
    comparedAgents.length === 1
      ? "grid-cols-1"
      : comparedAgents.length === 2
      ? "grid-cols-2"
      : comparedAgents.length === 3
      ? "grid-cols-3"
      : "grid-cols-4";

  return (
    <div className={cn("grid gap-4 overflow-x-auto pb-2", colClass)}>
      {comparedAgents.map((agent) => (
        <CompareAgentColumn
          key={agent.agent_id}
          agent={agent}
          onRemove={() => toggleCompare(agent.agent_id)}
          onOpenDetails={() => onAgentClick(agent)}
        />
      ))}
    </div>
  );
}
