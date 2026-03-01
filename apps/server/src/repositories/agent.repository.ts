import type { MarionetteEvent, AgentSnapshot, AgentStatus } from "@marionette/shared";
import { BaseRepository } from "./base.repository.js";

/** Raw database row shape returned by agent queries */
interface DbAgentRow {
  agent_id: string;
  agent_name: string | null;
  status: string;
  current_run_id: string | null;
  current_task: string | null;
  last_activity: string | null;
  terminal: string | null;
  cwd: string | null;
  total_runs: number;
  total_tasks: number;
  total_errors: number;
  total_tokens: number;
  total_duration_ms: number;
  session_start: string | null;
  session_runs: number;
  session_errors: number;
  session_tokens: number;
  status_since: string | null;
  source_file: string | null;
  metadata: string | null;
}

/** Wrapper events may carry terminal/cwd as top-level fields */
type WrapperEvent = MarionetteEvent & { terminal?: string; cwd?: string };

export class AgentRepository extends BaseRepository {
  private static readonly VALID_STATUSES = new Set<string>([
    'starting','idle','working','blocked','error',
    'finished','crashed','disconnected','awaiting_input'
  ]);

  /**
   * Parse a SQLite timestamp string (no timezone info) as UTC.
   * SQLite's CURRENT_TIMESTAMP returns "YYYY-MM-DD HH:MM:SS" without timezone.
   * Node.js parses space-separated datetime strings as local time, causing offset errors.
   */
  private parseDbTimestamp(ts: string | null): string | null {
    if (!ts) return null;
    const utc = ts.includes('T') ? ts : ts.replace(' ', 'T') + 'Z';
    return new Date(utc).toISOString();
  }

  /**
   * Upsert agent for a new session.
   * Session counters are reset when the incoming sessionId differs from the stored one
   * (genuine new session / /clear), and preserved when the same sessionId reconnects (WS reconnect).
   */
  async upsertForNewSession(event: MarionetteEvent): Promise<void> {
    const metadata = event.agent_metadata;
    const raw = event as WrapperEvent;
    const sessionId = (event.payload?.sessionId as string | undefined) ?? null;

    await this.query(
      `INSERT INTO agents (
        agent_id, agent_name, status, terminal, cwd,
        last_activity, session_start, metadata, status_since, current_session_id
      ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $6, CURRENT_TIMESTAMP, $7)
      ON CONFLICT (agent_id) DO UPDATE SET
        agent_name = COALESCE(excluded.agent_name, agents.agent_name),
        status = excluded.status,
        terminal = COALESCE(excluded.terminal, agents.terminal),
        cwd = COALESCE(excluded.cwd, agents.cwd),
        last_activity = CURRENT_TIMESTAMP,
        session_start = CURRENT_TIMESTAMP,
        session_runs   = CASE WHEN agents.current_session_id IS NULL OR agents.current_session_id != excluded.current_session_id THEN 0 ELSE agents.session_runs END,
        session_errors = CASE WHEN agents.current_session_id IS NULL OR agents.current_session_id != excluded.current_session_id THEN 0 ELSE agents.session_errors END,
        session_tokens = CASE WHEN agents.current_session_id IS NULL OR agents.current_session_id != excluded.current_session_id THEN 0 ELSE agents.session_tokens END,
        current_session_id = excluded.current_session_id,
        status_since = CASE WHEN excluded.status != agents.status THEN CURRENT_TIMESTAMP ELSE agents.status_since END,
        metadata = COALESCE(excluded.metadata, agents.metadata),
        updated_at = CURRENT_TIMESTAMP`,
      [
        event.agent_id,
        metadata?.name ?? null,
        AgentRepository.VALID_STATUSES.has(event.status as string) ? event.status : "working",
        metadata?.terminal ?? raw.terminal ?? null,
        metadata?.cwd ?? raw.cwd ?? null,
        this.safeStringify(metadata),
        sessionId,
      ]
    );
  }

  /**
   * Upsert agent for existing session (preserves session counters)
   */
  async upsertForExistingSession(event: MarionetteEvent): Promise<void> {
    const metadata = event.agent_metadata;
    const raw = event as WrapperEvent;
    const currentTask = (event.payload?.current_task as string | undefined) ?? null;

    await this.query(
      `INSERT INTO agents (
        agent_id, agent_name, status, terminal, cwd,
        last_activity, session_start, metadata, status_since
      ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $6, CURRENT_TIMESTAMP)
      ON CONFLICT (agent_id) DO UPDATE SET
        agent_name = COALESCE(excluded.agent_name, agents.agent_name),
        status = COALESCE(excluded.status, agents.status),
        terminal = COALESCE(excluded.terminal, agents.terminal),
        cwd = COALESCE(excluded.cwd, agents.cwd),
        last_activity = CURRENT_TIMESTAMP,
        current_task = COALESCE($7, agents.current_task),
        status_since = CASE WHEN COALESCE(excluded.status, agents.status) != agents.status THEN CURRENT_TIMESTAMP ELSE agents.status_since END,
        metadata = COALESCE(excluded.metadata, agents.metadata),
        updated_at = CURRENT_TIMESTAMP`,
      [
        event.agent_id,
        metadata?.name ?? null,
        AgentRepository.VALID_STATUSES.has(event.status as string) ? event.status : null,
        metadata?.terminal ?? raw.terminal ?? null,
        metadata?.cwd ?? raw.cwd ?? null,
        this.safeStringify(metadata),
        currentTask,
      ]
    );
  }

  /**
   * Find an agent by ID
   */
  async findById(agentId: string): Promise<AgentSnapshot | null> {
    const row = await this.queryOne<DbAgentRow>(
      "SELECT * FROM agents WHERE agent_id = $1",
      [agentId]
    );
    return row ? this.mapToSnapshot(row) : null;
  }

  /**
   * Find all agents, optionally filtered by status
   */
  async findAll(statusFilter?: AgentStatus): Promise<AgentSnapshot[]> {
    const sql = statusFilter
      ? "SELECT * FROM agents WHERE status = $1 ORDER BY last_activity DESC"
      : "SELECT * FROM agents ORDER BY last_activity DESC";

    const rows = await this.query<DbAgentRow>(sql, statusFilter ? [statusFilter] : []);
    return rows.map((row) => this.mapToSnapshot(row));
  }

  /**
   * Update agent status
   */
  async updateStatus(agentId: string, status: AgentStatus): Promise<number> {
    const result = await this.query(
      `UPDATE agents
       SET status = $1,
           last_activity = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP,
           status_since = CASE WHEN status != $1 THEN CURRENT_TIMESTAMP ELSE status_since END
       WHERE agent_id = $2 RETURNING agent_id`,
      // $1 = new status (used twice by convertPlaceholders), $2 = agentId
      [status, agentId]
    );
    return result.length;
  }

  /**
   * Update agent activity timestamp (for heartbeat)
   */
  async updateActivity(agentId: string): Promise<void> {
    await this.query(
      "UPDATE agents SET last_activity = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE agent_id = $1",
      [agentId]
    );
  }

  /**
   * Create a new agent
   */
  async create(
    agentId: string,
    agentName: string,
    status: AgentStatus,
    terminal?: string,
    cwd?: string
  ): Promise<void> {
    await this.query(
      `INSERT INTO agents (
        agent_id, agent_name, status, terminal, cwd,
        last_activity, session_start, status_since
      ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (agent_id) DO UPDATE SET
        status = excluded.status,
        last_activity = CURRENT_TIMESTAMP,
        status_since = CASE WHEN agents.status != excluded.status THEN CURRENT_TIMESTAMP ELSE agents.status_since END,
        updated_at = CURRENT_TIMESTAMP`,
      [agentId, agentName, status, terminal ?? null, cwd ?? null]
    );
  }

  /**
   * Delete crashed/idle/error agents and return the deleted rows so callers
   * can extract source file paths from the same transaction (avoids TOCTOU).
   */
  async deleteCrashed(): Promise<{ agentId: string; sourceFile: string | null }[]> {
    const rows = await this.query<{ agent_id: string; source_file: string | null }>(
      `DELETE FROM agents WHERE status IN ('crashed', 'idle', 'error')
       RETURNING agent_id, source_file`
    );
    return rows.map((r) => ({
      agentId: r.agent_id,
      sourceFile: r.source_file ?? null,
    }));
  }

  /**
   * Delete all agents
   */
  async deleteAll(): Promise<number> {
    const result = await this.query("DELETE FROM agents RETURNING agent_id");
    return result.length;
  }

  /**
   * Delete a single agent by ID
   */
  async deleteById(agentId: string): Promise<number> {
    const result = await this.query(
      "DELETE FROM agents WHERE agent_id = $1 RETURNING agent_id",
      [agentId]
    );
    return result.length;
  }

  /**
   * Update agent metadata
   */
  async updateMetadata(
    agentId: string,
    metadata: Record<string, unknown>
  ): Promise<void> {
    await this.query(
      "UPDATE agents SET metadata = $1, updated_at = CURRENT_TIMESTAMP WHERE agent_id = $2",
      [this.safeStringify(metadata), agentId]
    );
  }

  /**
   * Update source file path (server-internal filesystem path, stored as a dedicated column)
   */
  async updateSourceFile(agentId: string, sourceFile: string | null): Promise<void> {
    await this.query(
      "UPDATE agents SET source_file = $1, updated_at = CURRENT_TIMESTAMP WHERE agent_id = $2",
      [sourceFile, agentId]
    );
  }

  /**
   * Update current task
   */
  async updateTask(agentId: string, task: string | null): Promise<void> {
    await this.query(
      "UPDATE agents SET current_task = $1, updated_at = CURRENT_TIMESTAMP WHERE agent_id = $2",
      [task, agentId]
    );
  }

  /**
   * Increment run counters
   */
  async incrementRuns(agentId: string): Promise<void> {
    await this.query(
      "UPDATE agents SET total_runs = total_runs + 1, session_runs = session_runs + 1 WHERE agent_id = $1",
      [agentId]
    );
  }

  /**
   * Increment task counter
   */
  async incrementTasks(agentId: string): Promise<void> {
    await this.query(
      "UPDATE agents SET total_tasks = total_tasks + 1 WHERE agent_id = $1",
      [agentId]
    );
  }

  /**
   * Increment error counters
   */
  async incrementErrors(agentId: string): Promise<void> {
    await this.query(
      "UPDATE agents SET total_errors = total_errors + 1, session_errors = session_errors + 1 WHERE agent_id = $1",
      [agentId]
    );
  }

  /**
   * Increment tokens and duration
   */
  async incrementTokensAndDuration(
    agentId: string,
    tokens: number,
    durationMs: number
  ): Promise<void> {
    const safeTokens = Math.max(0, tokens);
    const safeDuration = Math.max(0, durationMs);
    await this.query(
      `UPDATE agents SET
        total_tokens = total_tokens + $1,
        session_tokens = session_tokens + $2,
        total_duration_ms = total_duration_ms + $3
      WHERE agent_id = $4`,
      [safeTokens, safeTokens, safeDuration, agentId]
    );
  }

  private mapToSnapshot(row: DbAgentRow): AgentSnapshot {
    return {
      agent_id: row.agent_id,
      agent_name: row.agent_name ?? undefined,
      status: row.status as AgentStatus,
      current_run_id: row.current_run_id ?? undefined,
      current_task: row.current_task ?? undefined,
      last_activity: this.parseDbTimestamp(row.last_activity) ?? new Date().toISOString(),
      terminal: row.terminal ?? undefined,
      cwd: row.cwd ?? undefined,
      total_runs: row.total_runs ?? 0,
      total_tasks: row.total_tasks ?? 0,
      total_errors: row.total_errors ?? 0,
      total_tokens: row.total_tokens ?? 0,
      total_duration_ms: row.total_duration_ms ?? 0,
      session_start: this.parseDbTimestamp(row.session_start) ?? undefined,
      session_runs: row.session_runs ?? 0,
      session_errors: row.session_errors ?? 0,
      session_tokens: row.session_tokens ?? 0,
      status_since: this.parseDbTimestamp(row.status_since) ?? undefined,
      source_file: row.source_file ?? undefined,
      metadata: this.safeParse(row.metadata),
    };
  }
}
