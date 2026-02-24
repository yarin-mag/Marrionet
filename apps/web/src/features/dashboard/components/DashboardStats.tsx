import type { AgentSnapshot } from "@marionette/shared";
import { FolderOpen, Activity, Moon, AlertTriangle, WifiOff } from "lucide-react";
import { FancyStatCard } from "../../../components/ui/fancy-stat-card";
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
      <FancyStatCard
        label="Active Agents"
        value={totalCount}
        icon={FolderOpen}
        gradient="from-blue-500 to-blue-600"
        animated
      />
      <FancyStatCard
        label="Working"
        value={workingCount}
        icon={Activity}
        gradient="from-green-500 to-emerald-600"
        animated
      />
      <FancyStatCard
        label="Idle"
        value={idleCount}
        icon={Moon}
        gradient="from-slate-400 to-slate-500"
        animated
      />
      <FancyStatCard
        label="Needs Attention"
        value={needsAttentionCount}
        icon={AlertTriangle}
        gradient="from-orange-500 to-amber-500"
        animated
      />
      <FancyStatCard
        label="Retired"
        value={retiredCount}
        icon={WifiOff}
        gradient="from-slate-500 to-slate-600"
        animated
      />
    </div>
  );
}
