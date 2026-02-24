import type { ThinkingStep } from "./types";

interface ThinkingViewProps {
  data: { thinking?: ThinkingStep[] };
}

export function ThinkingView({ data }: ThinkingViewProps) {
  const thinking = data.thinking ?? [];

  if (thinking.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        No thinking steps recorded yet
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {thinking.map((step) => (
        <div
          key={`${step.type}_${step.timestamp}`}
          className="rounded-lg bg-muted/50 p-3 text-sm"
        >
          <div className="flex items-start justify-between mb-1">
            <span className="font-medium">{step.type}</span>
            {step.duration != null && (
              <span className="text-xs text-muted-foreground">{step.duration}ms</span>
            )}
          </div>
          <p className="text-muted-foreground">{step.summary}</p>
        </div>
      ))}
    </div>
  );
}
