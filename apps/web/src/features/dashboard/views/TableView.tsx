import type { AgentSnapshot } from "@marionette/shared";
import { Badge } from "../../../components/ui/badge";
import { EmptyState } from "../../../components/ui/empty-state";
import { formatTime, formatTokens, extractFolder, cn } from "../../../lib/utils";
import { STATUS_COLORS } from "../../../lib/status-config";
import { FolderOpen, Inbox } from "lucide-react";

interface TableViewProps {
  agents: AgentSnapshot[];
  onAgentClick: (agent: AgentSnapshot) => void;
}

/**
 * TableView - Displays agents in a data table format
 * Features alternating rows, sticky header, and status colors
 */
export function TableView({ agents, onAgentClick }: TableViewProps) {
  if (agents.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="No agents found"
        description="Start monitoring agents to see them appear here"
      />
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-accent/50 border-b border-border sticky top-0 z-10">
            <tr>
              <th className="px-6 py-4 text-left text-label text-muted-foreground">
                Agent
              </th>
              <th className="px-4 py-4 text-left text-label text-muted-foreground">
                Status
              </th>
              <th className="px-4 py-4 text-left text-label text-muted-foreground">
                Task
              </th>
              <th className="px-4 py-4 text-left text-label text-muted-foreground">
                Location
              </th>
              <th className="px-4 py-4 text-right text-label text-muted-foreground">
                Runs
              </th>
              <th className="px-4 py-4 text-right text-label text-muted-foreground">
                Tokens
              </th>
              <th className="px-4 py-4 text-right text-label text-muted-foreground">
                Errors
              </th>
              <th className="px-6 py-4 text-right text-label text-muted-foreground">
                Last Active
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {agents.map((agent, index) => {
              const statusConfig = STATUS_COLORS[agent.status];
              const displayName =
                (agent.metadata?.custom_name as string | undefined) ||
                agent.agent_name ||
                extractFolder(agent.cwd);

              return (
                <tr
                  key={agent.agent_id}
                  onClick={() => onAgentClick(agent)}
                  className={cn(
                    "cursor-pointer transition-colors hover:bg-accent/30",
                    index % 2 === 0 ? "bg-background" : "bg-accent/10"
                  )}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                        <FolderOpen className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <div className="font-medium text-foreground">
                          {displayName}
                        </div>
                        {(agent.metadata?.custom_name as string | undefined) && agent.agent_name && (
                          <div className="text-xs text-muted-foreground">
                            {agent.agent_name}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <Badge
                      variant={statusConfig.badge}
                      size="sm"
                      showDot={agent.status === "working"}
                    >
                      {statusConfig.label}
                    </Badge>
                  </td>
                  <td className="px-4 py-4">
                    <div className="max-w-[300px] truncate text-sm">
                      {agent.current_task || (
                        <span className="text-muted-foreground italic">
                          No active task
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-sm">{extractFolder(agent.cwd || "")}</div>
                    <div className="text-xs text-muted-foreground">
                      {agent.terminal}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right font-medium">
                    {agent.session_runs}
                  </td>
                  <td className="px-4 py-4 text-right font-medium">
                    {formatTokens(agent.session_tokens)}
                  </td>
                  <td className="px-4 py-4 text-right">
                    {agent.session_errors > 0 ? (
                      <span className="text-[hsl(var(--error))] font-semibold">
                        {agent.session_errors}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-muted-foreground">
                    {formatTime(agent.last_activity)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
