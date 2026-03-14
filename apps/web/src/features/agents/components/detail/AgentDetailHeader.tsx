import type { AgentSnapshot } from "@marionette/shared";
import { RotateCcw, Trash2, ExternalLink, Square } from "lucide-react";
import { useState } from "react";
import { Button } from "../../../../components/ui/button";
import { Badge } from "../../../../components/ui/badge";
import { GlassCard } from "../../../../components/ui/glass-card";
import { EditableText } from "../../../../components/ui/editable-text";
import { useAgentDisplay } from "../../hooks/useAgentDisplay";
import { useAgentUpdate } from "../../hooks/useAgentUpdate";
import { useAgentDelete } from "../../hooks/useAgentDelete";
import { useAgentNotes } from "../../hooks/useAgentNotes";
import { useAgentKill, useAgentFocus } from "../../hooks/useAgentActions";
import { TokenAlertsSection } from "../TokenAlertsSection";

interface AgentDetailHeaderProps {
  agent: AgentSnapshot;
}

export function AgentDetailHeader({ agent }: AgentDetailHeaderProps) {
  const { displayName, hasCustomName, statusConfig } = useAgentDisplay(agent);
  const { mutate: updateName, isError: nameUpdateFailed } = useAgentUpdate(agent.agent_id);
  const { mutate: deleteAgent, isPending: isDeleting } = useAgentDelete(agent.agent_id);
  const { mutate: saveNotes } = useAgentNotes(agent.agent_id);
  const { mutate: kill, isPending: isKilling, error: killError } = useAgentKill(agent.agent_id);
  const { mutate: focus, isPending: isFocusing, error: focusError } = useAgentFocus(agent.agent_id);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmKill, setConfirmKill] = useState(false);

  return (
    <GlassCard className="p-4 space-y-3">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <EditableText
            value={displayName}
            onSave={(newName) => updateName(newName)}
            className="text-2xl font-bold flex-1"
          />
          <Badge
            variant={statusConfig.badge}
            size="md"
            showDot={agent.status === "working"}
          >
            {statusConfig.label}
          </Badge>
        </div>
        {hasCustomName && (
          <Button variant="ghost" size="sm" onClick={() => updateName("")} className="gap-2">
            <RotateCcw className="h-3 w-3" />
            Reset to Original Name
          </Button>
        )}
        {hasCustomName && agent.agent_name && (
          <p className="text-sm text-muted-foreground">Original: {agent.agent_name}</p>
        )}
        {!hasCustomName && agent.agent_name && displayName !== agent.agent_name && (
          <p className="text-sm text-muted-foreground">From MCP: {agent.agent_name}</p>
        )}
        {nameUpdateFailed && (
          <p className="text-sm text-destructive">Failed to update name. Please try again.</p>
        )}
        <div className="pt-1">
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Remove this agent?</span>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => deleteAgent()}
                disabled={isDeleting}
              >
                {isDeleting ? "Removing…" : "Confirm"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmDelete(true)}
              className="gap-2 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3 w-3" />
              Remove Agent
            </Button>
          )}
        </div>

        {/* Notes */}
        <div className="pt-2">
          <p className="text-xs text-muted-foreground mb-1">Notes</p>
          <textarea
            key={agent.agent_id}
            defaultValue={String((agent.metadata as Record<string, unknown>)?.notes ?? "")}
            onBlur={(e) => saveNotes(e.target.value)}
            placeholder="Add a note about what this agent is doing..."
            className="w-full text-sm bg-muted/30 border border-border/50 rounded px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/50"
            rows={2}
          />
        </div>

        {/* Token alerts */}
        <TokenAlertsSection agentId={agent.agent_id} />

        {/* Agent Controls */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => focus()}
            disabled={isFocusing}
          >
            <ExternalLink className="h-3 w-3" />
            Focus
          </Button>
          {agent.status !== "disconnected" && (
            confirmKill ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 text-destructive border-destructive/50 hover:bg-destructive/10"
                  onClick={() => kill(undefined, { onSuccess: () => setConfirmKill(false) })}
                  disabled={isKilling}
                >
                  <Square className="h-3 w-3" />
                  Confirm Kill
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmKill(false)}>
                  Cancel
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="gap-2 text-muted-foreground hover:text-destructive"
                onClick={() => setConfirmKill(true)}
                disabled={isKilling}
              >
                <Square className="h-3 w-3" />
                Kill
              </Button>
            )
          )}
        </div>
        {focusError && (
          <p className="text-xs text-muted-foreground">
            {(focusError as any)?.data?.error ?? "Focus not supported for this terminal/platform."}
          </p>
        )}
        {killError && (
          <p className="text-xs text-destructive">
            {(killError as any)?.data?.error ?? "Failed to kill agent."}
          </p>
        )}
      </div>
    </GlassCard>
  );
}
