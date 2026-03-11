import type { MarionetteEvent, AgentMetadata, ConversationTurn } from "@marionette/shared";
import type { ClaudeJsonlEntry } from "./types.js";
import { deriveAgentId, buildMetadata } from "./id-helpers.js";

/**
 * Extract plain text from a JSONL message content field.
 * Content can be a string or an array of content blocks.
 */
export function extractMessageText(content: unknown): string | null {
  if (typeof content === "string") return content || null;
  if (Array.isArray(content)) {
    const parts = (content as unknown[])
      .filter(
        (block): block is { type: string; text: string } =>
          typeof block === "object" &&
          block !== null &&
          (block as Record<string, unknown>)["type"] === "text" &&
          typeof (block as Record<string, unknown>)["text"] === "string"
      )
      .map((block) => block.text);
    return parts.length > 0 ? parts.join("\n") : null;
  }
  return null;
}

/**
 * Emits `conversation.turn` events for JSONL lines that have a `message` field
 * with extractable text content.
 */
export function buildConversationTurnEvents(
  entry: ClaudeJsonlEntry,
  filePath: string,
  runId: string,
  source?: AgentMetadata['source']
): MarionetteEvent[] {
  if (!entry.message) return [];

  const msg = entry.message as { role?: string; content?: unknown };
  if (!msg.role) return [];

  const text = extractMessageText(msg.content);
  if (text === null) return [];

  const agentId = deriveAgentId(entry, filePath);
  const sessionId = entry.sessionId ?? "";
  const role = msg.role as "user" | "assistant" | "system";
  const direction: "to_agent" | "from_agent" = role === "user" ? "to_agent" : "from_agent";

  const turn: ConversationTurn = {
    id: entry.uuid ?? `${agentId}-${entry.timestamp ?? new Date().toISOString()}-${Math.random().toString(36).slice(2, 9)}`,
    agent_id: agentId,
    session_id: sessionId,
    direction,
    role,
    content: text,
    content_plain: text,
    timestamp: entry.timestamp ?? new Date().toISOString(),
    source: "terminal",
  };

  return [
    {
      agent_id: agentId,
      run_id: runId,
      type: "conversation.turn",
      ts: entry.timestamp ?? new Date().toISOString(),
      summary: `Conversation turn: ${role}`,
      agent_metadata: buildMetadata(entry, source),
      payload: turn as unknown as Record<string, unknown>,
    } as MarionetteEvent,
  ];
}
