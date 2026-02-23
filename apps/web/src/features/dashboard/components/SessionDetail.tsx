import { format } from "date-fns";
import { Clock, FolderOpen, Terminal, Zap, Activity, Calendar, TrendingUp, XCircle } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { FancyHeroSection } from "../../../components/ui/fancy-hero-section";
import { FancyStatCard } from "../../../components/ui/fancy-stat-card";
import { FancyMetricGrid } from "../../../components/ui/fancy-metric-grid";
import { GlassCard } from "../../../components/ui/glass-card";
import { GradientBorder } from "../../../components/ui/gradient-border";
import type { AgentSession } from "../../../services/calendar.service";
import { formatTokens } from "../../../lib/utils";

interface SessionDetailProps {
  session: AgentSession;
}

const statusConfig: Record<
  string,
  {
    label: string;
    variant: "success" | "secondary" | "default" | "warning" | "destructive" | "outline";
    color: string;
  }
> = {
  working: { label: "Working", variant: "success", color: "bg-green-500/10 border-green-500/20" },
  idle: { label: "Idle", variant: "secondary", color: "bg-gray-500/10 border-gray-500/20" },
  starting: { label: "Starting", variant: "default", color: "bg-blue-500/10 border-blue-500/20" },
  blocked: { label: "Blocked", variant: "warning", color: "bg-yellow-500/10 border-yellow-500/20" },
  error: { label: "Error", variant: "destructive", color: "bg-red-500/10 border-red-500/20" },
  crashed: { label: "Crashed", variant: "destructive", color: "bg-red-500/10 border-red-500/20" },
  finished: { label: "Finished", variant: "outline", color: "bg-gray-500/10 border-gray-500/20" },
  disconnected: { label: "Disconnected", variant: "outline", color: "bg-gray-500/10 border-gray-500/20" },
};

export function SessionDetail({ session }: SessionDetailProps) {
  const duration = Math.round(
    (session.endTime.getTime() - session.startTime.getTime()) / 1000 / 60
  );
  const hours = Math.floor(duration / 60);
  const minutes = duration % 60;
  const durationString = `${hours > 0 ? `${hours}h ` : ""}${minutes}m`;

  const status = statusConfig[session.status] || statusConfig.idle;

  // Prepare stats for FancyHeroSection
  const heroStats = [
    {
      icon: TrendingUp,
      label: "Runs",
      value: session.runs,
      color: "bg-indigo-500/10",
    },
    {
      icon: Zap,
      label: "Tokens",
      value: formatTokens(session.tokens),
      color: "bg-purple-500/10",
    },
  ];

  // Prepare metrics for FancyMetricGrid
  const metrics = [
    {
      icon: TrendingUp,
      label: "Total Runs",
      value: session.runs,
      gradient: "from-indigo-400 to-purple-600",
    },
    {
      icon: Zap,
      label: "Tokens Used",
      value: formatTokens(session.tokens),
      gradient: "from-amber-400 to-orange-500",
    },
    {
      icon: XCircle,
      label: "Errors",
      value: 0, // Add error count if available in session data
      gradient: "from-rose-400 to-red-500",
    },
    {
      icon: Clock,
      label: "Duration",
      value: durationString,
      gradient: "from-cyan-400 to-blue-500",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Fancy Hero Header */}
      <FancyHeroSection
        title={session.agentName}
        status={session.status}
        duration={durationString}
        stats={heroStats}
      />

      {/* Current Task - Fancy Display with Gradient Border */}
      <GradientBorder gradient="from-indigo-500 to-purple-600" glow>
        <GlassCard className="border-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Current Task
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-base leading-relaxed">{session.task}</p>
          </CardContent>
        </GlassCard>
      </GradientBorder>

      {/* Two Column Layout with Fancy Cards */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Timeline - Fancy Card */}
        <GlassCard className="p-6 space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-500">
              <Calendar className="h-5 w-5 text-white" />
            </div>
            <h3 className="text-lg font-semibold">Timeline</h3>
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <CardDescription className="text-xs uppercase tracking-wide">Started</CardDescription>
              <p className="text-sm font-semibold">
                {format(session.startTime, "MMM d, yyyy")}
              </p>
              <p className="text-xs text-muted-foreground">
                {format(session.startTime, "h:mm a")}
              </p>
            </div>

            <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

            <div className="space-y-1">
              <CardDescription className="text-xs uppercase tracking-wide">Ended</CardDescription>
              <p className="text-sm font-semibold">
                {format(session.endTime, "MMM d, yyyy")}
              </p>
              <p className="text-xs text-muted-foreground">
                {format(session.endTime, "h:mm a")}
              </p>
            </div>
          </div>
        </GlassCard>

        {/* Environment - Fancy Card */}
        <GlassCard className="p-6 space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500">
              <FolderOpen className="h-5 w-5 text-white" />
            </div>
            <h3 className="text-lg font-semibold">Environment</h3>
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <CardDescription className="text-xs uppercase tracking-wide">Working Directory</CardDescription>
              <p className="font-mono text-xs break-all bg-muted/50 p-2 rounded border">
                {session.cwd}
              </p>
            </div>

            <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

            <div className="space-y-1">
              <CardDescription className="text-xs uppercase tracking-wide">Terminal</CardDescription>
              <div className="flex items-center gap-2 text-sm">
                <Terminal className="h-3 w-3 text-muted-foreground" />
                <span className="font-mono text-xs">{session.terminal}</span>
              </div>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Fancy Metric Grid */}
      <FancyMetricGrid metrics={metrics} columns={4} />

      {/* Agent ID - Glass Card */}
      <GlassCard className="p-4">
        <div className="flex items-center justify-between">
          <CardDescription className="text-xs uppercase tracking-wide">Agent ID</CardDescription>
          <p className="font-mono text-xs text-muted-foreground truncate max-w-xs">
            {session.agentId}
          </p>
        </div>
      </GlassCard>
    </div>
  );
}
