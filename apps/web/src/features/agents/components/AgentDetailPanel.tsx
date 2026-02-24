import type { AgentSnapshot } from "@marionette/shared";
import { X, Zap, TrendingUp, Activity, Search, MessagesSquare, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
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
  const [activeTab, setActiveTab] = useState<TabValue>('overview');
  const [confirmDelete, setConfirmDelete] = useState(false);

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
        </div>
      </GlassCard>

      <FancyHeroSection
        title={`Status: ${statusConfig.label}`}
        status={agent.status}
        duration={agent.total_duration_ms > 0 ? formatDuration(agent.total_duration_ms) : undefined}
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
          <TabsTrigger value="inspect" className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Inspect
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
