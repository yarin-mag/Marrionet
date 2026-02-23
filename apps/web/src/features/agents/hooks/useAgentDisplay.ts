import type { AgentSnapshot } from "@marionette/shared";
import { STATUS_COLORS, type StatusConfig } from "../../../lib/status-config";
import { getAgentName } from "../../../lib/agent-names";

/**
 * Agent display information
 */
export interface AgentDisplayInfo {
  /** Display name (priority: custom_name > agent_name > folder) */
  displayName: string;
  /** Whether a custom name is set */
  hasCustomName: boolean;
  /** Status configuration for styling */
  statusConfig: StatusConfig;
  /** Extracted folder name from cwd */
  folder: string;
  /** Whether agent is disconnected */
  isDisconnected: boolean;
}

/**
 * useAgentDisplay hook - Extracts display logic for agent cards/panels
 * Computes display name, status config, and flags
 * @param agent - Agent snapshot data
 * @returns Display information for rendering
 * @example
 * const { displayName, statusConfig, isDisconnected } = useAgentDisplay(agent);
 */
export function useAgentDisplay(agent: AgentSnapshot): AgentDisplayInfo {
  const folder = agent.cwd?.split(/[/\\]/).filter(Boolean).pop() ?? "unknown";
  const displayName = (agent.metadata?.custom_name as string | undefined)
    || agent.agent_name
    || getAgentName(agent.agent_id);
  const hasCustomName = !!agent.metadata?.custom_name;
  const statusConfig = STATUS_COLORS[agent.status] || STATUS_COLORS.idle;
  const isDisconnected = agent.status === "disconnected";

  return {
    displayName,
    hasCustomName,
    statusConfig,
    folder,
    isDisconnected,
  };
}
