import type { ContextData } from "./types";

interface ContextViewProps {
  data: { context?: ContextData };
}

export function ContextView({ data }: ContextViewProps) {
  const context = data.context ?? ({} as ContextData);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold mb-2">Agent Info</h3>
        <div className="rounded-lg bg-muted/50 p-3 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">ID:</span>
            <span className="font-mono">{context.agent?.id}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Name:</span>
            <span>{context.agent?.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Status:</span>
            <span>{context.agent?.status}</span>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-2">Environment</h3>
        <div className="rounded-lg bg-muted/50 p-3 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">CWD:</span>
            <span className="font-mono text-xs">{context.agent?.cwd}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Terminal:</span>
            <span className="font-mono text-xs">{context.agent?.terminal}</span>
          </div>
        </div>
      </div>

      {context.currentTask && (
        <div>
          <h3 className="text-sm font-semibold mb-2">Current Task</h3>
          <div className="rounded-lg bg-muted/50 p-3 text-sm">{context.currentTask}</div>
        </div>
      )}
    </div>
  );
}
