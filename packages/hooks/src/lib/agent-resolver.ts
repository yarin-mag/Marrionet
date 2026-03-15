import { readFileSync } from "node:fs";
import { agentTempFilePath } from "@marionette/shared/ids-node";

/** Statuses that indicate an agent is actively running — used for API-based lookup. */
const ACTIVE_STATUSES = new Set(["working", "awaiting_input", "delegating", "starting"]);

interface AgentRecord {
  agent_id: string;
  cwd?: string;
  status?: string;
  last_activity?: string;
  terminal?: string;
}

/**
 * Try to read the MCP server's agent_id from the temp file it writes at startup.
 * Returns null if the file is absent or its content doesn't look like a valid agent ID.
 */
export function readTempFileAgentId(cwd: string): string | null {
  try {
    const content = readFileSync(agentTempFilePath(cwd), "utf8").trim();
    return /^agent_[0-9a-f]{16}$/.test(content) ? content : null;
  } catch {
    return null;
  }
}

/**
 * Look up the most recently active agent for the given cwd via the REST API.
 * Mirrors the jq filter in on-stop.sh:
 *   map(select(.cwd == $cwd and (.status == "working" or ...)))
 *   | sort_by(.last_activity) | last | .agent_id
 */
export async function lookupAgentByCwd(
  cwd: string,
  apiUrl: string,
  fetchFn: typeof fetch = fetch
): Promise<string | null> {
  try {
    const res = await fetchFn(`${apiUrl}/api/agents`, {
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return null;

    const agents = (await res.json()) as AgentRecord[];
    const active = agents
      .filter((a) => a.cwd === cwd && ACTIVE_STATUSES.has(a.status ?? ""))
      .sort((a, b) => (a.last_activity ?? "").localeCompare(b.last_activity ?? ""));

    return active.length > 0 ? active[active.length - 1].agent_id : null;
  } catch {
    return null;
  }
}

/**
 * Resolve agent ID: prefer temp file (written by MCP server at startup),
 * fall back to API lookup by cwd.
 * Matches the two-step resolution in on-stop.sh.
 */
export async function resolveAgentId(
  cwd: string,
  apiUrl: string,
  fetchFn: typeof fetch = fetch
): Promise<string | null> {
  const fromTempFile = readTempFileAgentId(cwd);
  if (fromTempFile) return fromTempFile;
  return lookupAgentByCwd(cwd, apiUrl, fetchFn);
}
