import type { MarionetteEvent } from "@marionette/shared";
import { BaseRepository } from "./base.repository.js";

interface EventRow {
  id: number;
  run_id: string;
  agent_id: string | null;
  task_id: string | null;
  type: string;
  ts: string;
  summary: string | null;
  status: string | null;
  duration_ms: number | null;
  tokens: string | null;   // JSON string
  error: string | null;    // JSON string
  payload: string | null;  // JSON string
  trace_id: string | null;
  span_id: string | null;
}

export interface RunHistoryItem {
  run_id: string;
  started_at: string;
  ended_at?: string | null;
  duration_ms?: number | null;
  current_task?: string | null;
  total_tokens: number;
  total_cost_usd: number;
}

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
        event.summary ?? null,
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
   * Parse JSON columns on a raw database row into a proper MarionetteEvent.
   * SQLite stores tokens/payload/error as JSON strings — this restores them
   * to objects so all callers receive fully-typed data.
   */
  private parseRow(row: EventRow): MarionetteEvent {
    // DB uses null for missing fields; MarionetteEvent uses undefined — normalise here.
    // Cast via unknown because the type string union (MarionetteEventType, AgentStatus)
    // cannot be safely narrowed from a raw DB string without a full schema validator.
    return {
      ...row,
      agent_id: row.agent_id ?? undefined,
      task_id: row.task_id ?? undefined,
      summary: row.summary ?? undefined,
      status: row.status ?? undefined,
      duration_ms: row.duration_ms ?? undefined,
      trace_id: row.trace_id ?? undefined,
      span_id: row.span_id ?? undefined,
      tokens: this.safeParse(row.tokens),
      payload: this.safeParse(row.payload),
      error: this.safeParse(row.error),
    } as unknown as MarionetteEvent;
  }

  /**
   * Find events by agent ID
   */
  async findByAgentId(
    agentId: string,
    limit: number = 100
  ): Promise<MarionetteEvent[]> {
    const rows = await this.query<EventRow>(
      `SELECT * FROM events
       WHERE agent_id = $1
       ORDER BY ts DESC
       LIMIT $2`,
      [agentId, limit]
    );
    return rows.map((r) => this.parseRow(r));
  }

  /**
   * Find recent events
   */
  async findRecent(limit: number = 100): Promise<MarionetteEvent[]> {
    const rows = await this.query<EventRow>(
      "SELECT * FROM events ORDER BY ts DESC LIMIT $1",
      [limit]
    );
    return rows.map((r) => this.parseRow(r));
  }

  /**
   * Get aggregated run history for an agent
   */
  async getRuns(agentId: string, limit: number = 50): Promise<RunHistoryItem[]> {
    const rows = await this.query<RunHistoryItem>(`
      WITH run_starts AS (
        SELECT run_id, ts AS started_at,
               json_extract(payload, '$.current_task') AS current_task
        FROM events WHERE agent_id = $1 AND type = 'run.started'
        ORDER BY ts DESC LIMIT $2
      ),
      run_ends AS (
        SELECT run_id, ts AS ended_at, duration_ms
        FROM events WHERE agent_id = $3 AND type = 'run.ended'
      ),
      llm_totals AS (
        SELECT run_id,
          SUM(CAST(json_extract(tokens, '$.total_tokens') AS INTEGER)) AS total_tokens,
          SUM(CAST(json_extract(tokens, '$.cost_usd')    AS REAL))    AS total_cost_usd
        FROM events WHERE agent_id = $4 AND type = 'llm.call'
        GROUP BY run_id
      )
      SELECT s.run_id, s.started_at, s.current_task,
             e.ended_at, e.duration_ms,
             COALESCE(t.total_tokens, 0)    AS total_tokens,
             COALESCE(t.total_cost_usd, 0)  AS total_cost_usd
      FROM run_starts s
      LEFT JOIN run_ends   e ON s.run_id = e.run_id
      LEFT JOIN llm_totals t ON s.run_id = t.run_id
      ORDER BY s.started_at DESC
    `, [agentId, limit, agentId, agentId]);
    return rows;
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
    const params: (string | number)[] = [];

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

    const rows = await this.query<EventRow>(sql, params);
    return rows.map((r) => this.parseRow(r));
  }
}
