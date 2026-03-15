import type { MarionetteEvent, AgentStatus, MessageTokenEntry } from "@marionette/shared";
import { EventRepository } from "../repositories/event.repository.js";
import { MessageTokensRepository } from "../repositories/message-tokens.repository.js";
import { AgentService } from "./agent.service.js";
import { NotificationService } from "./notification.service.js";
import { DatabaseClient } from "../db.js";
import { logger } from "../utils/logger.js";

const VALID_AGENT_STATUSES = new Set<string>([
  'starting', 'idle', 'working', 'blocked', 'error',
  'finished', 'crashed', 'disconnected', 'awaiting_input'
]);

export interface BatchResult {
  processed: MarionetteEvent[];
  failed: Array<{ event: MarionetteEvent; error: string }>;
}

/**
 * Service class for event processing
 * Handles event ingestion, processing, and querying
 */
export class EventService {
  private repository = new EventRepository();
  private messageTokensRepository = new MessageTokensRepository();
  private agentService: AgentService;
  private notificationService = new NotificationService();

  constructor(agentService?: AgentService) {
    this.agentService = agentService ?? new AgentService();
  }

  /**
   * Process a single event
   */
  async processEvent(event: MarionetteEvent): Promise<void> {
    if (!event.type) {
      logger.debug("Skipping event: missing type", { event });
      return;
    }

    // Agent lifecycle events (agent.started, agent.heartbeat, conversation.started, etc.)
    // may not carry run_id / summary — only enforce those checks for non-lifecycle events
    const isLifecycleEvent =
      event.type.startsWith('agent.') || event.type === 'conversation.started';
    if (!isLifecycleEvent && (!event.run_id || !event.summary)) {
      logger.debug("Skipping non-lifecycle event: missing run_id or summary", {
        type: event.type,
        run_id: event.run_id,
        has_summary: !!event.summary,
      });
      return;
    }

    // Ensure timestamp is set (use a local var — do not mutate the caller's object)
    const ts = event.ts ?? new Date().toISOString();

    // Handle blocked agent resuming — build a shadow event rather than mutating the caller's object
    const effectiveEvent = await this.resolveEffectiveEvent(event);

    if (effectiveEvent.agent_id) {
      // Update agent records
      // Only pass status if it's a valid AgentStatus — task events use "completed" etc. which aren't
      const agentStatus = effectiveEvent.status && VALID_AGENT_STATUSES.has(effectiveEvent.status)
        ? effectiveEvent.status as AgentStatus
        : undefined;
      await this.agentService.upsertAgent(effectiveEvent);
      await this.agentService.updateActivity(effectiveEvent.agent_id, agentStatus);
      await this.agentService.incrementCounters(effectiveEvent);
    }

    // Insert event into database
    await this.repository.insert({ ...effectiveEvent, ts });

    // Fire Discord notification for terminal statuses (fire-and-forget).
    if (effectiveEvent.agent_id && effectiveEvent.status) {
      this.agentService.getAgent(effectiveEvent.agent_id).then((agent) => {
        if (agent && !agent.is_subagent && !agent.parent_agent_id) {
          this.notificationService.notifyAgentStatus(agent, effectiveEvent);
        }
      }).catch(() => {});
    }

    // For llm.call events from the proxy, persist the per-message token breakdown
    if (
      effectiveEvent.type === "llm.call" &&
      effectiveEvent.agent_id &&
      effectiveEvent.run_id &&
      Array.isArray(effectiveEvent.payload?.message_tokens) &&
      (effectiveEvent.payload.message_tokens as MessageTokenEntry[]).length > 0
    ) {
      const model = effectiveEvent.payload.model as string | undefined;
      await this.messageTokensRepository.insertBatch(
        effectiveEvent.agent_id,
        effectiveEvent.run_id,
        ts,
        model,
        effectiveEvent.payload.message_tokens as MessageTokenEntry[]
      );
    }
  }

  /**
   * Resolve the effective event, auto-resuming a blocked agent when a new event arrives
   * without an explicit status. Extracted from processEvent to avoid an inline async IIFE.
   */
  private async resolveEffectiveEvent(event: MarionetteEvent): Promise<MarionetteEvent> {
    if (!event.agent_id) return event;
    const agent = await DatabaseClient.queryOne<{ status: string }>(
      "SELECT status FROM agents WHERE agent_id = $1",
      [event.agent_id]
    );
    return agent?.status === "blocked" && !event.status
      ? { ...event, status: "working" as AgentStatus }
      : event;
  }

  /**
   * Process a batch of events
   */
  async processBatch(events: MarionetteEvent[]): Promise<BatchResult> {
    const sorted = [...events].sort((a, b) => {
      // agent.started must be processed before any status events in the same batch
      // so that is_subagent is set before notification checks run. This matters because
      // agent.started falls back to new Date() when the JSONL entry has no timestamp,
      // which can sort it AFTER historical entries (turn_duration etc.) in the same file.
      if (a.type === 'agent.started' && b.type !== 'agent.started') return -1;
      if (a.type !== 'agent.started' && b.type === 'agent.started') return 1;
      const ta = a.ts ?? "";
      const tb = b.ts ?? "";
      return ta < tb ? -1 : ta > tb ? 1 : 0;
    });

    const processed: MarionetteEvent[] = [];
    const failed: Array<{ event: MarionetteEvent; error: string }> = [];

    for (const event of sorted) {
      try {
        await this.processEvent(event);
        processed.push(event);
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        logger.error("Error processing event:", { err, type: event.type, run_id: event.run_id });
        failed.push({ event, error });
      }
    }

    return { processed, failed };
  }

  /**
   * Get events by agent ID
   */
  async getEventsByAgentId(agentId: string, limit: number = 100): Promise<MarionetteEvent[]> {
    return this.repository.findByAgentId(agentId, limit);
  }

  /**
   * Get recent events
   */
  async getRecentEvents(limit: number = 100): Promise<MarionetteEvent[]> {
    return this.repository.findRecent(limit);
  }

  /**
   * Query events with filters
   */
  async queryEvents(filters: {
    runId?: string;
    agentId?: string;
    type?: string;
    limit?: number;
  }): Promise<MarionetteEvent[]> {
    return this.repository.findWithFilters(filters);
  }
}
