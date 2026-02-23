import type { AgentSnapshot } from "@marionette/shared";
import { FolderOpen, Activity, Moon, AlertTriangle, WifiOff } from "lucide-react";
import { StatCard } from "../../../components/ui/stat-card";
import { useDashboardStats } from "../hooks/useDashboardStats";

interface DashboardStatsProps {
  /** Array of agent snapshots */
  agents: AgentSnapshot[];
}

/**
 * DashboardStats - Displays aggregate agent statistics
 * Shows total agents and counts by status
 * @example
 * <DashboardStats agents={agentList} />
 */
export function DashboardStats({ agents }: DashboardStatsProps) {
  const {
    totalCount,
    workingCount,
    idleCount,
    needsAttentionCount,
    retiredCount,
  } = useDashboardStats(agents);

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
      <StatCard label="Active Agents" value={totalCount} icon={FolderOpen} />
      <StatCard
        label="Working"
        value={workingCount}
        icon={Activity}
        variant="success"
      />
      <StatCard label="Idle" value={idleCount} icon={Moon} />
      <StatCard
        label="Needs Attention"
        value={needsAttentionCount}
        icon={AlertTriangle}
        variant="warning"
      />
      <StatCard
        label="Retired"
        value={retiredCount}
        icon={WifiOff}
      />
    </div>
  );
}
