import type { AgentSnapshot, AgentStatus } from "@marionette/shared";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { formatTokens, extractFolder } from "../../../lib/utils";

interface KanbanViewProps {
  agents: AgentSnapshot[];
  onAgentClick: (agent: AgentSnapshot) => void;
}

const statusColumns: Array<{
  status: AgentStatus[];
  title: string;
  color: string;
}> = [
  {
    status: ["starting"],
    title: "Starting",
    color: "border-l-blue-500",
  },
  {
    status: ["working"],
    title: "Working",
    color: "border-l-green-500",
  },
  {
    status: ["blocked"],
    title: "Blocked",
    color: "border-l-yellow-500",
  },
  {
    status: ["idle"],
    title: "Idle",
    color: "border-l-gray-500",
  },
  {
    status: ["error", "crashed"],
    title: "Needs Attention",
    color: "border-l-red-500",
  },
  {
    status: ["finished", "disconnected"],
    title: "Finished",
    color: "border-l-gray-400",
  },
];

export function KanbanView({ agents, onAgentClick }: KanbanViewProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {statusColumns.map((column) => {
        const columnAgents = agents.filter((a) =>
          column.status.includes(a.status)
        );

        return (
          <div key={column.title} className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">{column.title}</h3>
              <Badge variant="outline" className="text-xs">
                {columnAgents.length}
              </Badge>
            </div>

            <div className="space-y-2 min-h-[200px]">
              {columnAgents.map((agent) => (
                <Card
                  key={agent.agent_id}
                  className={`cursor-pointer hover:shadow-md transition-all border-l-4 ${column.color}`}
                  onClick={() => onAgentClick(agent)}
                >
                  <CardHeader className="p-3 pb-2">
                    <CardTitle className="text-sm font-medium truncate">
                      {agent.agent_name || "Unnamed Agent"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0 space-y-2">
                    {agent.current_task && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {agent.current_task}
                      </p>
                    )}

                    <div className="text-xs text-muted-foreground">
                      📁 {extractFolder(agent.cwd || "")}
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {agent.session_runs} runs
                      </span>
                      <span className="text-muted-foreground">
                        {formatTokens(agent.session_tokens)}
                      </span>
                    </div>

                    {agent.session_errors > 0 && (
                      <div className="text-xs text-destructive font-medium">
                        ⚠️ {agent.session_errors} errors
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}

              {columnAgents.length === 0 && (
                <div className="text-center text-muted-foreground text-xs py-8">
                  No agents
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
