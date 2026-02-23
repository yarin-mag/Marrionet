import { generateAgentId, generateRunId } from "@marionette/shared";
import type { AgentMetadata } from "@marionette/shared";
import os from "node:os";

/**
 * Generate agent ID and metadata for MCP server
 */
export function createAgentIdentity(): {
  agentId: string;
  runId: string;
  metadata: AgentMetadata;
} {
  const runId = generateRunId();

  const agentId = generateAgentId({
    hostname: os.hostname(),
    terminal: process.env.TERM_SESSION_ID ?? process.env.TERM ?? "default",
    cwd: process.cwd(),
    suffix: runId,
  });

  const customName = process.env.MARIONETTE_AGENT_NAME;
  const projectName = process.cwd().split("/").pop() || "unknown";
  const defaultName = projectName;

  const metadata: AgentMetadata = {
    name: customName ?? defaultName,
    terminal: process.env.TERM_SESSION_ID ?? process.env.TERM ?? "default",
    cwd: process.cwd(),
    version: "0.1.0",
  };

  return { agentId, runId, metadata };
}
