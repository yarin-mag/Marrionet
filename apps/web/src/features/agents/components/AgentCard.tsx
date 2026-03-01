import { memo, useState, useEffect } from "react";
import type { AgentSnapshot } from "@marionette/shared";
import { Card, CardContent, CardHeader } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { EditableText } from "../../../components/ui/editable-text";
import { StatDisplay } from "../../../components/ui/stat-display";
import { FolderOpen, Terminal, Zap, XCircle, PlayCircle, AlertTriangle, ChevronUp, Check } from "lucide-react";
import { formatTime, formatTokens, formatDuration, formatBurnRate, cn } from "../../../lib/utils";
import { useAgentDisplay } from "../hooks/useAgentDisplay";
import { useAgentUpdate } from "../hooks/useAgentUpdate";
import { useAgentErrors } from "../hooks/useAgentErrors";
import { useAgentLlmCalls } from "../hooks/useAgentLlmCalls";
import { useNow } from "../../../hooks/use-live-timer";
import { useAgentsStore } from "../stores/agents.store";

interface AgentCardProps {
  /** Agent data snapshot */
  agent: AgentSnapshot;
  /** Callback when card is clicked */
  onClick?: () => void;
}

/** Compact expandable list of recent errors for an agent */
function AgentErrorList({ agentId }: { agentId: string }) {
  const { data, isLoading } = useAgentErrors(agentId, true);

  if (isLoading) {
    return <p className="text-xs text-muted-foreground px-1 py-1">Loading errors…</p>;
  }
  if (!data || data.length === 0) {
    return <p className="text-xs text-muted-foreground px-1 py-1">No error details found.</p>;
  }

  return (
    <ul className="space-y-1.5">
      {data.map((err) => (
        <li key={err.id} className="text-xs rounded-md border border-[hsl(var(--error)/30)] bg-[hsl(var(--error)/8)] px-2 py-1.5">
          <div className="flex items-start gap-1.5">
            <AlertTriangle className="h-3 w-3 text-[hsl(var(--error))] mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[hsl(var(--error))] font-medium leading-snug break-words">
                {err.summary ?? err.error ?? "Unknown error"}
              </p>
              <p className="text-muted-foreground mt-0.5">{formatTime(err.timestamp)}</p>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * AgentCard - Displays agent summary with status, stats, and current task
 * Uses new design system with elevation, status colors, and refined spacing
 * @example
 * <AgentCard agent={agentData} onClick={() => openDetail(agentData.agent_id)} />
 */
function formatCostCompact(usd: number): string {
  if (!isFinite(usd) || usd === 0) return "$0.00";
  if (usd < 0.001) return `$${usd.toFixed(5)}`;
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(3)}`;
}

export const AgentCard = memo(function AgentCard({ agent, onClick }: AgentCardProps) {
  const { displayName, hasCustomName, statusConfig, isDisconnected } =
    useAgentDisplay(agent);
  const { mutate: updateName } = useAgentUpdate(agent.agent_id);
  const { stats: llmStats } = useAgentLlmCalls(agent.agent_id);
  const now = useNow();
  const [errorsOpen, setErrorsOpen] = useState(false);
  const { compareSet, toggleCompare } = useAgentsStore();
  const isCompared = compareSet.includes(agent.agent_id);

  const meta = agent.metadata as Record<string, unknown> | null | undefined;
  const tokenBudget = meta?.token_budget as number | undefined;
  const costBudget = meta?.cost_budget_usd as number | undefined;
  const overBudget =
    (tokenBudget != null && agent.session_tokens > tokenBudget) ||
    (costBudget != null && llmStats.totalCostUsd > costBudget);

  // Reset expanded errors panel when the card switches to a different agent
  useEffect(() => {
    setErrorsOpen(false);
  }, [agent.agent_id]);

  return (
    <Card
      elevation="medium"
      interactive
      onClick={onClick}
      className={cn(
        "relative group min-w-[300px] border-l-4 transition-all",
        statusConfig.border,
        statusConfig.bg,
        agent.status === "working" && "border-l-glow-working",
        isDisconnected && "opacity-60 grayscale transition-[opacity,filter] duration-500",
        overBudget && "ring-2 ring-destructive/60"
      )}
    >
      {/* Compare checkbox — visible on hover or when selected */}
      <div
        className={cn(
          "absolute top-2 right-2 transition-opacity z-10",
          isCompared ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}
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
      </div>

      <CardHeader className="pb-4">
        <div className="flex items-start gap-3">
          {/* Icon with background */}
          <div className="flex-shrink-0 p-2.5 rounded-lg bg-primary/10 border border-primary/20">
            <FolderOpen className="h-5 w-5 text-primary" />
          </div>

          {/* Name and metadata */}
          <div className="flex-1 min-w-0 space-y-2">
            <div
              className="flex items-center gap-2 flex-wrap"
              onClick={(e) => e.stopPropagation()}
            >
              <EditableText
                value={displayName}
                onSave={updateName}
                className="font-semibold text-base truncate"
              />
              {hasCustomName && (
                <Badge variant="primary" size="sm">
                  Custom
                </Badge>
              )}
            </div>

            {/* Status badge with optional dot for working status */}
            <div className="flex items-center gap-2">
              <Badge
                variant={statusConfig.badge}
                size="sm"
                showDot={agent.status === "working"}
              >
                {statusConfig.label}
              </Badge>
              {agent.status_since && (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {formatDuration(now - new Date(agent.status_since).getTime())}
                </span>
              )}
            </div>

            {/* Terminal + CWD info */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Terminal className="h-3 w-3 flex-shrink-0" />
                <span>{agent.terminal ?? "unknown"}</span>
              </div>
              {agent.cwd && (
                <div
                  className="flex items-center gap-1.5 min-w-0"
                  title={agent.cwd}
                >
                  <FolderOpen className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate max-w-[120px]">
                    {agent.cwd.split(/[/\\]/).filter(Boolean).pop() ?? agent.cwd}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Current Task */}
        {agent.current_task && (
          <div className="rounded-lg border border-border bg-muted/50 p-3">
            <p className="text-label text-muted-foreground mb-1.5 flex items-center justify-between">
              <span>Current Task</span>
              {agent.status === "working" && agent.status_since && (
                <span className="text-xs tabular-nums">
                  {formatDuration(now - new Date(agent.status_since).getTime())}
                </span>
              )}
            </p>
            <p className="text-sm leading-tight line-clamp-2">
              {agent.current_task}
            </p>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3 items-start">
          <StatDisplay
            label="Runs"
            value={agent.session_runs}
            icon={PlayCircle}
          />
          <div className="flex flex-col gap-0.5">
            <StatDisplay
              label="Tokens"
              value={formatTokens(agent.session_tokens)}
              icon={Zap}
              iconColor="text-amber-500"
            />
            {llmStats.totalCostUsd > 0 && (
              <p className="text-xs text-muted-foreground text-center tabular-nums">
                {formatCostCompact(llmStats.totalCostUsd)}
              </p>
            )}
            {agent.status === "working" && agent.session_start && (() => {
              const burnRate = formatBurnRate(
                agent.session_tokens,
                now - new Date(agent.session_start).getTime()
              );
              return burnRate ? (
                <p className="text-xs text-amber-500/80 text-center tabular-nums">{burnRate}</p>
              ) : null;
            })()}
          </div>
          <div
            onClick={
              agent.session_errors > 0
                ? (e) => {
                    e.stopPropagation();
                    setErrorsOpen((o) => !o);
                  }
                : undefined
            }
            className={agent.session_errors > 0 ? "cursor-pointer" : undefined}
          >
            <StatDisplay
              label="Errors"
              value={agent.session_errors}
              icon={errorsOpen && agent.session_errors > 0 ? ChevronUp : XCircle}
              iconColor={agent.session_errors > 0 ? "text-[hsl(var(--error))]" : undefined}
              variant={agent.session_errors > 0 ? "error" : "default"}
            />
          </div>
        </div>

        {/* Expandable error list */}
        {errorsOpen && agent.session_errors > 0 && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="space-y-1 min-h-[52px]"
          >
            <AgentErrorList agentId={agent.agent_id} />
          </div>
        )}

        {/* Over budget indicator */}
        {overBudget && (
          <span className="text-xs text-destructive font-medium flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> Over budget
          </span>
        )}

        {/* Last Activity */}
        <p className="text-xs text-muted-foreground">
          Last: {formatTime(agent.last_activity)}
        </p>
      </CardContent>
    </Card>
  );
});
