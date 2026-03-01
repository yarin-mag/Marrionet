import type { AgentSnapshot } from "@marionette/shared";
import { X, Zap, TrendingUp, Activity, Search, MessagesSquare, RotateCcw, Trash2, ExternalLink, Square } from "lucide-react";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../../components/ui/tabs";
import { DeepInspectionPanel } from "./DeepInspectionPanel";
import { AgentConversationPanel } from "./AgentConversationPanel";
import { AgentOverviewTab } from "./AgentOverviewTab";
import { EditableText } from "../../../components/ui/editable-text";
import { FancyHeroSection } from "../../../components/ui/fancy-hero-section";
import { GlassCard } from "../../../components/ui/glass-card";
import { formatTokens, formatDuration } from "../../../lib/utils";
import { useAgentDisplay } from "../hooks/useAgentDisplay";
import { useAgentUpdate } from "../hooks/useAgentUpdate";
import { useAgentDelete } from "../hooks/useAgentDelete";
import { useAgentNotes } from "../hooks/useAgentNotes";
import { useAgentKill, useAgentFocus } from "../hooks/useAgentActions";
import { apiService } from "../../../services/api.service";

type TabValue = 'overview' | 'conversation' | 'inspect';

interface AgentDetailPanelProps {
  agent: AgentSnapshot;
  onClose: () => void;
  hideCloseButton?: boolean;
}

export function AgentDetailPanel({ agent, onClose, hideCloseButton }: AgentDetailPanelProps) {
  const { displayName, hasCustomName, statusConfig } = useAgentDisplay(agent);
  const { mutate: updateName, isError: nameUpdateFailed } = useAgentUpdate(agent.agent_id);
  const { mutate: deleteAgent, isPending: isDeleting } = useAgentDelete(agent.agent_id);
  const { mutate: saveNotes } = useAgentNotes(agent.agent_id);
  const { mutate: kill, isPending: isKilling, error: killError } = useAgentKill(agent.agent_id);
  const { mutate: focus, isPending: isFocusing, error: focusError } = useAgentFocus(agent.agent_id);
  const { mutate: saveBudget, isError: isBudgetError } = useMutation({
    mutationFn: (fields: { token_budget?: number | null; cost_budget_usd?: number | null }) =>
      apiService.updateAgent(agent.agent_id, fields),
  });
  const [activeTab, setActiveTab] = useState<TabValue>('overview');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmKill, setConfirmKill] = useState(false);

  return (
    <div className="space-y-4">
      {!hideCloseButton && (
        <div className="flex justify-end">
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Agent Name */}
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

          {/* Budget alerts */}
          <div className="pt-2">
            <p className="text-xs text-muted-foreground mb-1">Budget alerts</p>
            <div className="flex gap-2">
              <div className="flex-1">
                <p className="text-xs text-muted-foreground/70 mb-0.5">Token limit</p>
                <input
                  type="number"
                  min="0"
                  step="1"
                  key={`tb-${agent.agent_id}`}
                  defaultValue={(agent.metadata as Record<string, unknown>)?.token_budget as number ?? ""}
                  onBlur={(e) =>
                    saveBudget({ token_budget: e.target.value ? Math.max(0, Number(e.target.value)) : null })
                  }
                  placeholder="e.g. 100000"
                  className="w-full text-sm bg-muted/30 border border-border/50 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground/70 mb-0.5">Cost limit (USD)</p>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  key={`cb-${agent.agent_id}`}
                  defaultValue={(agent.metadata as Record<string, unknown>)?.cost_budget_usd as number ?? ""}
                  onBlur={(e) =>
                    saveBudget({ cost_budget_usd: e.target.value ? Math.max(0, Number(e.target.value)) : null })
                  }
                  placeholder="e.g. 2.50"
                  className="w-full text-sm bg-muted/30 border border-border/50 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
              </div>
            </div>
            {isBudgetError && (
              <p className="text-xs text-destructive mt-1">Failed to save budget. Please try again.</p>
            )}
          </div>

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

      <FancyHeroSection
        title={`Status: ${statusConfig.label}`}
        status={agent.status}
        duration={
          agent.status_since
            ? `for ${formatDuration(Date.now() - new Date(agent.status_since).getTime())}`
            : (agent.total_duration_ms > 0 ? formatDuration(agent.total_duration_ms) : undefined)
        }
        stats={[
          { icon: TrendingUp, label: "Runs", value: agent.session_runs, color: "bg-indigo-500/10" },
          { icon: Zap, label: "Tokens", value: formatTokens(agent.session_tokens), color: "bg-purple-500/10" },
        ]}
        className="p-6"
      />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="conversation" className="flex items-center gap-2">
            <MessagesSquare className="h-4 w-4" />
            Conversation
          </TabsTrigger>
          <TabsTrigger value="inspect" className="flex items-center gap-2" disabled aria-label="Inspect (coming soon)">
            <Search className="h-4 w-4" />
            Inspect
            <span className="text-[10px] text-muted-foreground/60 font-normal leading-none">soon</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <AgentOverviewTab agent={agent} />
        </TabsContent>

        <TabsContent value="conversation" className="min-h-[500px]">
          <AgentConversationPanel agentId={agent.agent_id} />
        </TabsContent>

        <TabsContent value="inspect">
          <DeepInspectionPanel agentId={agent.agent_id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
