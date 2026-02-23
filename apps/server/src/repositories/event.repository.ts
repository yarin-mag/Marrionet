import type { MarionetteEvent } from "@marionette/shared";
import { BaseRepository } from "./base.repository.js";

/**
 * Repository for event-related database operations
 * Handles all CRUD operations for the events table
 */
export class EventRepository extends BaseRepository {
  /**
   * Insert a new event
   */
  async insert(event: MarionetteEvent): Promise<void> {
    await this.query(
      `INSERT INTO events (
        agent_id, run_id, task_id, type, ts, summary, status,
        duration_ms, tokens, error, payload, trace_id, span_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        event.agent_id ?? null,
        event.run_id,
        event.task_id ?? null,
        event.type,
        event.ts,
        event.summary,
        event.status ?? null,
        event.duration_ms ?? null,
        this.safeStringify(event.tokens),
        this.safeStringify(event.error),
        this.safeStringify(event.payload),
        event.trace_id ?? null,
        event.span_id ?? null,
      ]
    );
  }

  /**
   * Find events by agent ID
   */
  async findByAgentId(
    agentId: string,
    limit: number = 100
  ): Promise<MarionetteEvent[]> {
    return this.query<MarionetteEvent>(
      `SELECT * FROM events
       WHERE agent_id = $1
       ORDER BY ts DESC
       LIMIT $2`,
      [agentId, limit]
    );
  }

  /**
   * Find recent events
   */
  async findRecent(limit: number = 100): Promise<MarionetteEvent[]> {
    return this.query<MarionetteEvent>(
      "SELECT * FROM events ORDER BY ts DESC LIMIT $1",
      [limit]
    );
  }

  /**
   * Find events with filters
   */
  async findWithFilters(filters: {
    runId?: string;
    agentId?: string;
    type?: string;
    limit?: number;
  }): Promise<MarionetteEvent[]> {
    const { runId, agentId, type, limit = 500 } = filters;

    let sql = "SELECT * FROM events WHERE 1=1";
    const params: any[] = [];

    if (runId) {
      params.push(runId);
      sql += ` AND run_id = $${params.length}`;
    }
    if (agentId) {
      params.push(agentId);
      sql += ` AND agent_id = $${params.length}`;
    }
    if (type) {
      params.push(type);
      sql += ` AND type = $${params.length}`;
    }

    params.push(limit);
    sql += ` ORDER BY ts DESC LIMIT $${params.length}`;

    return this.query<MarionetteEvent>(sql, params);
  }
}
