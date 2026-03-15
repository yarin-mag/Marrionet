import type { MarionetteEvent, AgentSnapshot, AgentStatus } from "@marionette/shared";
import { BaseRepository } from "../base.repository.js";
import type { DbAgentRow, WrapperEvent } from "./types.js";
import { mapToSnapshot } from "./mappers.js";

export class AgentRepository extends BaseRepository {
  private static readonly VALID_STATUSES = new Set<string>([
    'starting','idle','working','blocked','error',
    'finished','crashed','disconnected','awaiting_input','delegating'
  ]);

  // ─── Upserts ──────────────────────────────────────────────────────────────

  /**
   * Upsert agent for a new session.
   * Session counters are reset when the incoming sessionId differs from the stored one
   * (genuine new session / /clear), and preserved when the same sessionId reconnects (WS reconnect).
   */
  async upsertForNewSession(event: MarionetteEvent): Promise<void> {
    const metadata = event.agent_metadata;
    const raw = event as WrapperEvent;
    const sessionId = (event.payload?.sessionId as string | undefined) ?? null;
    let parentAgentId = (event.payload?.parent_agent_id as string | undefined) ?? null;

    // agent.started events are always subagents (root agents use conversation.started).
    // If no parent_agent_id was set (race condition in file watcher), auto-detect the
    // parent by finding the most recently active root agent with the same cwd.
    if (event.type === "agent.started" && !parentAgentId && metadata?.cwd) {
      const result = await this.queryOne<{ agent_id: string }>(
        `SELECT agent_id FROM agents
         WHERE cwd = $1 AND parent_agent_id IS NULL
           AND status NOT IN ('finished', 'disconnected', 'crashed')
         ORDER BY last_activity DESC LIMIT 1`,
        [metadata.cwd]
      );
      if (result) parentAgentId = result.agent_id;
    }

    const isSubagent = event.type === "agent.started" ? 1 : 0;

    await this.query(
      `INSERT INTO agents (
        agent_id, agent_name, status, terminal, cwd,
        last_activity, session_start, metadata, status_since, current_session_id, parent_agent_id, is_subagent
      ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $6, CURRENT_TIMESTAMP, $7, $8, $9)
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
        parent_agent_id = COALESCE(excluded.parent_agent_id, agents.parent_agent_id),
        is_subagent = CASE WHEN excluded.is_subagent = 1 THEN 1 ELSE agents.is_subagent END,
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
        parentAgentId,
        isSubagent,
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

  // ─── Queries ──────────────────────────────────────────────────────────────

  async findById(agentId: string): Promise<AgentSnapshot | null> {
    const row = await this.queryOne<DbAgentRow>(
      "SELECT * FROM agents WHERE agent_id = $1",
      [agentId]
    );
    return row ? mapToSnapshot(row, this.safeParse(row.metadata)) : null;
  }

  async findAll(statusFilter?: AgentStatus): Promise<AgentSnapshot[]> {
    const sql = statusFilter
      ? "SELECT * FROM agents WHERE status = $1 ORDER BY last_activity DESC"
      : "SELECT * FROM agents ORDER BY last_activity DESC";

    const rows = await this.query<DbAgentRow>(sql, statusFilter ? [statusFilter] : []);
    return rows.map((row) => mapToSnapshot(row, this.safeParse(row.metadata)));
  }

  // ─── Updates ──────────────────────────────────────────────────────────────

  async updateStatus(agentId: string, status: AgentStatus): Promise<number> {
    const result = await this.query(
      `UPDATE agents
       SET status = $1,
           last_activity = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP,
           status_since = CASE WHEN status != $1 THEN CURRENT_TIMESTAMP ELSE status_since END
       WHERE agent_id = $2 RETURNING agent_id`,
      [status, agentId]
    );
    return result.length;
  }

  async updateActivity(agentId: string): Promise<void> {
    await this.query(
      "UPDATE agents SET last_activity = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE agent_id = $1",
      [agentId]
    );
  }

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

  async updateMetadata(agentId: string, metadata: Record<string, unknown>): Promise<void> {
    await this.query(
      "UPDATE agents SET metadata = $1, updated_at = CURRENT_TIMESTAMP WHERE agent_id = $2",
      [this.safeStringify(metadata), agentId]
    );
  }

  async updateSourceFile(agentId: string, sourceFile: string | null): Promise<void> {
    await this.query(
      "UPDATE agents SET source_file = $1, updated_at = CURRENT_TIMESTAMP WHERE agent_id = $2",
      [sourceFile, agentId]
    );
  }

  async updateTask(agentId: string, task: string | null): Promise<void> {
    await this.query(
      "UPDATE agents SET current_task = $1, updated_at = CURRENT_TIMESTAMP WHERE agent_id = $2",
      [task, agentId]
    );
  }

  async updateCurrentRun(agentId: string, runId: string): Promise<void> {
    await this.query(
      "UPDATE agents SET current_run_id = $1, updated_at = CURRENT_TIMESTAMP WHERE agent_id = $2",
      [runId, agentId]
    );
  }

  // ─── Deletes ──────────────────────────────────────────────────────────────

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

  async deleteAll(): Promise<number> {
    const result = await this.query("DELETE FROM agents RETURNING agent_id");
    return result.length;
  }

  async deleteById(agentId: string): Promise<number> {
    const result = await this.query(
      "DELETE FROM agents WHERE agent_id = $1 RETURNING agent_id",
      [agentId]
    );
    return result.length;
  }

  // ─── Counters ─────────────────────────────────────────────────────────────

  async incrementRuns(agentId: string): Promise<void> {
    await this.query(
      "UPDATE agents SET total_runs = total_runs + 1, session_runs = session_runs + 1 WHERE agent_id = $1",
      [agentId]
    );
  }

  async incrementTasks(agentId: string): Promise<void> {
    await this.query(
      "UPDATE agents SET total_tasks = total_tasks + 1 WHERE agent_id = $1",
      [agentId]
    );
  }

  async incrementErrors(agentId: string): Promise<void> {
    await this.query(
      "UPDATE agents SET total_errors = total_errors + 1, session_errors = session_errors + 1 WHERE agent_id = $1",
      [agentId]
    );
  }

  async incrementTokensAndDuration(agentId: string, tokens: number, durationMs: number): Promise<void> {
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
}
