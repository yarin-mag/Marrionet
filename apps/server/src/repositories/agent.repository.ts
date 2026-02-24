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
  total_tokens: string;
  total_duration_ms: string;
  session_start: string | null;
  session_runs: number;
  session_errors: number;
  session_tokens: string;
  metadata: string | null;
}

/** Wrapper events may carry terminal/cwd as top-level fields */
type WrapperEvent = MarionetteEvent & { terminal?: string; cwd?: string };

export class AgentRepository extends BaseRepository {
  /**
   * Upsert agent for a new session (resets session counters)
   */
  async upsertForNewSession(event: MarionetteEvent): Promise<void> {
    const metadata = event.agent_metadata;
    const raw = event as WrapperEvent;

    await this.query(
      `INSERT INTO agents (
        agent_id, agent_name, status, terminal, cwd,
        last_activity, session_start, metadata
      ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $6)
      ON CONFLICT (agent_id) DO UPDATE SET
        agent_name = COALESCE(excluded.agent_name, agents.agent_name),
        status = excluded.status,
        terminal = COALESCE(excluded.terminal, agents.terminal),
        cwd = COALESCE(excluded.cwd, agents.cwd),
        last_activity = CURRENT_TIMESTAMP,
        session_start = CURRENT_TIMESTAMP,
        session_runs = 0,
        session_errors = 0,
        session_tokens = 0,
        metadata = COALESCE(excluded.metadata, agents.metadata),
        updated_at = CURRENT_TIMESTAMP`,
      [
        event.agent_id,
        metadata?.name ?? null,
        event.status ?? "working",
        metadata?.terminal ?? raw.terminal ?? null,
        metadata?.cwd ?? raw.cwd ?? null,
        this.safeStringify(metadata),
      ]
    );
  }

  /**
   * Upsert agent for existing session (preserves session counters)
   */
  async upsertForExistingSession(event: MarionetteEvent): Promise<void> {
    const metadata = event.agent_metadata;
    const raw = event as WrapperEvent;

    await this.query(
      `INSERT INTO agents (
        agent_id, agent_name, status, terminal, cwd,
        last_activity, session_start, metadata
      ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $6)
      ON CONFLICT (agent_id) DO UPDATE SET
        agent_name = COALESCE(excluded.agent_name, agents.agent_name),
        status = excluded.status,
        terminal = COALESCE(excluded.terminal, agents.terminal),
        cwd = COALESCE(excluded.cwd, agents.cwd),
        last_activity = CURRENT_TIMESTAMP,
        metadata = COALESCE(excluded.metadata, agents.metadata),
        updated_at = CURRENT_TIMESTAMP`,
      [
        event.agent_id,
        metadata?.name ?? null,
        event.status ?? "working",
        metadata?.terminal ?? raw.terminal ?? null,
        metadata?.cwd ?? raw.cwd ?? null,
        this.safeStringify(metadata),
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
      "UPDATE agents SET status = $1, last_activity = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE agent_id = $2 RETURNING agent_id",
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
   * Find agent by terminal and cwd
   */
  async findByTerminalAndCwd(
    terminal: string,
    cwd: string
  ): Promise<AgentSnapshot | null> {
    const row = await this.queryOne<DbAgentRow>(
      "SELECT * FROM agents WHERE terminal = $1 AND cwd = $2",
      [terminal, cwd]
    );
    return row ? this.mapToSnapshot(row) : null;
  }

  /**
   * Find agent by terminal only
   */
  async findByTerminal(terminal: string): Promise<AgentSnapshot | null> {
    const row = await this.queryOne<DbAgentRow>(
      "SELECT * FROM agents WHERE terminal = $1",
      [terminal]
    );
    return row ? this.mapToSnapshot(row) : null;
  }

  /**
   * Find agent by cwd only
   */
  async findByCwd(cwd: string): Promise<AgentSnapshot | null> {
    const row = await this.queryOne<DbAgentRow>(
      "SELECT * FROM agents WHERE cwd = $1",
      [cwd]
    );
    return row ? this.mapToSnapshot(row) : null;
  }

  /**
   * Find most recent agent
   */
  async findMostRecent(): Promise<AgentSnapshot | null> {
    const row = await this.queryOne<DbAgentRow>(
      "SELECT * FROM agents ORDER BY last_activity DESC LIMIT 1"
    );
    return row ? this.mapToSnapshot(row) : null;
  }

  /**
   * Update agent by terminal and cwd
   * IMPORTANT: Only updates the most recently active agent to prevent
   * status changes from affecting all Claude processes in the same directory
   */
  async updateByTerminalAndCwd(terminal: string, cwd: string, status: AgentStatus): Promise<number> {
    const result = await this.query(
      this.buildActiveAgentUpdateSql("terminal = $2 AND cwd = $3"),
      [status, terminal, cwd]
    );
    return result.length;
  }

  async updateByTerminal(terminal: string, status: AgentStatus): Promise<number> {
    const result = await this.query(
      this.buildActiveAgentUpdateSql("terminal = $2"),
      [status, terminal]
    );
    return result.length;
  }

  async updateByCwd(cwd: string, status: AgentStatus): Promise<number> {
    const result = await this.query(
      this.buildActiveAgentUpdateSql("cwd = $2"),
      [status, cwd]
    );
    return result.length;
  }

  /**
   * Update most recent agent
   */
  async updateMostRecent(status: AgentStatus): Promise<number> {
    const result = await this.query(
      `UPDATE agents
       SET status = $1, last_activity = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE agent_id = (SELECT agent_id FROM agents ORDER BY last_activity DESC LIMIT 1)
       RETURNING agent_id`,
      [status]
    );
    return result.length;
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
        last_activity, session_start
      ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (agent_id) DO UPDATE SET
        status = $3,
        last_activity = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP`,
      [agentId, agentName, status, terminal ?? null, cwd ?? null]
    );
  }

  /**
   * Mark inactive agents as idle
   */
  async markIdle(idleTimeoutMinutes: number = 2): Promise<number> {
    const result = await this.query(
      `UPDATE agents
       SET status = 'idle', updated_at = CURRENT_TIMESTAMP
       WHERE status IN ('working', 'starting', 'blocked')
         AND last_activity < datetime('now', '-${idleTimeoutMinutes} minutes')
       RETURNING agent_id`
    );
    return result.length;
  }

  /**
   * Delete crashed/idle/error agents
   */
  async deleteCrashed(): Promise<number> {
    const result = await this.query(
      `DELETE FROM agents WHERE status IN ('crashed', 'idle', 'error') RETURNING agent_id`
    );
    return result.length;
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
    await this.query(
      `UPDATE agents SET
        total_tokens = total_tokens + $2,
        session_tokens = session_tokens + $2,
        total_duration_ms = total_duration_ms + $3
      WHERE agent_id = $1`,
      [agentId, tokens, durationMs]
    );
  }

  /**
   * Map database row to AgentSnapshot
   */
  private buildActiveAgentUpdateSql(whereClause: string): string {
    return `UPDATE agents
       SET status = $1, last_activity = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE agent_id = (
         SELECT agent_id FROM agents
         WHERE ${whereClause}
           AND status NOT IN ('finished', 'disconnected')
         ORDER BY last_activity DESC
         LIMIT 1
       )
       RETURNING agent_id`;
  }

  private mapToSnapshot(row: DbAgentRow): AgentSnapshot {
    return {
      agent_id: row.agent_id,
      agent_name: row.agent_name,
      status: row.status,
      current_run_id: row.current_run_id,
      current_task: row.current_task,
      last_activity: row.last_activity
        ? new Date(row.last_activity).toISOString()
        : new Date().toISOString(),
      terminal: row.terminal,
      cwd: row.cwd,
      total_runs: row.total_runs ?? 0,
      total_tasks: row.total_tasks ?? 0,
      total_errors: row.total_errors ?? 0,
      total_tokens: parseInt(row.total_tokens ?? "0", 10),
      total_duration_ms: parseInt(row.total_duration_ms ?? "0", 10),
      session_start: row.session_start
        ? new Date(row.session_start).toISOString()
        : undefined,
      session_runs: row.session_runs ?? 0,
      session_errors: row.session_errors ?? 0,
      session_tokens: parseInt(row.session_tokens ?? "0", 10),
      metadata: this.safeParse(row.metadata),
    };
  }
}
