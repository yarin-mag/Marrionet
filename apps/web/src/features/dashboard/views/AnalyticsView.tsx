import type { AgentSnapshot } from "@marionette/shared";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { formatTokens, formatDuration, extractFolder } from "../../../lib/utils";
import { useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { STATUS_COLORS } from "../../../lib/status-config";

interface AnalyticsViewProps {
  agents: AgentSnapshot[];
}

const STATUS_CHART_COLORS: Record<string, string> = {
  working: "#10b981",
  starting: "#3b82f6",
  blocked: "#f59e0b",
  error: "#ef4444",
  crashed: "#dc2626",
  idle: "#6b7280",
  finished: "#9ca3af",
  disconnected: "#d1d5db",
};

/**
 * AnalyticsView - Displays analytics with real charts
 * Uses recharts for data visualization
 */
export function AnalyticsView({ agents }: AnalyticsViewProps) {
  const analytics = useMemo(() => {
    const totalRuns = agents.reduce((sum, a) => sum + a.session_runs, 0);
    const totalTokens = agents.reduce((sum, a) => sum + a.session_tokens, 0);
    const totalErrors = agents.reduce((sum, a) => sum + a.session_errors, 0);
    const totalDuration = agents.reduce((sum, a) => sum + a.total_duration_ms, 0);

    const statusDistribution = agents.reduce(
      (acc, agent) => {
        acc[agent.status] = (acc[agent.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const topAgentsByTokens = [...agents]
      .sort((a, b) => b.session_tokens - a.session_tokens)
      .slice(0, 5);

    const topAgentsByRuns = [...agents]
      .sort((a, b) => b.session_runs - a.session_runs)
      .slice(0, 5);

    const errorRate = totalRuns > 0 ? (totalErrors / totalRuns) * 100 : 0;

    // Chart data
    const statusChartData = Object.entries(statusDistribution).map(
      ([status, count]) => ({
        name: STATUS_COLORS[status as keyof typeof STATUS_COLORS]?.label || status,
        value: count,
        color: STATUS_CHART_COLORS[status] || "#6b7280",
      })
    );

    const tokenChartData = topAgentsByTokens.map((agent) => ({
      name:
        agent.metadata?.custom_name ||
        agent.agent_name ||
        extractFolder(agent.cwd),
      tokens: agent.session_tokens,
    }));

    const runsChartData = topAgentsByRuns.map((agent) => ({
      name:
        agent.metadata?.custom_name ||
        agent.agent_name ||
        extractFolder(agent.cwd),
      runs: agent.session_runs,
    }));

    return {
      totalRuns,
      totalTokens,
      totalErrors,
      totalDuration,
      errorRate,
      averageRunsPerAgent: agents.length > 0 ? totalRuns / agents.length : 0,
      averageTokensPerAgent: agents.length > 0 ? totalTokens / agents.length : 0,
      statusChartData,
      tokenChartData,
      runsChartData,
    };
  }, [agents]);

  return (
    <div className="space-y-6 page-transition">
      {/* Overview Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card elevation="low">
          <CardHeader className="pb-2">
            <CardDescription className="text-label">Total Runs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-display-md">{analytics.totalRuns}</div>
            <p className="text-body-sm text-muted-foreground mt-1">
              Avg: {analytics.averageRunsPerAgent.toFixed(1)} per agent
            </p>
          </CardContent>
        </Card>

        <Card elevation="low">
          <CardHeader className="pb-2">
            <CardDescription className="text-label">Total Tokens</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-display-md">
              {formatTokens(analytics.totalTokens)}
            </div>
            <p className="text-body-sm text-muted-foreground mt-1">
              Avg: {formatTokens(analytics.averageTokensPerAgent)} per agent
            </p>
          </CardContent>
        </Card>

        <Card elevation="low">
          <CardHeader className="pb-2">
            <CardDescription className="text-label">Total Errors</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-display-md text-[hsl(var(--error))]">
              {analytics.totalErrors}
            </div>
            <p className="text-body-sm text-muted-foreground mt-1">
              Error rate: {analytics.errorRate.toFixed(1)}%
            </p>
          </CardContent>
        </Card>

        <Card elevation="low">
          <CardHeader className="pb-2">
            <CardDescription className="text-label">Total Duration</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-display-md">
              {formatDuration(analytics.totalDuration)}
            </div>
            <p className="text-body-sm text-muted-foreground mt-1">
              All agents combined
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Status Distribution Pie Chart */}
        <Card elevation="medium" className="col-span-1">
          <CardHeader>
            <CardTitle>Status Distribution</CardTitle>
            <CardDescription>Current status breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={analytics.statusChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) =>
                    `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`
                  }
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {analytics.statusChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Agents by Tokens Bar Chart */}
        <Card elevation="medium" className="col-span-1">
          <CardHeader>
            <CardTitle>Top Agents by Token Usage</CardTitle>
            <CardDescription>Highest token consumers</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.tokenChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  angle={-15}
                  textAnchor="end"
                  height={60}
                />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value) => formatTokens(value as number)}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="tokens" fill="#4a9eff" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Agents by Runs Bar Chart */}
      <Card elevation="medium">
        <CardHeader>
          <CardTitle>Top Agents by Activity</CardTitle>
          <CardDescription>Most active agents by run count</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analytics.runsChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12 }}
                angle={-15}
                textAnchor="end"
                height={60}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
              />
              <Bar dataKey="runs" fill="#10b981" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
