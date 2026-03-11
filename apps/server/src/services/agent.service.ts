import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { MarionetteEvent, AgentSnapshot, AgentStatus } from "@marionette/shared";
import { AgentRepository } from "../repositories/agent.repository.js";
import { MessageTokensRepository } from "../repositories/message-tokens.repository.js";
import { logger } from "../utils/logger.js";

const MARIONETTE_DIR  = join(homedir(), ".marionette");
const EXCLUDED_PATH   = join(MARIONETTE_DIR, "excluded-sessions.json");

function appendExcludedFiles(filePaths: string[]): void {
  if (filePaths.length === 0) return;
  try {
    let existing: string[] = [];
    try { existing = JSON.parse(readFileSync(EXCLUDED_PATH, "utf8")) as string[]; } catch {}
    const merged = [...new Set([...existing, ...filePaths])];
    mkdirSync(MARIONETTE_DIR, { recursive: true });
    writeFileSync(EXCLUDED_PATH, JSON.stringify(merged, null, 2), "utf8");
  } catch (err) {
    logger.warn("Could not update excluded-sessions.json:", err);
  }
}

/**
 * Service class for agent business logic
 * Handles agent lifecycle, counters, and status management
 */
export class AgentService {
  private repository = new AgentRepository();
  private messageTokensRepository = new MessageTokensRepository();

  /**
   * Upsert agent from event
   */
  async upsertAgent(event: MarionetteEvent): Promise<void> {
    if (!event.agent_id) return;

    const isNewSession =
      event.type === "agent.started" || event.type === "conversation.started";

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
    if (event.type === "run.started" && event.run_id) {
      await this.repository.updateCurrentRun(event.agent_id, event.run_id);
    } else if (event.type === "run.ended") {
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
   * Delete crashed/idle/error agents and exclude their source files from future scans.
   */
  async deleteCrashedAgents(): Promise<number> {
    const deleted = await this.repository.deleteCrashed();
    const sourcePaths = deleted.map((d) => d.sourceFile).filter(Boolean) as string[];
    if (sourcePaths.length > 0) appendExcludedFiles(sourcePaths);
    logger.info(`Deleted ${deleted.length} crashed/idle/error agents`);
    return deleted.length;
  }

  /**
   * Delete all agents and exclude all their source files from future scans.
   */
  async deleteAllAgents(): Promise<number> {
    const agents = await this.repository.findAll();
    const sourcePaths = agents
      .map((a) => a.source_file)
      .filter(Boolean) as string[];

    const count = await this.repository.deleteAll();
    await this.messageTokensRepository.deleteAll();
    appendExcludedFiles(sourcePaths);
    logger.info(`Deleted ${count} agent(s)`);
    return count;
  }

  /**
   * Delete a single agent by ID and exclude its source file from future scans.
   */
  async deleteAgent(agentId: string): Promise<number> {
    const agent = await this.repository.findById(agentId);
    const sourceFile = agent?.source_file;

    const count = await this.repository.deleteById(agentId);
    await this.messageTokensRepository.deleteByAgent(agentId);
    if (sourceFile) appendExcludedFiles([sourceFile]);
    return count;
  }

  /**
   * Update agent metadata (custom name, labels, jira tickets, current task, notes, process pid)
   */
  async updateMetadata(
    agentId: string,
    updates: {
      custom_name?: string | null;
      labels?: string[];
      jira_tickets?: string[];
      source_file?: string;
      current_task?: string | null;
      notes?: string | null;
      process_pid?: number | null;
      token_budget?: number | null;
      cost_budget_usd?: number | null;
    }
  ): Promise<Record<string, any>> {
    const agent = await this.repository.findById(agentId);
    if (!agent) {
      logger.warn(`updateMetadata: agent ${agentId} not found yet, skipping`);
      return {};
    }

    const metadata = agent.metadata || {};

    if (updates.custom_name !== undefined) metadata.custom_name = updates.custom_name;
    if (updates.labels !== undefined) metadata.labels = updates.labels;
    if (updates.jira_tickets !== undefined) metadata.jira_tickets = updates.jira_tickets;
    if (updates.notes !== undefined) metadata.notes = updates.notes;
    if (updates.process_pid !== undefined) metadata.process_pid = updates.process_pid;
    if (updates.token_budget !== undefined) metadata.token_budget = updates.token_budget;
    if (updates.cost_budget_usd !== undefined) metadata.cost_budget_usd = updates.cost_budget_usd;

    await this.repository.updateMetadata(agentId, metadata);

    if (updates.source_file !== undefined) {
      await this.repository.updateSourceFile(agentId, updates.source_file ?? null);
    }

    if (updates.current_task !== undefined) {
      await this.repository.updateTask(agentId, updates.current_task as string | null);
    }

    return metadata;
  }
}
