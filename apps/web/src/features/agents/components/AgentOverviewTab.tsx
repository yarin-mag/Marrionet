import type { AgentSnapshot } from "@marionette/shared";
import { Clock, Zap, TrendingUp, XCircle, Activity, FolderOpen, Terminal } from "lucide-react";
import { GlassCard } from "../../../components/ui/glass-card";
import { GradientBorder } from "../../../components/ui/gradient-border";
import { FancyStatCard } from "../../../components/ui/fancy-stat-card";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { formatTime, formatTokens, formatDuration } from "../../../lib/utils";

interface AgentOverviewTabProps {
  agent: AgentSnapshot;
}

export function AgentOverviewTab({ agent }: AgentOverviewTabProps) {
  return (
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

      {/* Session Stats */}
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
  );
}
