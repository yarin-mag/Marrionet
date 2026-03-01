import { createHash } from "node:crypto";
import { basename } from "node:path";
import { describe, it, expect } from "vitest";
import {
  deriveAgentId,
  deriveSessionRunId,
  buildMetadata,
  buildConversationStartedEvent,
  entryHasToolUse,
  buildConversationTurnEvents,
  buildTurnEndedEvent,
  type ClaudeJsonlEntry,
} from "../event-mapper.js";

// ─── Helpers ────────────────────────────────────────────────────────────────

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function entry(overrides: Partial<ClaudeJsonlEntry> = {}): ClaudeJsonlEntry {
  return { ...overrides };
}

// ─── deriveAgentId ──────────────────────────────────────────────────────────

describe("deriveAgentId", () => {
  it("returns agent_<agentId> verbatim when agentId is present (subagent path)", () => {
    const e = entry({ agentId: "my-subagent-123", sessionId: "sess-abc" });
    expect(deriveAgentId(e, "/some/file.jsonl")).toBe("agent_my-subagent-123");
  });

  it("hashes sessionId when agentId is absent", () => {
    const sessionId = "session-xyz-456";
    const e = entry({ sessionId });
    const expected = `agent_${sha256(sessionId).slice(0, 16)}`;
    expect(deriveAgentId(e, "/some/file.jsonl")).toBe(expected);
  });

  it("is deterministic for sessionId path", () => {
    const e = entry({ sessionId: "stable-session" });
    expect(deriveAgentId(e, "/a")).toBe(deriveAgentId(e, "/a"));
  });

  it("falls back to hashing filePath when both agentId and sessionId are absent", () => {
    const filePath = "/home/user/.claude/projects/my-project/abc123.jsonl";
    const e = entry({});
    const expected = `agent_${sha256(filePath).slice(0, 16)}`;
    expect(deriveAgentId(e, filePath)).toBe(expected);
  });
});

// ─── deriveSessionRunId ─────────────────────────────────────────────────────

describe("deriveSessionRunId", () => {
  it("returns a run_<16 hex chars> format", () => {
    expect(deriveSessionRunId("any-session")).toMatch(/^run_[0-9a-f]{16}$/);
  });

  it("is deterministic — same input always gives same output", () => {
    expect(deriveSessionRunId("same-session")).toBe(deriveSessionRunId("same-session"));
  });

  it("produces different IDs for different session IDs", () => {
    expect(deriveSessionRunId("session-aaa")).not.toBe(deriveSessionRunId("session-bbb"));
  });

  it("uses the sha256('run:<sessionId>')[0:16] formula", () => {
    const sessionId = "test-session-id";
    const expected = `run_${sha256(`run:${sessionId}`).slice(0, 16)}`;
    expect(deriveSessionRunId(sessionId)).toBe(expected);
  });
});

// ─── buildMetadata ──────────────────────────────────────────────────────────

describe("buildMetadata", () => {
  it("uses provided source verbatim", () => {
    const meta = buildMetadata(entry({ slug: "my-proj" }), "vscode");
    expect(meta.source).toBe("vscode");
  });

  it("defaults source to 'cli' when omitted", () => {
    const meta = buildMetadata(entry({ slug: "my-proj" }));
    expect(meta.source).toBe("cli");
  });

  it("prefers entry.slug as the name", () => {
    const meta = buildMetadata(entry({ slug: "my-slug", cwd: "/some/path" }));
    expect(meta.name).toBe("my-slug");
  });

  it("falls back to basename(cwd) when slug is absent", () => {
    const meta = buildMetadata(entry({ cwd: "/home/user/projects/my-project" }));
    expect(meta.name).toBe("my-project");
  });

  it("falls back to 'claude-agent' when slug and cwd are absent", () => {
    const meta = buildMetadata(entry({}));
    expect(meta.name).toBe("claude-agent");
  });
});

// ─── buildConversationStartedEvent ─────────────────────────────────────────

describe("buildConversationStartedEvent", () => {
  const agentId = "agent_abc123";
  const sessionId = "session-def456";
  const filePath = "/path/to/session.jsonl";

  it("returns type 'conversation.started' and status 'starting'", () => {
    const ev = buildConversationStartedEvent(agentId, sessionId, filePath);
    expect(ev.type).toBe("conversation.started");
    expect(ev.status).toBe("starting");
  });

  it("sets run_id to deriveSessionRunId(sessionId)", () => {
    const ev = buildConversationStartedEvent(agentId, sessionId, filePath);
    expect(ev.run_id).toBe(deriveSessionRunId(sessionId));
  });

  it("sets agent_id to the provided agentId argument", () => {
    const ev = buildConversationStartedEvent(agentId, sessionId, filePath);
    expect(ev.agent_id).toBe(agentId);
  });

  it("sets payload.sessionId to the provided sessionId", () => {
    const ev = buildConversationStartedEvent(agentId, sessionId, filePath);
    expect((ev.payload as Record<string, unknown>).sessionId).toBe(sessionId);
  });

  it("sets agent_metadata.source from source param", () => {
    const ev = buildConversationStartedEvent(agentId, sessionId, filePath, "/cwd", undefined, "vscode");
    expect(ev.agent_metadata?.source).toBe("vscode");
  });

  it("defaults agent_metadata.source to 'cli' when omitted", () => {
    const ev = buildConversationStartedEvent(agentId, sessionId, filePath);
    expect(ev.agent_metadata?.source).toBe("cli");
  });
});

// ─── entryHasToolUse ────────────────────────────────────────────────────────

describe("entryHasToolUse", () => {
  it("returns false for entries with no message field", () => {
    expect(entryHasToolUse(entry({}))).toBe(false);
  });

  it("returns false for messages with only text blocks", () => {
    const e = entry({
      message: {
        role: "assistant",
        content: [
          { type: "text", text: "Hello, world!" },
          { type: "text", text: "Another text block" },
        ],
      },
    });
    expect(entryHasToolUse(e)).toBe(false);
  });

  it("returns false for non-array message content", () => {
    const e = entry({ message: { role: "user", content: "plain text" } });
    expect(entryHasToolUse(e)).toBe(false);
  });

  it("returns true when content contains a tool_use block", () => {
    const e = entry({
      message: {
        role: "assistant",
        content: [
          { type: "text", text: "I'll use a tool" },
          { type: "tool_use", id: "call_123", name: "bash", input: {} },
        ],
      },
    });
    expect(entryHasToolUse(e)).toBe(true);
  });

  it("returns true even when tool_use is the only block", () => {
    const e = entry({
      message: {
        role: "assistant",
        content: [{ type: "tool_use", id: "call_456", name: "read_file", input: {} }],
      },
    });
    expect(entryHasToolUse(e)).toBe(true);
  });
});

// ─── buildConversationTurnEvents ────────────────────────────────────────────

describe("buildConversationTurnEvents", () => {
  const filePath = "/path/to/file.jsonl";
  const runId = "run_test123";

  it("returns [] for entries with no message field", () => {
    expect(buildConversationTurnEvents(entry({}), filePath, runId)).toEqual([]);
  });

  it("returns [] for messages with no role", () => {
    const e = entry({ message: { content: "text" } });
    expect(buildConversationTurnEvents(e, filePath, runId)).toEqual([]);
  });

  it("returns [] when text content is null (tool_use only content)", () => {
    const e = entry({
      message: {
        role: "assistant",
        content: [{ type: "tool_use", id: "x", name: "bash", input: {} }],
      },
    });
    expect(buildConversationTurnEvents(e, filePath, runId)).toEqual([]);
  });

  it("returns [] when content is an empty array", () => {
    const e = entry({ message: { role: "user", content: [] } });
    expect(buildConversationTurnEvents(e, filePath, runId)).toEqual([]);
  });

  it("returns one conversation.turn event for a user message with text", () => {
    const e = entry({
      sessionId: "sess-1",
      message: { role: "user", content: "Hello Claude!" },
    });
    const events = buildConversationTurnEvents(e, filePath, runId);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("conversation.turn");
  });

  it("sets direction 'to_agent' for role 'user'", () => {
    const e = entry({
      sessionId: "sess-1",
      message: { role: "user", content: "user message" },
    });
    const events = buildConversationTurnEvents(e, filePath, runId);
    const payload = events[0].payload as Record<string, unknown>;
    expect(payload.direction).toBe("to_agent");
  });

  it("sets direction 'from_agent' for role 'assistant'", () => {
    const e = entry({
      sessionId: "sess-1",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "Here is my response." }],
      },
    });
    const events = buildConversationTurnEvents(e, filePath, runId);
    const payload = events[0].payload as Record<string, unknown>;
    expect(payload.direction).toBe("from_agent");
  });

  it("includes the text content in the payload", () => {
    const e = entry({
      sessionId: "sess-1",
      message: { role: "user", content: "What is 2+2?" },
    });
    const events = buildConversationTurnEvents(e, filePath, runId);
    const payload = events[0].payload as Record<string, unknown>;
    expect(payload.content).toBe("What is 2+2?");
  });
});

// ─── buildTurnEndedEvent ────────────────────────────────────────────────────

describe("buildTurnEndedEvent", () => {
  const filePath = "/path/to/file.jsonl";
  const runId = "run_ended_test";
  const e = entry({ sessionId: "sess-end", timestamp: "2024-01-01T00:00:00.000Z" });

  it("returns type 'run.ended' and status 'idle'", () => {
    const ev = buildTurnEndedEvent(e, filePath, runId, 1234);
    expect(ev.type).toBe("run.ended");
    expect(ev.status).toBe("idle");
  });

  it("sets duration_ms to the provided durationMs argument", () => {
    const ev = buildTurnEndedEvent(e, filePath, runId, 5000);
    expect(ev.duration_ms).toBe(5000);
  });

  it("uses the provided runId", () => {
    const ev = buildTurnEndedEvent(e, filePath, runId, 100);
    expect(ev.run_id).toBe(runId);
  });
});
