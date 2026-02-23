import { useState } from 'react';
import { Button } from '../../../components/ui/button';
import { GlassCard } from '../../../components/ui/glass-card';
import { ScrollArea } from '../../../components/ui/scroll-area';
import { Brain, Database, Code, Zap, Loader2 } from 'lucide-react';
import { cn } from '../../../lib/utils';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface DeepInspectionPanelProps {
  agentId: string;
}

type ViewMode = 'thinking' | 'context' | 'raw' | 'metrics';

export function DeepInspectionPanel({ agentId }: DeepInspectionPanelProps) {
  const [view, setView] = useState<ViewMode>('context');
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Execute /inspect command
   */
  const executeInspect = async (target?: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/agents/${agentId}/commands`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          command: '/inspect',
          args: target ? { target } : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to execute inspect command');
      }

      const result = await response.json();
      setData(result.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Load data on view change
   */
  const handleViewChange = (newView: ViewMode) => {
    setView(newView);
    executeInspect(newView === 'thinking' ? 'thinking' : newView === 'context' ? 'context' : 'all');
  };

  return (
    <div className="space-y-4">
      {/* View Tabs */}
      <div className="flex gap-2">
        <Button
          onClick={() => handleViewChange('context')}
          variant={view === 'context' ? 'default' : 'outline'}
          size="sm"
          className="flex items-center gap-2"
        >
          <Database className="h-4 w-4" />
          Context
        </Button>
        <Button
          onClick={() => handleViewChange('thinking')}
          variant={view === 'thinking' ? 'default' : 'outline'}
          size="sm"
          className="flex items-center gap-2"
        >
          <Brain className="h-4 w-4" />
          Thinking
        </Button>
        <Button
          onClick={() => handleViewChange('metrics')}
          variant={view === 'metrics' ? 'default' : 'outline'}
          size="sm"
          className="flex items-center gap-2"
        >
          <Zap className="h-4 w-4" />
          Metrics
        </Button>
        <Button
          onClick={() => handleViewChange('raw')}
          variant={view === 'raw' ? 'default' : 'outline'}
          size="sm"
          className="flex items-center gap-2"
        >
          <Code className="h-4 w-4" />
          Raw
        </Button>
      </div>

      {/* Content Area */}
      <GlassCard className="p-4">
        <ScrollArea className="h-[500px]">
          {/* Loading State */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground">Inspecting agent...</p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Data Display */}
          {!isLoading && !error && data && (
            <div className="space-y-4">
              {view === 'context' && <ContextView data={data} />}
              {view === 'thinking' && <ThinkingView data={data} />}
              {view === 'metrics' && <MetricsView data={data} />}
              {view === 'raw' && <RawView data={data} />}
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !error && !data && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <Database className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                Click a tab above to inspect the agent
              </p>
            </div>
          )}
        </ScrollArea>
      </GlassCard>
    </div>
  );
}

/**
 * Context View Component
 */
function ContextView({ data }: { data: any }) {
  const context = data.context || {};

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
          <div className="rounded-lg bg-muted/50 p-3 text-sm">
            {context.currentTask}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Thinking View Component
 */
function ThinkingView({ data }: { data: any }) {
  const thinking = data.thinking || [];

  if (thinking.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        No thinking steps recorded yet
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {thinking.map((step: any, index: number) => (
        <div key={index} className="rounded-lg bg-muted/50 p-3 text-sm">
          <div className="flex items-start justify-between mb-1">
            <span className="font-medium">{step.type}</span>
            {step.duration && (
              <span className="text-xs text-muted-foreground">{step.duration}ms</span>
            )}
          </div>
          <p className="text-muted-foreground">{step.summary}</p>
        </div>
      ))}
    </div>
  );
}

/**
 * Metrics View Component
 */
function MetricsView({ data }: { data: any }) {
  const metrics = data.metrics || {};

  return (
    <div className="grid grid-cols-2 gap-4">
      <MetricCard label="Runs" value={metrics.runs || 0} />
      <MetricCard label="Tasks" value={metrics.tasks || 0} />
      <MetricCard label="Errors" value={metrics.errors || 0} />
      <MetricCard label="Tokens" value={metrics.tokens || 0} />
      <MetricCard label="Duration" value={`${Math.round((metrics.duration || 0) / 1000)}s`} />
      <MetricCard label="Avg Duration" value={`${Math.round((metrics.avgDuration || 0) / 1000)}s`} />
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-muted/50 p-4 text-center">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

/**
 * Raw View Component
 */
function RawView({ data }: { data: any }) {
  return (
    <pre className="text-xs bg-muted/50 p-4 rounded-lg overflow-x-auto border">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}
