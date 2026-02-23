import { AgentService } from "../services/agent.service.js";
import type { AgentStatus } from "@marionette/shared";
import { logger } from "../utils/logger.js";

interface MatchCriteria {
  agentId?: string;
  terminal?: string;
  cwd?: string;
  status: AgentStatus;
}

/**
 * Strategy pattern for agent matching
 * Eliminates nested if-else chains by using a chain of responsibility
 */
export class AgentMatcher {
  private agentService = new AgentService();

  /**
   * Find or create an agent based on provided criteria
   * Returns the agent ID and whether it was newly created
   */
  async findOrCreate(
    criteria: MatchCriteria
  ): Promise<{ agentId: string; created: boolean; rowCount: number }> {
    const { agentId, terminal, cwd, status } = criteria;

    // Try to update existing agent
    const updateResult = await this.agentService.updateStatusByCriteria(
      { agentId, terminal, cwd },
      status
    );

    if (updateResult.rowCount > 0 && updateResult.agentId) {
      logger.info(`Updated agent ${updateResult.agentId} to status "${status}"`);
      return {
        agentId: updateResult.agentId,
        created: false,
        rowCount: updateResult.rowCount,
      };
    }

    // No agent found - create a new one if we have terminal or cwd
    if (terminal || cwd) {
      logger.info(`No agents matched, creating new agent (terminal=${terminal}, cwd=${cwd})`);
      const newAgentId = await this.agentService.createAgentIfNotExists(terminal, cwd, status);
      return {
        agentId: newAgentId,
        created: true,
        rowCount: 1,
      };
    }

    // No criteria to create a new agent
    logger.warn("No agents matched and insufficient criteria to create new agent");
    return {
      agentId: "",
      created: false,
      rowCount: 0,
    };
  }
}
