import { memo } from "react";
import type { AgentSnapshot } from "@marionette/shared";
import { Card, CardContent, CardHeader } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { EditableText } from "../../../components/ui/editable-text";
import { StatDisplay } from "../../../components/ui/stat-display";
import { FolderOpen, Terminal, Zap, XCircle, PlayCircle } from "lucide-react";
import { formatTime, formatTokens, cn } from "../../../lib/utils";
import { useAgentDisplay } from "../hooks/useAgentDisplay";
import { useAgentUpdate } from "../hooks/useAgentUpdate";

interface AgentCardProps {
  /** Agent data snapshot */
  agent: AgentSnapshot;
  /** Callback when card is clicked */
  onClick?: () => void;
}

/**
 * AgentCard - Displays agent summary with status, stats, and current task
 * Uses new design system with elevation, status colors, and refined spacing
 * @example
 * <AgentCard agent={agentData} onClick={() => openDetail(agentData.agent_id)} />
 */
export const AgentCard = memo(function AgentCard({ agent, onClick }: AgentCardProps) {
  const { displayName, hasCustomName, statusConfig, isDisconnected } =
    useAgentDisplay(agent);
  const { mutate: updateName } = useAgentUpdate(agent.agent_id);

  return (
    <Card
      elevation="medium"
      interactive
      onClick={onClick}
      className={cn(
        "min-w-[300px] border-l-4 transition-all",
        statusConfig.border,
        statusConfig.bg,
        agent.status === "working" && "border-l-glow-working",
        isDisconnected && "opacity-60 grayscale transition-[opacity,filter] duration-500"
      )}
    >
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
            <Badge
              variant={statusConfig.badge}
              size="sm"
              showDot={agent.status === "working"}
            >
              {statusConfig.label}
            </Badge>

            {/* Terminal info */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Terminal className="h-3 w-3" />
              <span>{agent.terminal ?? "unknown"}</span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Current Task */}
        {agent.current_task && (
          <div className="rounded-lg border border-border bg-muted/50 p-3">
            <p className="text-label text-muted-foreground mb-1.5">
              Current Task
            </p>
            <p className="text-sm leading-tight line-clamp-2">
              {agent.current_task}
            </p>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3">
          <StatDisplay
            label="Runs"
            value={agent.session_runs}
            icon={PlayCircle}
          />
          <StatDisplay
            label="Tokens"
            value={formatTokens(agent.session_tokens)}
            icon={Zap}
            iconColor="text-amber-500"
          />
          <StatDisplay
            label="Errors"
            value={agent.session_errors}
            icon={XCircle}
            iconColor={agent.session_errors > 0 ? "text-[hsl(var(--error))]" : undefined}
            variant={agent.session_errors > 0 ? "error" : "default"}
          />
        </div>

        {/* Last Activity */}
        <p className="text-xs text-muted-foreground">
          Last: {formatTime(agent.last_activity)}
        </p>
      </CardContent>
    </Card>
  );
});
