import type { AgentStatus } from "@marionette/shared";
import type { FileState } from "./types.js";

export const fileStates = new Map<string, FileState>();

/**
 * Tracks which JSONL file is the current "live" session per project slug.
 * Used to suppress spurious `agent.disconnected` when an old (superseded)
 * JSONL is deleted after `/clear`.
 */
export const activeFilePerSlug = new Map<string, string>(); // slug → current live filePath

export const STALE_STATUSES = new Set<AgentStatus>(["working", "awaiting_input", "starting", "idle"]);
