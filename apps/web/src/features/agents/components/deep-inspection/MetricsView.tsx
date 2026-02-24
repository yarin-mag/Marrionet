import type { MetricsData } from "./types";
import { MetricCard } from "./MetricCard";

interface MetricsViewProps {
  data: { metrics?: MetricsData };
}

export function MetricsView({ data }: MetricsViewProps) {
  const metrics = data.metrics ?? ({} as MetricsData);

  return (
    <div className="grid grid-cols-2 gap-4">
      <MetricCard label="Runs"         value={metrics.runs     ?? 0} />
      <MetricCard label="Tasks"        value={metrics.tasks    ?? 0} />
      <MetricCard label="Errors"       value={metrics.errors   ?? 0} />
      <MetricCard label="Tokens"       value={metrics.tokens   ?? 0} />
      <MetricCard label="Duration"     value={`${Math.round((metrics.duration    ?? 0) / 1000)}s`} />
      <MetricCard label="Avg Duration" value={`${Math.round((metrics.avgDuration ?? 0) / 1000)}s`} />
    </div>
  );
}
