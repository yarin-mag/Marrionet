import type { AgentSnapshot } from "@marionette/shared";
import { useState } from "react";
import { AgentCard } from "../../agents/components/AgentCard";
import { EmptyState } from "../../../components/ui/empty-state";
import { Badge } from "../../../components/ui/badge";
import { ChevronDown, Inbox } from "lucide-react";
import { cn } from "../../../lib/utils";

interface GridViewProps {
  agents: AgentSnapshot[];
  onAgentClick: (agent: AgentSnapshot) => void;
}

interface StatusSectionProps {
  title: string;
  count: number;
  variant?: "success" | "warning" | "error" | "default";
  defaultExpanded?: boolean;
  children: React.ReactNode;
}

/**
 * StatusSection - Collapsible section for grouped agents
 */
function StatusSection({
  title,
  count,
  variant = "default",
  defaultExpanded = true,
  children,
}: StatusSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="space-y-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full group"
      >
        <div className="flex items-center gap-3">
          <h2 className="text-heading-md">{title}</h2>
          <Badge variant={variant} size="md">
            {count}
          </Badge>
        </div>
        <ChevronDown
          className={cn(
            "h-5 w-5 text-muted-foreground transition-transform duration-200",
            isExpanded && "rotate-180"
          )}
        />
      </button>
      {isExpanded && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * GridView - Displays agents grouped by status in a grid layout
 * Features collapsible sections and status badges
 */
export function GridView({ agents, onAgentClick }: GridViewProps) {
  const workingAgents = agents.filter(
    (a) => a.status === "working" || a.status === "starting"
  );
  const idleAgents = agents.filter(
    (a) => a.status === "idle" || a.status === "finished"
  );
  const retiredAgents = agents.filter((a) => a.status === "disconnected");
  const needsAttention = agents.filter(
    (a) =>
      a.status === "error" ||
      a.status === "crashed" ||
      a.status === "blocked"
  );

  if (agents.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="No agents detected"
        description="Start a Claude Code agent with Marionette MCP server configured to see it here"
      />
    );
  }

  return (
    <div className="space-y-8 page-transition">
      {/* Working Agents */}
      {workingAgents.length > 0 && (
        <StatusSection
          title="Working"
          count={workingAgents.length}
          variant="success"
          defaultExpanded={true}
        >
          {workingAgents.map((agent) => (
            <AgentCard
              key={agent.agent_id}
              agent={agent}
              onClick={() => onAgentClick(agent)}
            />
          ))}
        </StatusSection>
      )}

      {/* Needs Attention */}
      {needsAttention.length > 0 && (
        <StatusSection
          title="Needs Attention"
          count={needsAttention.length}
          variant="error"
          defaultExpanded={true}
        >
          {needsAttention.map((agent) => (
            <AgentCard
              key={agent.agent_id}
              agent={agent}
              onClick={() => onAgentClick(agent)}
            />
          ))}
        </StatusSection>
      )}

      {/* Idle Agents */}
      {idleAgents.length > 0 && (
        <StatusSection
          title="Idle"
          count={idleAgents.length}
          variant="default"
          defaultExpanded={true}
        >
          {idleAgents.map((agent) => (
            <AgentCard
              key={agent.agent_id}
              agent={agent}
              onClick={() => onAgentClick(agent)}
            />
          ))}
        </StatusSection>
      )}

      {/* Retired Agents (disconnected — collapsed by default) */}
      {retiredAgents.length > 0 && (
        <StatusSection
          title="Retired"
          count={retiredAgents.length}
          variant="default"
          defaultExpanded={false}
        >
          {retiredAgents.map((agent) => (
            <AgentCard
              key={agent.agent_id}
              agent={agent}
              onClick={() => onAgentClick(agent)}
            />
          ))}
        </StatusSection>
      )}
    </div>
  );
}
