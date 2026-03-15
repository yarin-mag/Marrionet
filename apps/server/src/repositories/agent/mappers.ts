import type { AgentSnapshot, AgentStatus } from "@marionette/shared";
import type { DbAgentRow } from "./types.js";

/**
 * Parse a SQLite timestamp string (no timezone info) as UTC.
 * SQLite's CURRENT_TIMESTAMP returns "YYYY-MM-DD HH:MM:SS" without timezone.
 * Node.js parses space-separated datetime strings as local time, causing offset errors.
 */
export function parseDbTimestamp(ts: string | null): string | null {
  if (!ts) return null;
  const utc = ts.includes('T') ? ts : ts.replace(' ', 'T') + 'Z';
  return new Date(utc).toISOString();
}

export function mapToSnapshot(row: DbAgentRow, metadata: unknown): AgentSnapshot {
  return {
    agent_id: row.agent_id,
    agent_name: row.agent_name ?? undefined,
    status: row.status as AgentStatus,
    current_run_id: row.current_run_id ?? undefined,
    current_task: row.current_task ?? undefined,
    last_activity: parseDbTimestamp(row.last_activity) ?? new Date().toISOString(),
    terminal: row.terminal ?? undefined,
    cwd: row.cwd ?? undefined,
    total_runs: row.total_runs ?? 0,
    total_tasks: row.total_tasks ?? 0,
    total_errors: row.total_errors ?? 0,
    total_tokens: row.total_tokens ?? 0,
    total_duration_ms: row.total_duration_ms ?? 0,
    session_start: parseDbTimestamp(row.session_start) ?? undefined,
    session_runs: row.session_runs ?? 0,
    session_errors: row.session_errors ?? 0,
    session_tokens: row.session_tokens ?? 0,
    status_since: parseDbTimestamp(row.status_since) ?? undefined,
    source_file: row.source_file ?? undefined,
    parent_agent_id: row.parent_agent_id ?? undefined,
    is_subagent: row.is_subagent === 1,
    metadata: metadata as AgentSnapshot['metadata'],
  };
}
