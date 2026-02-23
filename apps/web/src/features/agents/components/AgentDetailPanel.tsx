import type { AgentSnapshot } from "@marionette/shared";
import { X, Clock, Zap, TrendingUp, XCircle, Activity, FolderOpen, Terminal, Search, RotateCcw, MessagesSquare } from "lucide-react";
import { useState } from "react";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../../components/ui/tabs";
import { DeepInspectionPanel } from "./DeepInspectionPanel";
import { AgentConversationPanel } from "./AgentConversationPanel";
import { EditableText } from "../../../components/ui/editable-text";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { FancyHeroSection } from "../../../components/ui/fancy-hero-section";
import { FancyStatCard } from "../../../components/ui/fancy-stat-card";
import { GlassCard } from "../../../components/ui/glass-card";
import { GradientBorder } from "../../../components/ui/gradient-border";
import { formatTime, formatTokens, formatDuration } from "../../../lib/utils";
import { useAgentDisplay } from "../hooks/useAgentDisplay";
import { useAgentUpdate } from "../hooks/useAgentUpdate";

interface AgentDetailPanelProps {
  agent: AgentSnapshot;
  onClose: () => void;
  hideCloseButton?: boolean;
}

/**
 * AgentDetailPanel - Detailed view of agent with tabs
 * Used in both modal and sidecard views
 */
export function AgentDetailPanel({ agent, onClose, hideCloseButton }: AgentDetailPanelProps) {
  const { displayName, hasCustomName, statusConfig } = useAgentDisplay(agent);
  const { mutate: updateName } = useAgentUpdate(agent.agent_id);
  const [activeTab, setActiveTab] = useState<'overview' | 'conversation' | 'inspect'>('overview');


  return (
    <div className="space-y-4">
      {/* Close Button */}
      {!hideCloseButton && (
        <div className="flex justify-end">
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Agent Name Section */}
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
            <Button
              variant="ghost"
              size="sm"
              onClick={() => updateName("")}
              className="gap-2"
            >
              <RotateCcw className="h-3 w-3" />
              Reset to Original Name
            </Button>
          )}
          {hasCustomName && agent.agent_name && (
            <p className="text-sm text-muted-foreground">
              Original: {agent.agent_name}
            </p>
          )}
          {!hasCustomName && agent.agent_name && displayName !== agent.agent_name && (
            <p className="text-sm text-muted-foreground">
              From MCP: {agent.agent_name}
            </p>
          )}
        </div>
      </GlassCard>

      {/* Fancy Hero (Compact for Sidecard) */}
      <FancyHeroSection
        title={`Status: ${statusConfig.label}`}
        status={agent.status}
        duration={agent.total_duration_ms > 0 ? formatDuration(agent.total_duration_ms) : undefined}
        stats={[
          {
            icon: TrendingUp,
            label: "Runs",
            value: agent.session_runs,
            color: "bg-indigo-500/10",
          },
          {
            icon: Zap,
            label: "Tokens",
            value: formatTokens(agent.session_tokens),
            color: "bg-purple-500/10",
          },
        ]}
        className="p-6"
      />

      {/* Tabbed Interface */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
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

        {/* Overview Tab - Existing Content */}
        <TabsContent value="overview">
          <div className="space-y-4">
        {/* Current Task */}
        <GradientBorder gradient="from-indigo-500 to-purple-600" glow>
          <GlassCard className="border-0 p-4">
            <CardHeader className="p-0 pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Current Task
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <p className="text-sm">
                {agent.current_task || <span className="text-muted-foreground">None</span>}
              </p>
            </CardContent>
          </GlassCard>
        </GradientBorder>

        {/* Session Stats - 2x2 Grid with Fancy Cards */}
        <div className="grid grid-cols-2 gap-3">
          <FancyStatCard
            icon={TrendingUp}
            label="Runs"
            value={agent.session_runs}
            gradient="from-indigo-400 to-purple-600"
            className="p-4"
          />
          <FancyStatCard
            icon={Activity}
            label="Tasks"
            value={agent.total_tasks}
            gradient="from-cyan-400 to-blue-500"
            className="p-4"
          />
          <FancyStatCard
            icon={Zap}
            label="Tokens"
            value={formatTokens(agent.session_tokens)}
            gradient="from-amber-400 to-orange-500"
            className="p-4"
          />
          <FancyStatCard
            icon={XCircle}
            label="Errors"
            value={agent.session_errors}
            gradient="from-rose-400 to-red-500"
            className="p-4"
          />
        </div>

        {/* Environment */}
        <GlassCard className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500">
              <FolderOpen className="h-4 w-4 text-white" />
            </div>
            <h3 className="font-semibold">Environment</h3>
          </div>

          <div className="space-y-3 text-sm">
            <div>
              <CardDescription className="text-xs uppercase tracking-wide">Working Directory</CardDescription>
              <p className="font-mono text-xs mt-1 break-all">{agent.cwd || "Unknown"}</p>
            </div>
            <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
            <div>
              <CardDescription className="text-xs uppercase tracking-wide">Terminal</CardDescription>
              <div className="flex items-center gap-2 mt-1">
                <Terminal className="h-3 w-3 text-muted-foreground" />
                <p className="text-xs">{agent.terminal || "Unknown"}</p>
              </div>
            </div>
            <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
            <div>
              <CardDescription className="text-xs uppercase tracking-wide">Agent ID</CardDescription>
              <p className="font-mono text-xs mt-1 break-all">{agent.agent_id}</p>
            </div>
          </div>
        </GlassCard>

        {/* Activity */}
        <GlassCard className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-500">
              <Clock className="h-4 w-4 text-white" />
            </div>
            <h3 className="font-semibold">Activity</h3>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between gap-2">
              <CardDescription className="text-xs">Session Started</CardDescription>
              <span className="text-xs">{formatTime(agent.session_start)}</span>
            </div>
            <div className="flex justify-between gap-2">
              <CardDescription className="text-xs">Last Activity</CardDescription>
              <span className="text-xs">{formatTime(agent.last_activity)}</span>
            </div>
            {agent.total_duration_ms > 0 && (
              <div className="flex justify-between gap-2">
                <CardDescription className="text-xs">Total Duration</CardDescription>
                <span className="text-xs">{formatDuration(agent.total_duration_ms)}</span>
              </div>
            )}
          </div>
        </GlassCard>

        {/* Metadata */}
        {agent.metadata && typeof agent.metadata === 'object' && Object.keys(agent.metadata).length > 0 && (
          <GlassCard className="p-4">
            <h3 className="font-semibold mb-2">Metadata</h3>
            <pre className="text-xs bg-muted/50 p-3 rounded overflow-x-auto border">
              {JSON.stringify(agent.metadata, null, 2)}
            </pre>
          </GlassCard>
        )}
          </div>
        </TabsContent>

        {/* Conversation Tab */}
        <TabsContent value="conversation" className="min-h-[500px]">
          <AgentConversationPanel agentId={agent.agent_id} />
        </TabsContent>

        {/* Inspect Tab */}
        <TabsContent value="inspect">
          <DeepInspectionPanel agentId={agent.agent_id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
