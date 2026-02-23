import type { MarionetteEvent, AgentSnapshot, AgentStatus } from "@marionette/shared";
import { AgentRepository } from "../repositories/agent.repository.js";
import { logger } from "../utils/logger.js";
import { config } from "../config/index.js";

/**
 * Service class for agent business logic
 * Handles agent lifecycle, counters, and status management
 */
export class AgentService {
  private repository = new AgentRepository();

  /**
   * Upsert agent from event
   */
  async upsertAgent(event: MarionetteEvent): Promise<void> {
    if (!event.agent_id) return;

    const isNewSession = event.type === "agent.started";

    if (isNewSession) {
      await this.repository.upsertForNewSession(event);
    } else {
      await this.repository.upsertForExistingSession(event);
    }
  }

  /**
   * Update agent activity timestamp and optionally status
   */
  async updateActivity(agentId: string, status?: AgentStatus): Promise<void> {
    if (status) {
      await this.repository.updateStatus(agentId, status);
    } else {
      await this.repository.updateActivity(agentId);
    }
  }

  /**
   * Increment agent counters based on event type
   */
  async incrementCounters(event: MarionetteEvent): Promise<void> {
    if (!event.agent_id) return;

    const tokens = event.tokens
      ? (event.tokens.total_tokens ?? (event.tokens.input_tokens ?? 0) + (event.tokens.output_tokens ?? 0))
      : 0;
    const duration = event.duration_ms ?? 0;

    // Increment event-type specific counters
    if (event.type === "run.started") {
      await this.repository.incrementRuns(event.agent_id);
    } else if (event.type === "task.started") {
      await this.repository.incrementTasks(event.agent_id);
    } else if (event.type === "log.error") {
      await this.repository.incrementErrors(event.agent_id);
    }

    // Always update tokens and duration if present
    if (tokens > 0 || duration > 0) {
      await this.repository.incrementTokensAndDuration(event.agent_id, tokens, duration);
    }
  }

  /**
   * Get all agents, optionally filtered by status
   */
  async getAgents(statusFilter?: AgentStatus): Promise<AgentSnapshot[]> {
    return this.repository.findAll(statusFilter);
  }

  /**
   * Get a single agent by ID
   */
  async getAgent(agentId: string): Promise<AgentSnapshot | null> {
    return this.repository.findById(agentId);
  }

  /**
   * Mark inactive agents as idle
   */
  async markIdleAgents(): Promise<number> {
    const count = await this.repository.markIdle(config.websocket.idleTimeoutMinutes);
    if (count > 0) {
      logger.info(`Marked ${count} agent(s) as idle`);
    }
    return count;
  }

  /**
   * Delete crashed/idle/error agents
   */
  async deleteCrashedAgents(): Promise<number> {
    const count = await this.repository.deleteCrashed();
    logger.info(`Deleted ${count} crashed agent(s)`);
    return count;
  }

  /**
   * Delete all agents
   */
  async deleteAllAgents(): Promise<number> {
    const count = await this.repository.deleteAll();
    logger.info(`Deleted ${count} agent(s)`);
    return count;
  }

  /**
   * Update agent metadata (custom name, labels, jira tickets)
   */
  async updateMetadata(
    agentId: string,
    updates: {
      custom_name?: string | null;
      labels?: string[];
      jira_tickets?: string[];
    }
  ): Promise<Record<string, any>> {
    const agent = await this.repository.findById(agentId);
    if (!agent) {
      throw new Error("Agent not found");
    }

    const metadata = agent.metadata || {};

    // Apply updates
    if (updates.custom_name !== undefined) {
      metadata.custom_name = updates.custom_name;
    }
    if (updates.labels !== undefined) {
      metadata.labels = updates.labels;
    }
    if (updates.jira_tickets !== undefined) {
      metadata.jira_tickets = updates.jira_tickets;
    }

    await this.repository.updateMetadata(agentId, metadata);
    return metadata;
  }

  /**
   * Update agent status by various criteria
   * Returns the updated agent_id or null if no agent was updated
   */
  async updateStatusByCriteria(
    criteria: {
      agentId?: string;
      terminal?: string;
      cwd?: string;
    },
    status: AgentStatus
  ): Promise<{ agentId: string | null; rowCount: number }> {
    const { agentId, terminal, cwd } = criteria;

    let rowCount = 0;
    let updatedAgentId: string | null = null;

    // Try to update by agent_id first
    if (agentId) {
      rowCount = await this.repository.updateStatus(agentId, status);
      if (rowCount > 0) {
        updatedAgentId = agentId;
      }
    }
    // Try terminal AND cwd
    else if (terminal && cwd) {
      rowCount = await this.repository.updateByTerminalAndCwd(terminal, cwd, status);
      if (rowCount > 0) {
        const agent = await this.repository.findByTerminalAndCwd(terminal, cwd);
        updatedAgentId = agent?.agent_id ?? null;
      }
    }
    // Fallback: terminal only
    else if (terminal) {
      rowCount = await this.repository.updateByTerminal(terminal, status);
      if (rowCount > 0) {
        const agent = await this.repository.findByTerminal(terminal);
        updatedAgentId = agent?.agent_id ?? null;
      }
    }
    // Fallback: cwd only
    else if (cwd) {
      rowCount = await this.repository.updateByCwd(cwd, status);
      if (rowCount > 0) {
        const agent = await this.repository.findByCwd(cwd);
        updatedAgentId = agent?.agent_id ?? null;
      }
    }
    // Last resort: most recent agent
    else {
      rowCount = await this.repository.updateMostRecent(status);
      if (rowCount > 0) {
        const agent = await this.repository.findMostRecent();
        updatedAgentId = agent?.agent_id ?? null;
      }
    }

    return { agentId: updatedAgentId, rowCount };
  }

  /**
   * Create a new agent if none exists
   */
  async createAgentIfNotExists(
    terminal?: string,
    cwd?: string,
    status: AgentStatus = "working"
  ): Promise<string> {
    // Generate agent ID from terminal + cwd
    const agentId = `agent_${terminal}_${cwd}`
      .replace(/[^a-zA-Z0-9_]/g, "_")
      .substring(0, 50);

    await this.repository.create(agentId, "Claude Agent", status, terminal, cwd);
    logger.info(`Created new agent ${agentId}`);

    return agentId;
  }
}
