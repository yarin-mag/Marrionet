// ─── Claude JSONL entry shape ──────────────────────────────────────────────

export interface AssistantUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

export interface ClaudeJsonlEntry {
  parentUuid?: string;
  isSidechain?: boolean;
  sessionId?: string;
  agentId?: string;
  slug?: string;
  /** "user" | "assistant" | "system" | ... */
  type?: string;
  subtype?: string;
  /** For system/turn_duration entries */
  durationMs?: number;
  message?: {
    role?: string;
    content?: unknown;
    stop_reason?: string | null;
    usage?: AssistantUsage;
  };
  /** Present on user entries that contain tool results (not real user messages) */
  toolUseResult?: unknown;
  uuid?: string;
  timestamp?: string;
  cwd?: string;
  gitBranch?: string;
  version?: string;
  [key: string]: unknown;
}
