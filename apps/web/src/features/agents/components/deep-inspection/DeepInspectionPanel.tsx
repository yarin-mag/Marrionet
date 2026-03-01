import { useState } from "react";
import { Button } from "../../../../components/ui/button";
import { GlassCard } from "../../../../components/ui/glass-card";
import { ScrollArea } from "../../../../components/ui/scroll-area";
import { Database, Code, Zap, Loader2 } from "lucide-react";
import type { InspectData } from "./types";
import { ContextView } from "./ContextView";
import { MetricsView } from "./MetricsView";
import { RawView } from "./RawView";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8787";

type ViewMode = "context" | "raw" | "metrics";

interface DeepInspectionPanelProps {
  agentId: string;
}

export function DeepInspectionPanel({ agentId }: DeepInspectionPanelProps) {
  const [view, setView] = useState<ViewMode>("context");
  const [data, setData] = useState<InspectData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const executeInspect = async (target?: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/agents/${agentId}/commands`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command: "/inspect",
          args: target ? { target } : undefined,
        }),
      });

      if (!response.ok) throw new Error("Failed to execute inspect command");

      const result = await response.json();
      setData(result.data as InspectData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewChange = (newView: ViewMode) => {
    setView(newView);
    executeInspect(newView === "context" ? "context" : "all");
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button onClick={() => handleViewChange("context")} variant={view === "context" ? "default" : "outline"} size="sm" className="flex items-center gap-2"><Database className="h-4 w-4" />Context</Button>
        <Button onClick={() => handleViewChange("metrics")} variant={view === "metrics" ? "default" : "outline"} size="sm" className="flex items-center gap-2"><Zap      className="h-4 w-4" />Metrics</Button>
        <Button onClick={() => handleViewChange("raw")}     variant={view === "raw"     ? "default" : "outline"} size="sm" className="flex items-center gap-2"><Code     className="h-4 w-4" />Raw</Button>
      </div>

      <GlassCard className="p-4">
        <ScrollArea className="h-[500px]">
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground">Inspecting agent...</p>
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {!isLoading && !error && data && (
            <div className="space-y-4">
              {view === "context"  && <ContextView  data={data} />}
              {view === "metrics"  && <MetricsView  data={data} />}
              {view === "raw"      && <RawView      data={data} />}
            </div>
          )}

          {!isLoading && !error && !data && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <Database className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">Click a tab above to inspect the agent</p>
            </div>
          )}
        </ScrollArea>
      </GlassCard>
    </div>
  );
}
