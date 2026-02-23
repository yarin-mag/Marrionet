import type { MarionetteEvent } from "@marionette/shared";
import { EventRepository } from "../repositories/event.repository.js";
import { AgentService } from "./agent.service.js";
import { queryOne } from "../db.js";

/**
 * Service class for event processing
 * Handles event ingestion, processing, and querying
 */
export class EventService {
  private repository = new EventRepository();
  private agentService = new AgentService();

  /**
   * Process a single event
   */
  async processEvent(event: MarionetteEvent): Promise<void> {
    if (!event.type) {
      return; // Skip events with no type
    }

    // Agent lifecycle events (agent.started, agent.heartbeat, etc.) don't carry
    // run_id / summary — only enforce those checks for non-lifecycle events
    const isLifecycleEvent = event.type.startsWith('agent.');
    if (!isLifecycleEvent && (!event.run_id || !event.summary)) {
      return;
    }

    // Ensure timestamp is set
    event.ts = event.ts ?? new Date().toISOString();

    // Handle blocked agent resuming
    if (event.agent_id) {
      const currentAgent = await queryOne<any>(
        "SELECT status FROM agents WHERE agent_id = $1",
        [event.agent_id]
      );

      if (currentAgent?.status === "blocked" && !event.status) {
        event.status = "working";
      }

      // Update agent records
      await this.agentService.upsertAgent(event);
      await this.agentService.updateActivity(event.agent_id, event.status as any);
      await this.agentService.incrementCounters(event);
    }

    // Insert event into database
    await this.repository.insert(event);
  }

  /**
   * Process a batch of events
   */
  async processBatch(events: MarionetteEvent[]): Promise<MarionetteEvent[]> {
    const processed: MarionetteEvent[] = [];

    for (const event of events) {
      try {
        await this.processEvent(event);
        processed.push(event);
      } catch (err) {
        // Log error but continue processing other events
        console.error("Error processing event:", err);
      }
    }

    return processed;
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
