import type { MarionetteEvent } from "@marionette/shared";

/** Raw database row shape returned by agent queries */
export interface DbAgentRow {
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
  parent_agent_id: string | null;
  is_subagent: number;
  metadata: string | null;
}

/** Wrapper events may carry terminal/cwd as top-level fields */
export type WrapperEvent = MarionetteEvent & { terminal?: string; cwd?: string };
