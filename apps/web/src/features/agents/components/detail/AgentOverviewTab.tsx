import type { AgentSnapshot } from "@marionette/shared";
import { GlassCard } from "../../../../components/ui/glass-card";
import { useAgentLlmCalls } from "../../hooks/useAgentLlmCalls";
import { useAgentRuns } from "../../hooks/useAgentRuns";
import { useNow } from "../../../../hooks/use-live-timer";
import { useAgentsStore } from "../../stores/agents.store";
import { useShallow } from "zustand/react/shallow";
import {
  OverviewCurrentTask,
  OverviewStats,
  OverviewEnvironment,
  OverviewActivity,
  OverviewRunHistory,
  OverviewSubAgents,
} from "./overview";

interface AgentOverviewTabProps {
  agent: AgentSnapshot;
}

export function AgentOverviewTab({ agent }: AgentOverviewTabProps) {
  const { stats: llmStats } = useAgentLlmCalls(agent.agent_id);
  const { runs } = useAgentRuns(agent.agent_id);
  const now = useNow();
  const children = useAgentsStore(useShallow((s) => s.agents.filter(a => a.parent_agent_id === agent.agent_id)));

  return (
    <div className="space-y-4">
      <OverviewCurrentTask
        task={agent.current_task}
        status={agent.status}
        statusSince={agent.status_since}
      />
      <OverviewStats agent={agent} />
      <OverviewEnvironment agent={agent} lastModel={llmStats.lastModel ?? undefined} />
      <OverviewActivity agent={agent} now={now} />
      {agent.metadata && typeof agent.metadata === 'object' && Object.keys(agent.metadata).length > 0 && (
        <GlassCard className="p-4">
          <h3 className="font-semibold mb-2">Metadata</h3>
          <pre className="text-xs bg-muted/50 p-3 rounded overflow-x-auto border">
            {JSON.stringify(agent.metadata, null, 2)}
          </pre>
        </GlassCard>
      )}
      <OverviewRunHistory runs={runs} />
      <OverviewSubAgents children={children} />
    </div>
  );
}
