import type { AgentSnapshot } from "@marionette/shared";
import { useState, useMemo } from "react";
import { AgentCard } from "../../agents/components/AgentCard";
import { EmptyState } from "../../../components/ui/empty-state";
import { Badge } from "../../../components/ui/badge";
import { ChevronDown, FolderOpen, Inbox } from "lucide-react";
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

function getProjectName(cwd?: string | null): string {
  if (!cwd) return "Unknown";
  return cwd.split(/[/\\]/).filter(Boolean).pop() ?? "Unknown";
}

/**
 * GridView - Displays agents grouped by status in a grid layout
 * Features collapsible sections and status badges
 */
export function GridView({ agents, onAgentClick }: GridViewProps) {
  const [groupByProject, setGroupByProject] = useState(false);

  const workingAgents = useMemo(
    () => agents.filter((a) => a.status === "working" || a.status === "starting"),
    [agents]
  );
  const idleAgents = useMemo(
    () => agents.filter((a) => a.status === "idle" || a.status === "finished"),
    [agents]
  );
  const retiredAgents = useMemo(
    () => agents.filter((a) => a.status === "disconnected"),
    [agents]
  );
  const needsAttention = useMemo(
    () => agents.filter((a) => a.status === "error" || a.status === "crashed" || a.status === "blocked" || a.status === "awaiting_input"),
    [agents]
  );

  const projectGroups = useMemo(() => {
    if (!groupByProject) return [];
    const map = new Map<string, AgentSnapshot[]>();
    for (const agent of agents) {
      const project = getProjectName(agent.cwd);
      if (!map.has(project)) map.set(project, []);
      map.get(project)!.push(agent);
    }
    const statusOrder = ["working", "starting", "error", "crashed", "blocked", "idle", "finished", "disconnected"];
    return Array.from(map.entries())
      .sort(([aName, aList], [bName, bList]) => {
        const aWorking = aList.some((a) => a.status === "working" || a.status === "starting") ? 1 : 0;
        const bWorking = bList.some((a) => a.status === "working" || a.status === "starting") ? 1 : 0;
        if (bWorking !== aWorking) return bWorking - aWorking;
        return aName.localeCompare(bName);
      })
      .map(([project, list]) => ({
        project,
        agents: [...list].sort((a, b) =>
          statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status)
        ),
        hasWorking: list.some((a) => a.status === "working" || a.status === "starting"),
      }));
  }, [agents, groupByProject]);

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
      {/* Toggle */}
      <div className="flex justify-end">
        <button
          onClick={() => setGroupByProject((v) => !v)}
          className={cn(
            "flex items-center gap-2 text-sm px-3 py-1.5 rounded-md border transition-colors",
            groupByProject
              ? "border-primary/60 bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:text-foreground hover:border-border/80"
          )}
        >
          <FolderOpen className="h-4 w-4" />
          Group by project
        </button>
      </div>

      {groupByProject ? (
        <>
          {projectGroups.map(({ project, agents: groupAgents, hasWorking }) => (
            <StatusSection
              key={project}
              title={project}
              count={groupAgents.length}
              variant={hasWorking ? "success" : "default"}
              defaultExpanded={true}
            >
              {groupAgents.map((agent, index) => (
                <div key={agent.agent_id} className="stagger-item" style={{ animationDelay: `${index * 0.07}s` }}>
                  <AgentCard agent={agent} onClick={() => onAgentClick(agent)} />
                </div>
              ))}
            </StatusSection>
          ))}
        </>
      ) : (
        <>
          {/* Working Agents */}
          {workingAgents.length > 0 && (
            <StatusSection
              title="Working"
              count={workingAgents.length}
              variant="success"
              defaultExpanded={true}
            >
              {workingAgents.map((agent, index) => (
                <div key={agent.agent_id} className="stagger-item" style={{ animationDelay: `${index * 0.07}s` }}>
                  <AgentCard agent={agent} onClick={() => onAgentClick(agent)} />
                </div>
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
              {needsAttention.map((agent, index) => (
                <div key={agent.agent_id} className="stagger-item" style={{ animationDelay: `${index * 0.07}s` }}>
                  <AgentCard agent={agent} onClick={() => onAgentClick(agent)} />
                </div>
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
              {idleAgents.map((agent, index) => (
                <div key={agent.agent_id} className="stagger-item" style={{ animationDelay: `${index * 0.07}s` }}>
                  <AgentCard agent={agent} onClick={() => onAgentClick(agent)} />
                </div>
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
              {retiredAgents.map((agent, index) => (
                <div key={agent.agent_id} className="stagger-item" style={{ animationDelay: `${index * 0.07}s` }}>
                  <AgentCard agent={agent} onClick={() => onAgentClick(agent)} />
                </div>
              ))}
            </StatusSection>
          )}
        </>
      )}
    </div>
  );
}
