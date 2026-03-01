import { generateRunId } from "@marionette/shared";
import { generateAgentId, agentTempFilePath, deriveAgentIdFromSession } from "@marionette/shared/ids-node";
import type { AgentMetadata } from "@marionette/shared";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { logger } from "./logger.js";

/** Detect if the MCP server is running inside a VSCode Claude Code extension */
export function isVSCodeEnvironment(): boolean {
  return !!(
    process.env.VSCODE_PID ||
    process.env.VSCODE_IPC_HOOK_CLI ||
    process.env.TERM_PROGRAM === "vscode"
  );
}

/**
 * Detect the human-readable terminal name from environment variables.
 * Most modern terminals set TERM_PROGRAM; we also check a few terminal-specific
 * env vars as a fallback.
 */
export function detectTerminalName(): string {
  const tp = process.env.TERM_PROGRAM;
  if (tp) {
    switch (tp) {
      case "WarpTerminal":   return "Warp";
      case "iTerm.app":      return "iTerm2";
      case "Apple_Terminal": return "Terminal.app";
      case "vscode":         return "VS Code";
      case "Hyper":          return "Hyper";
      case "ghostty":        return "Ghostty";
      default:               return tp; // pass through any unknown TERM_PROGRAM
    }
  }
  // Terminal-specific env var fallbacks
  if (process.env.WARP_FEATURES || process.env.WARP_THEMES_DIR) return "Warp";
  if (process.env.VSCODE_PID || process.env.VSCODE_IPC_HOOK_CLI) return "VS Code";
  if (process.env.TMUX)    return "tmux";
  if (process.env.STY)     return "screen";
  if (process.env.SSH_CLIENT || process.env.SSH_TTY) return "SSH";
  if (process.env.TERM_SESSION_ID) return "Terminal.app"; // macOS Terminal.app
  // Windows-specific terminal detection
  if (process.env.WT_SESSION) return "Windows Terminal";
  if (process.env.ConEmuPID)  return "ConEmu";
  if (process.env.CMDER_ROOT) return "Cmder";
  return process.env.TERM ?? "Unknown";
}

/**
 * Write agent_id and source to temp file synchronously so hook scripts and the
 * file watcher can discover both. Line 1 = agentId, line 2 = source.
 * Called immediately after agent_id is determined (before WebSocket connects).
 * Non-fatal if the write fails.
 */
export function writeTempFile(agentId: string, source: 'cli' | 'vscode' | 'mcp', cwd: string): void {
  const filePath = agentTempFilePath(cwd);
  try {
    fs.writeFileSync(filePath, `${agentId}\n${source}`, { encoding: "utf8", mode: 0o600 });
    logger.info(`Wrote agent temp file: ${filePath}`);
  } catch (err) {
    logger.warn(`Could not write agent temp file ${filePath}: ${err}`);
  }
}

/**
 * Register this agent with the local API proxy so it can attribute llm.call events.
 * Retries with a fixed delay until the proxy accepts the registration or the attempt
 * limit is reached — handles the common case where the proxy starts after the MCP server.
 * Runs fully in the background; never throws.
 */
let _registerRunning = false;

export function registerWithProxy(agentId: string, runId: string, cwd: string): void {
  if (_registerRunning) return;
  _registerRunning = true;

  const proxyUrl = process.env.MARIONETTE_PROXY_URL ?? "http://localhost:8788/_register";
  const body = JSON.stringify({ agent_id: agentId, run_id: runId, cwd });
  // Retry with backoff: every 3 s for the first minute, then every 30 s.
  // Hard cap of 200 attempts (~100 min total) prevents an infinite loop if
  // the proxy is permanently unavailable.
  const FAST_DELAY_MS = 3_000;
  const SLOW_DELAY_MS = 30_000;
  const FAST_PHASE_DURATION_MS = 60_000;
  const MAX_ATTEMPTS = 200;
  const startMs = Date.now();
  let attempt = 0;

  async function tryOnce(): Promise<void> {
    if (attempt >= MAX_ATTEMPTS) {
      logger.warn(`registerWithProxy: giving up after ${MAX_ATTEMPTS} attempts`);
      _registerRunning = false; // reset so a new runId can register later
      return;
    }
    attempt++;

    try {
      const res = await fetch(proxyUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) {
        _registerRunning = false; // reset so a new runId can register later
        return; // success — stop retrying
      }
    } catch {
      // proxy not up yet — fall through to retry
    }

    const delay = Date.now() - startMs < FAST_PHASE_DURATION_MS ? FAST_DELAY_MS : SLOW_DELAY_MS;
    setTimeout(() => { tryOnce().catch((err) => logger.warn("[agent-ids] retry error:", err)); }, delay);
  }

  tryOnce().catch((err) => logger.warn("[agent-ids] retry error:", err));
}

/**
 * Remove the temp file on process exit.
 */
export function cleanupTempFile(cwd: string): void {
  const filePath = agentTempFilePath(cwd);
  try {
    fs.unlinkSync(filePath);
    logger.info(`Removed agent temp file: ${filePath}`);
  } catch {
    // Already gone or never written — ignore
  }
}

/**
 * Compute the project slug as Claude Code does:
 * replace all path separators ("/" and "\" on Windows) with "-" and remove
 * the leading "-".
 */
function cwdToSlug(cwd: string): string {
  return cwd.replace(/[/\\]/g, "-").replace(/^-/, "");
}

/**
 * Scan `~/.claude/projects/{slug}/` for the most recently modified main-session
 * JSONL file and return the session ID (filename without `.jsonl`).
 * Returns `null` if the directory doesn't exist or has no matching files.
 * Uses async I/O to avoid blocking the event loop.
 */
async function findRecentSessionId(cwd: string): Promise<string | null> {
  const slug = cwdToSlug(cwd);
  const sessionDir = path.join(os.homedir(), ".claude", "projects", slug);

  try {
    const names = await readdir(sessionDir);
    const candidates = names.filter((f) => f.endsWith(".jsonl") && !f.startsWith("agent-"));
    const entries = await Promise.all(
      candidates.map(async (f) => ({
        sessionId: f.replace(".jsonl", ""),
        mtime: (await stat(path.join(sessionDir, f))).mtimeMs,
      }))
    );
    entries.sort((a, b) => b.mtime - a.mtime);
    return entries.length > 0 ? entries[0].sessionId : null;
  } catch {
    return null;
  }
}

/**
 * Generate agent ID and metadata for MCP server.
 *
 * Primary strategy: derive agent ID from the JSONL session file so it matches
 * the ID computed by the file watcher (sha256(sessionId)[0:16]).
 *
 * Fallback: use the legacy formula (sha256(hostname:terminal:cwd:suffix)) for
 * environments where no JSONL file exists yet (VSCode before first message, etc.).
 */
export async function createAgentIdentity(): Promise<{
  agentId: string;
  runId: string;
  metadata: AgentMetadata;
}> {
  const runId = generateRunId();
  const vscode = isVSCodeEnvironment();
  const cwd = process.cwd();

  // Attempt to align with file-watcher by reading the session ID from the JSONL file
  const sessionId = await findRecentSessionId(cwd);
  const agentId = sessionId
    ? deriveAgentIdFromSession(sessionId)
    : generateAgentId({
        hostname: os.hostname(),
        terminal: process.env.TERM_SESSION_ID ?? process.env.TERM ?? "default",
        cwd,
        suffix: vscode ? "" : runId,
      });

  if (sessionId) {
    logger.info(`Agent ID aligned with file-watcher via session ${sessionId}`);
  } else {
    logger.info("No JSONL session file found; using legacy agent ID formula");
  }

  const customName = process.env.MARIONETTE_AGENT_NAME;
  const projectName = path.basename(cwd) || "unknown";

  const metadata: AgentMetadata = {
    name: customName ?? projectName,
    terminal: detectTerminalName(),
    cwd,
    version: "0.1.0",
    source: vscode ? "vscode" : "mcp",
  };

  return { agentId, runId, metadata };
}
