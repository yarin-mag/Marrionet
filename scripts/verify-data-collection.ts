#!/usr/bin/env tsx
/**
 * Marionette Data Collection Verification Script
 *
 * Usage:
 *   npx tsx scripts/verify-data-collection.ts                      # unit tests only
 *   npx tsx scripts/verify-data-collection.ts --mode integration   # full pipeline
 *   npx tsx scripts/verify-data-collection.ts --mode integration --no-cleanup
 */

import { createHash } from "node:crypto";
import { basename } from "node:path";
import {
  buildConversationStartedEvent,
  buildRunStartedEvent,
  buildLlmCallEvent,
  buildTurnEndedEvent,
  buildConversationTurnEvents,
  buildAwaitingInputEvent,
  buildToolResultEvent,
  buildDisconnectedEvent,
  entryHasToolUse,
  deriveAgentId,
  deriveSessionRunId,
  buildMetadata,
  type ClaudeJsonlEntry,
} from "../packages/file-watcher/src/event-mapper.js";
import {
  calculateCost,
  deriveAgentIdFromSession,
  generateRunId,
  type MarionetteEvent,
  type AgentSnapshot,
} from "../packages/shared/src/index.js";

// ─── CLI args ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const mode: "unit" | "integration" = args.includes("--mode")
  ? (args[args.indexOf("--mode") + 1] as "unit" | "integration")
  : "unit";
const cleanup = !args.includes("--no-cleanup");
const SERVER = "http://localhost:8787";

// ─── Types ───────────────────────────────────────────────────────────────────

interface TestResult {
  passed: boolean;
  detail?: string;
}

interface TestCase {
  name: string;
  mode: "unit" | "integration" | "both";
  run: () => Promise<TestResult> | TestResult;
}

interface TestCategory {
  name: string;
  displayName: string;
  reliability: "HIGH" | "MEDIUM" | "LOW";
  tests: TestCase[];
}

interface CategoryResult {
  displayName: string;
  reliability: string;
  passed: number;
  total: number;
  score: number;
  failures: string[];
  skipped: boolean;
}

// ─── Synthetic data factory ───────────────────────────────────────────────────

const TEST_SESSION_ID = `verify-test-session-${Date.now()}`;
const TEST_FILE_PATH = `/fake/.claude/projects/verify-test/verify-${Date.now()}.jsonl`;

function makeUserEntry(overrides: Partial<ClaudeJsonlEntry> = {}): ClaudeJsonlEntry {
  return {
    type: "user",
    sessionId: TEST_SESSION_ID,
    slug: "verify-test",
    cwd: "/fake/verify-test",
    uuid: `uuid-user-${Math.random().toString(36).slice(2, 9)}`,
    timestamp: new Date().toISOString(),
    message: {
      role: "user",
      content: "Hello Claude, please help me with something important!",
    },
    ...overrides,
  };
}

function makeAssistantEntry(overrides: Partial<ClaudeJsonlEntry> = {}): ClaudeJsonlEntry {
  return {
    type: "assistant",
    sessionId: TEST_SESSION_ID,
    slug: "verify-test",
    cwd: "/fake/verify-test",
    uuid: `uuid-asst-${Math.random().toString(36).slice(2, 9)}`,
    timestamp: new Date().toISOString(),
    message: {
      role: "assistant",
      content: [{ type: "text", text: "I can help you with that!" }],
      usage: {
        input_tokens: 100,
        output_tokens: 50,
        cache_creation_input_tokens: 25,
        cache_read_input_tokens: 10,
      },
    },
    ...overrides,
  };
}

function makeTurnDurationEntry(
  durationMs: number,
  overrides: Partial<ClaudeJsonlEntry> = {}
): ClaudeJsonlEntry {
  return {
    type: "system",
    subtype: "turn_duration",
    sessionId: TEST_SESSION_ID,
    timestamp: new Date().toISOString(),
    durationMs,
    ...overrides,
  };
}

// ─── Integration helpers ──────────────────────────────────────────────────────

const registeredAgentIds = new Set<string>();

async function postEvent(event: MarionetteEvent): Promise<void> {
  const res = await fetch(`${SERVER}/api/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST /api/events ${res.status}: ${text}`);
  }
  if (event.agent_id) registeredAgentIds.add(event.agent_id);
}

async function postEvents(events: MarionetteEvent[]): Promise<void> {
  const res = await fetch(`${SERVER}/api/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(events),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST /api/events (batch) ${res.status}: ${text}`);
  }
  for (const e of events) {
    if (e.agent_id) registeredAgentIds.add(e.agent_id);
  }
}

async function getAgent(agentId: string): Promise<AgentSnapshot | null> {
  const res = await fetch(`${SERVER}/api/agents/${agentId}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET /api/agents/${agentId} ${res.status}`);
  return res.json() as Promise<AgentSnapshot>;
}

async function getEvents(
  agentId: string,
  type?: string
): Promise<MarionetteEvent[]> {
  const url = new URL(`${SERVER}/api/events`);
  url.searchParams.set("agent_id", agentId);
  if (type) url.searchParams.set("type", type);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`GET /api/events ${res.status}`);
  const data = await res.json() as { events?: MarionetteEvent[] } | MarionetteEvent[];
  return Array.isArray(data) ? data : (data as { events: MarionetteEvent[] }).events ?? [];
}

async function deleteAgent(agentId: string): Promise<void> {
  const res = await fetch(`${SERVER}/api/agents/${agentId}`, { method: "DELETE" });
  // 404 is fine — agent may have already been deleted
  if (!res.ok && res.status !== 404) {
    throw new Error(`DELETE /api/agents/${agentId} ${res.status}`);
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Wait briefly for server to persist event */
async function settle(): Promise<void> {
  await sleep(150);
}

// ─── Helper: build a conversation.started integration event ──────────────────

function makeConversationStartedEvent(agentId: string, sessionId: string): MarionetteEvent {
  return buildConversationStartedEvent(agentId, sessionId, TEST_FILE_PATH, "/fake/cwd");
}

// ─── Category 1: Agent Status Transitions ────────────────────────────────────

function statusTransitionTests(): TestCase[] {
  const fp = TEST_FILE_PATH;
  const runId = generateRunId();

  return [
    // Unit tests
    {
      name: "buildConversationStartedEvent → type=conversation.started, status=starting",
      mode: "unit",
      run(): TestResult {
        const ev = buildConversationStartedEvent("agent_test", "sess123", fp);
        if (ev.type !== "conversation.started") return { passed: false, detail: `type=${ev.type}` };
        if (ev.status !== "starting") return { passed: false, detail: `status=${ev.status}` };
        return { passed: true };
      },
    },
    {
      name: "buildRunStartedEvent → status=working",
      mode: "unit",
      run(): TestResult {
        const entry = makeUserEntry();
        const [ev] = buildRunStartedEvent(entry, fp);
        if (ev.status !== "working") return { passed: false, detail: `status=${ev.status}` };
        if (ev.type !== "run.started") return { passed: false, detail: `type=${ev.type}` };
        return { passed: true };
      },
    },
    {
      name: "buildTurnEndedEvent → type=run.ended, status=idle",
      mode: "unit",
      run(): TestResult {
        const entry = makeAssistantEntry();
        const ev = buildTurnEndedEvent(entry, fp, runId, 1000);
        if (ev.type !== "run.ended") return { passed: false, detail: `type=${ev.type}` };
        if (ev.status !== "idle") return { passed: false, detail: `status=${ev.status}` };
        return { passed: true };
      },
    },
    {
      name: "buildAwaitingInputEvent → status=awaiting_input",
      mode: "unit",
      run(): TestResult {
        const entry = makeAssistantEntry({
          message: {
            role: "assistant",
            content: [{ type: "tool_use", id: "call_1", name: "bash", input: {} }],
          },
        });
        const ev = buildAwaitingInputEvent(entry, fp, runId);
        if (ev.status !== "awaiting_input") return { passed: false, detail: `status=${ev.status}` };
        if (ev.type !== "agent.status") return { passed: false, detail: `type=${ev.type}` };
        return { passed: true };
      },
    },
    {
      name: "buildToolResultEvent → status=working",
      mode: "unit",
      run(): TestResult {
        const entry = makeUserEntry({ toolUseResult: { content: "ok" } });
        const ev = buildToolResultEvent(entry, fp, runId);
        if (ev.status !== "working") return { passed: false, detail: `status=${ev.status}` };
        if (ev.type !== "agent.status") return { passed: false, detail: `type=${ev.type}` };
        return { passed: true };
      },
    },
    {
      name: "buildDisconnectedEvent → status=disconnected",
      mode: "unit",
      run(): TestResult {
        const ev = buildDisconnectedEvent("agent_xyz", runId, { name: "test" });
        if (ev.status !== "disconnected") return { passed: false, detail: `status=${ev.status}` };
        if (ev.type !== "agent.disconnected") return { passed: false, detail: `type=${ev.type}` };
        return { passed: true };
      },
    },
    // Integration tests
    {
      name: "[integration] conversation.started → DB status=starting",
      mode: "integration",
      async run(): Promise<TestResult> {
        const agentId = `agent_verify_status_${Date.now()}`;
        const sessionId = `sess_status_${Date.now()}`;
        const ev = makeConversationStartedEvent(agentId, sessionId);
        await postEvent(ev);
        await settle();
        const agent = await getAgent(agentId);
        if (!agent) return { passed: false, detail: "agent not found after conversation.started" };
        if (agent.status !== "starting") return { passed: false, detail: `status=${agent.status}` };
        return { passed: true };
      },
    },
    {
      name: "[integration] run.started → DB status=working",
      mode: "integration",
      async run(): Promise<TestResult> {
        const agentId = `agent_verify_working_${Date.now()}`;
        const sessionId = `sess_working_${Date.now()}`;
        // First create the agent
        await postEvent(makeConversationStartedEvent(agentId, sessionId));
        await settle();
        // Then mark working
        const entry = makeUserEntry({ sessionId, agentId: undefined });
        const [runStarted] = buildRunStartedEvent(entry, fp);
        const event: MarionetteEvent = { ...runStarted, agent_id: agentId };
        await postEvent(event);
        await settle();
        const agent = await getAgent(agentId);
        if (!agent) return { passed: false, detail: "agent not found" };
        if (agent.status !== "working") return { passed: false, detail: `status=${agent.status}` };
        return { passed: true };
      },
    },
    {
      name: "[integration] run.ended → DB status=idle",
      mode: "integration",
      async run(): Promise<TestResult> {
        const agentId = `agent_verify_idle_${Date.now()}`;
        const sessionId = `sess_idle_${Date.now()}`;
        await postEvent(makeConversationStartedEvent(agentId, sessionId));
        await settle();
        const entry = makeAssistantEntry({ sessionId });
        const runId2 = generateRunId();
        const ended = buildTurnEndedEvent(entry, fp, runId2, 500);
        await postEvent({ ...ended, agent_id: agentId });
        await settle();
        const agent = await getAgent(agentId);
        if (!agent) return { passed: false, detail: "agent not found" };
        if (agent.status !== "idle") return { passed: false, detail: `status=${agent.status}` };
        return { passed: true };
      },
    },
    {
      name: "[integration] agent.status awaiting_input → DB status=awaiting_input",
      mode: "integration",
      async run(): Promise<TestResult> {
        const agentId = `agent_verify_await_${Date.now()}`;
        const sessionId = `sess_await_${Date.now()}`;
        await postEvent(makeConversationStartedEvent(agentId, sessionId));
        await settle();
        const entry = makeAssistantEntry({
          sessionId,
          message: {
            role: "assistant",
            content: [{ type: "tool_use", id: "call_1", name: "bash", input: {} }],
          },
        });
        const awaiting = buildAwaitingInputEvent(entry, fp, generateRunId());
        await postEvent({ ...awaiting, agent_id: agentId });
        await settle();
        const agent = await getAgent(agentId);
        if (!agent) return { passed: false, detail: "agent not found" };
        if (agent.status !== "awaiting_input") return { passed: false, detail: `status=${agent.status}` };
        return { passed: true };
      },
    },
  ];
}

// ─── Category 2: Token Tracking ───────────────────────────────────────────────

function tokenTrackingTests(): TestCase[] {
  const fp = TEST_FILE_PATH;
  const runId = generateRunId();

  return [
    {
      name: "buildLlmCallEvent total_tokens = input+output+cache_creation+cache_read",
      mode: "unit",
      run(): TestResult {
        const entry = makeAssistantEntry({
          message: {
            role: "assistant",
            content: [{ type: "text", text: "response" }],
            usage: {
              input_tokens: 100,
              output_tokens: 50,
              cache_creation_input_tokens: 25,
              cache_read_input_tokens: 10,
            },
          },
        });
        const ev = buildLlmCallEvent(entry, fp, runId);
        const expected = 185;
        if (ev.tokens?.total_tokens !== expected) {
          return { passed: false, detail: `total_tokens=${ev.tokens?.total_tokens}, expected ${expected}` };
        }
        return { passed: true };
      },
    },
    {
      name: "buildLlmCallEvent → cost_usd > 0",
      mode: "unit",
      run(): TestResult {
        const entry = makeAssistantEntry({
          message: {
            role: "assistant",
            content: [{ type: "text", text: "response" }],
            usage: { input_tokens: 100, output_tokens: 50 },
          },
        });
        const ev = buildLlmCallEvent(entry, fp, runId);
        if (!ev.tokens?.cost_usd || ev.tokens.cost_usd <= 0) {
          return { passed: false, detail: `cost_usd=${ev.tokens?.cost_usd}` };
        }
        return { passed: true };
      },
    },
    {
      name: "Exact cost formula for claude-3-5-sonnet-20241022 with known tokens",
      mode: "unit",
      run(): TestResult {
        // Pricing: input=3.0, output=15.0, cacheWrite=3.75, cacheRead=0.3 per million
        // (100×3.0 + 50×15.0 + 25×3.75 + 10×0.3) / 1_000_000
        // = (300 + 750 + 93.75 + 3) / 1_000_000 = 1146.75 / 1_000_000 ≈ 0.00114675
        const usage = {
          input_tokens: 100,
          output_tokens: 50,
          cache_creation_input_tokens: 25,
          cache_read_input_tokens: 10,
        };
        const cost = calculateCost(usage, "claude-3-5-sonnet-20241022");
        const expected = (100 * 3.0 + 50 * 15.0 + 25 * 3.75 + 10 * 0.3) / 1_000_000;
        const diff = Math.abs(cost - expected);
        if (diff > 1e-10) {
          return { passed: false, detail: `cost=${cost}, expected≈${expected}, diff=${diff}` };
        }
        return { passed: true };
      },
    },
    {
      name: "calculateCost({}, undefined) → returns a number, does not throw",
      mode: "unit",
      run(): TestResult {
        try {
          const cost = calculateCost({}, undefined);
          if (typeof cost !== "number") return { passed: false, detail: `returned ${typeof cost}` };
          return { passed: true };
        } catch (err) {
          return { passed: false, detail: `threw: ${err}` };
        }
      },
    },
    {
      name: "Assistant entry with no usage → total_tokens === 0",
      mode: "unit",
      run(): TestResult {
        const entry = makeAssistantEntry({
          message: {
            role: "assistant",
            content: [{ type: "text", text: "hi" }],
            // no usage field
          },
        });
        const ev = buildLlmCallEvent(entry, fp, runId);
        if (ev.tokens?.total_tokens !== 0) {
          return { passed: false, detail: `total_tokens=${ev.tokens?.total_tokens}` };
        }
        return { passed: true };
      },
    },
    // Integration tests
    {
      name: "[integration] POST llm.call total_tokens=185 → agent total_tokens >= 185",
      mode: "integration",
      async run(): Promise<TestResult> {
        const agentId = `agent_verify_tok_${Date.now()}`;
        const sessionId = `sess_tok_${Date.now()}`;
        await postEvent(makeConversationStartedEvent(agentId, sessionId));
        await settle();
        const entry = makeAssistantEntry({
          sessionId,
          message: {
            role: "assistant",
            content: [{ type: "text", text: "response" }],
            usage: {
              input_tokens: 100,
              output_tokens: 50,
              cache_creation_input_tokens: 25,
              cache_read_input_tokens: 10,
            },
          },
        });
        const llmEvent = buildLlmCallEvent(entry, fp, generateRunId());
        await postEvent({ ...llmEvent, agent_id: agentId });
        await settle();
        const agent = await getAgent(agentId);
        if (!agent) return { passed: false, detail: "agent not found" };
        if (agent.total_tokens < 185) {
          return { passed: false, detail: `total_tokens=${agent.total_tokens}, expected >= 185` };
        }
        return { passed: true };
      },
    },
    {
      name: "[integration] POST second llm.call total_tokens=100 → total_tokens >= 285",
      mode: "integration",
      async run(): Promise<TestResult> {
        const agentId = `agent_verify_tok2_${Date.now()}`;
        const sessionId = `sess_tok2_${Date.now()}`;
        await postEvent(makeConversationStartedEvent(agentId, sessionId));
        await settle();
        const fp2 = TEST_FILE_PATH;
        const makeEntry = (tokens: {
          input_tokens: number; output_tokens: number;
          cache_creation_input_tokens: number; cache_read_input_tokens: number;
        }) => makeAssistantEntry({
          sessionId,
          message: {
            role: "assistant",
            content: [{ type: "text", text: "response" }],
            usage: tokens,
          },
        });
        const e1 = buildLlmCallEvent(makeEntry({ input_tokens: 100, output_tokens: 50, cache_creation_input_tokens: 25, cache_read_input_tokens: 10 }), fp2, generateRunId());
        const e2 = buildLlmCallEvent(makeEntry({ input_tokens: 80, output_tokens: 20, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 }), fp2, generateRunId());
        await postEvent({ ...e1, agent_id: agentId });
        await settle();
        await postEvent({ ...e2, agent_id: agentId });
        await settle();
        const agent = await getAgent(agentId);
        if (!agent) return { passed: false, detail: "agent not found" };
        if (agent.total_tokens < 285) {
          return { passed: false, detail: `total_tokens=${agent.total_tokens}, expected >= 285` };
        }
        return { passed: true };
      },
    },
    {
      name: "[integration] session_tokens accumulates separately from total_tokens",
      mode: "integration",
      async run(): Promise<TestResult> {
        const agentId = `agent_verify_stok_${Date.now()}`;
        const sessionId = `sess_stok_${Date.now()}`;
        await postEvent(makeConversationStartedEvent(agentId, sessionId));
        await settle();
        const entry = makeAssistantEntry({
          sessionId,
          message: {
            role: "assistant",
            content: [{ type: "text", text: "response" }],
            usage: { input_tokens: 50, output_tokens: 30, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
          },
        });
        const ev = buildLlmCallEvent(entry, fp, generateRunId());
        await postEvent({ ...ev, agent_id: agentId });
        await settle();
        const agent = await getAgent(agentId);
        if (!agent) return { passed: false, detail: "agent not found" };
        if (agent.session_tokens < 80) {
          return { passed: false, detail: `session_tokens=${agent.session_tokens}, expected >= 80` };
        }
        return { passed: true };
      },
    },
    {
      name: "[integration] total_tokens and session_tokens are consistent",
      mode: "integration",
      async run(): Promise<TestResult> {
        const agentId = `agent_verify_totok_${Date.now()}`;
        const sessionId = `sess_totok_${Date.now()}`;
        await postEvent(makeConversationStartedEvent(agentId, sessionId));
        await settle();
        const entry = makeAssistantEntry({
          sessionId,
          message: {
            role: "assistant",
            content: [{ type: "text", text: "response" }],
            usage: { input_tokens: 200, output_tokens: 100, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
          },
        });
        const ev = buildLlmCallEvent(entry, fp, generateRunId());
        await postEvent({ ...ev, agent_id: agentId });
        await settle();
        const agent = await getAgent(agentId);
        if (!agent) return { passed: false, detail: "agent not found" };
        if (agent.total_tokens !== agent.session_tokens) {
          return { passed: false, detail: `total_tokens=${agent.total_tokens} !== session_tokens=${agent.session_tokens} (fresh agent)` };
        }
        return { passed: true };
      },
    },
  ];
}

// ─── Category 3: Conversation Turn Capture ───────────────────────────────────

function conversationCaptureTests(): TestCase[] {
  const fp = TEST_FILE_PATH;
  const runId = generateRunId();

  return [
    {
      name: "User string-content message → direction=to_agent, content matches",
      mode: "unit",
      run(): TestResult {
        const entry = makeUserEntry({ message: { role: "user", content: "Hello Claude!" } });
        const events = buildConversationTurnEvents(entry, fp, runId);
        if (events.length !== 1) return { passed: false, detail: `expected 1 event, got ${events.length}` };
        const payload = events[0].payload as Record<string, unknown>;
        if (payload.direction !== "to_agent") return { passed: false, detail: `direction=${payload.direction}` };
        if (payload.content !== "Hello Claude!") return { passed: false, detail: `content=${payload.content}` };
        return { passed: true };
      },
    },
    {
      name: "Assistant array-content message → direction=from_agent, text extracted",
      mode: "unit",
      run(): TestResult {
        const entry = makeAssistantEntry({
          message: {
            role: "assistant",
            content: [{ type: "text", text: "Here is my response." }],
          },
        });
        const events = buildConversationTurnEvents(entry, fp, runId);
        if (events.length !== 1) return { passed: false, detail: `expected 1 event, got ${events.length}` };
        const payload = events[0].payload as Record<string, unknown>;
        if (payload.direction !== "from_agent") return { passed: false, detail: `direction=${payload.direction}` };
        if (payload.content !== "Here is my response.") return { passed: false, detail: `content=${payload.content}` };
        return { passed: true };
      },
    },
    {
      name: "Assistant with only tool_use block → no conversation.turn emitted",
      mode: "unit",
      run(): TestResult {
        const entry = makeAssistantEntry({
          message: {
            role: "assistant",
            content: [{ type: "tool_use", id: "x", name: "bash", input: {} }],
          },
        });
        const events = buildConversationTurnEvents(entry, fp, runId);
        if (events.length !== 0) return { passed: false, detail: `expected 0 events, got ${events.length}` };
        return { passed: true };
      },
    },
    {
      name: "Mixed tool_use+text content → turn emitted with only the text",
      mode: "unit",
      run(): TestResult {
        const entry = makeAssistantEntry({
          message: {
            role: "assistant",
            content: [
              { type: "tool_use", id: "x", name: "bash", input: {} },
              { type: "text", text: "Here is what I found." },
            ],
          },
        });
        const events = buildConversationTurnEvents(entry, fp, runId);
        if (events.length !== 1) return { passed: false, detail: `expected 1 event, got ${events.length}` };
        const payload = events[0].payload as Record<string, unknown>;
        if (payload.content !== "Here is what I found.") {
          return { passed: false, detail: `content=${payload.content}` };
        }
        return { passed: true };
      },
    },
    {
      name: "Empty array content → no conversation.turn",
      mode: "unit",
      run(): TestResult {
        const entry = makeUserEntry({ message: { role: "user", content: [] } });
        const events = buildConversationTurnEvents(entry, fp, runId);
        if (events.length !== 0) return { passed: false, detail: `expected 0 events, got ${events.length}` };
        return { passed: true };
      },
    },
    {
      name: "User entry with toolUseResult + tool_result blocks → no turn emitted",
      mode: "unit",
      run(): TestResult {
        const entry = makeUserEntry({
          toolUseResult: { content: "tool result content" },
          message: {
            role: "user",
            content: [{ type: "tool_result", tool_use_id: "x", content: "result" }],
          },
        });
        const events = buildConversationTurnEvents(entry, fp, runId);
        if (events.length !== 0) return { passed: false, detail: `expected 0 events (tool_result has no text type), got ${events.length}` };
        return { passed: true };
      },
    },
    {
      name: "payload.direction: to_agent for user, from_agent for assistant",
      mode: "unit",
      run(): TestResult {
        const userEntry = makeUserEntry({ message: { role: "user", content: "user msg" } });
        const assistantEntry = makeAssistantEntry({
          message: { role: "assistant", content: [{ type: "text", text: "assistant msg" }] },
        });
        const userEvents = buildConversationTurnEvents(userEntry, fp, runId);
        const assistantEvents = buildConversationTurnEvents(assistantEntry, fp, runId);
        const uDir = (userEvents[0]?.payload as Record<string, unknown>)?.direction;
        const aDir = (assistantEvents[0]?.payload as Record<string, unknown>)?.direction;
        if (uDir !== "to_agent") return { passed: false, detail: `user direction=${uDir}` };
        if (aDir !== "from_agent") return { passed: false, detail: `assistant direction=${aDir}` };
        return { passed: true };
      },
    },
  ];
}

// ─── Category 4: Agent Metadata ───────────────────────────────────────────────

function agentMetadataTests(): TestCase[] {
  return [
    {
      name: "buildMetadata with slug → name uses slug",
      mode: "unit",
      run(): TestResult {
        const meta = buildMetadata({ slug: "my-project", cwd: "/some/path" });
        if (meta.name !== "my-project") return { passed: false, detail: `name=${meta.name}` };
        return { passed: true };
      },
    },
    {
      name: "buildMetadata without slug, with cwd → name=basename(cwd)",
      mode: "unit",
      run(): TestResult {
        const meta = buildMetadata({ cwd: "/home/user/my-project" });
        if (meta.name !== "my-project") return { passed: false, detail: `name=${meta.name}` };
        return { passed: true };
      },
    },
    {
      name: "buildMetadata without slug or cwd → name='claude-agent'",
      mode: "unit",
      run(): TestResult {
        const meta = buildMetadata({});
        if (meta.name !== "claude-agent") return { passed: false, detail: `name=${meta.name}` };
        return { passed: true };
      },
    },
    {
      name: "buildMetadata cwd and version fields appear in metadata",
      mode: "unit",
      run(): TestResult {
        const meta = buildMetadata({ cwd: "/my/path", version: "1.2.3" });
        if (meta.cwd !== "/my/path") return { passed: false, detail: `cwd=${meta.cwd}` };
        if (meta.version !== "1.2.3") return { passed: false, detail: `version=${meta.version}` };
        return { passed: true };
      },
    },
    {
      name: "buildMetadata source='vscode' → metadata.source==='vscode'",
      mode: "unit",
      run(): TestResult {
        const meta = buildMetadata({ slug: "proj" }, "vscode");
        if (meta.source !== "vscode") return { passed: false, detail: `source=${meta.source}` };
        return { passed: true };
      },
    },
    {
      name: "buildMetadata omitted source → metadata.source==='cli'",
      mode: "unit",
      run(): TestResult {
        const meta = buildMetadata({ slug: "proj" });
        if (meta.source !== "cli") return { passed: false, detail: `source=${meta.source}` };
        return { passed: true };
      },
    },
    {
      name: "buildConversationStartedEvent uses basename(cwd) for name, NOT slug",
      mode: "unit",
      run(): TestResult {
        // buildConversationStartedEvent signature: (agentId, sessionId, filePath, cwd?, gitBranch?, source?)
        // It uses basename(cwd) if cwd is set — not slug
        const ev = buildConversationStartedEvent(
          "agent_abc",
          "sess_def",
          "/path/to/session.jsonl",
          "/home/user/my-specific-project"
        );
        const expectedName = "my-specific-project";
        if (ev.agent_metadata?.name !== expectedName) {
          return { passed: false, detail: `name=${ev.agent_metadata?.name}, expected ${expectedName}` };
        }
        return { passed: true };
      },
    },
  ];
}

// ─── Category 5: Run Counters ─────────────────────────────────────────────────

function runCounterTests(): TestCase[] {
  return [
    {
      name: "[integration] conversation.started → total_runs=0, session_runs=0",
      mode: "integration",
      async run(): Promise<TestResult> {
        const agentId = `agent_verify_runs_${Date.now()}`;
        const sessionId = `sess_runs_${Date.now()}`;
        await postEvent(makeConversationStartedEvent(agentId, sessionId));
        await settle();
        const agent = await getAgent(agentId);
        if (!agent) return { passed: false, detail: "agent not found" };
        if (agent.total_runs !== 0) return { passed: false, detail: `total_runs=${agent.total_runs}` };
        if (agent.session_runs !== 0) return { passed: false, detail: `session_runs=${agent.session_runs}` };
        return { passed: true };
      },
    },
    {
      name: "[integration] run.started alone does NOT increment total_runs",
      mode: "integration",
      async run(): Promise<TestResult> {
        const agentId = `agent_verify_rs_${Date.now()}`;
        const sessionId = `sess_rs_${Date.now()}`;
        await postEvent(makeConversationStartedEvent(agentId, sessionId));
        await settle();
        const runId2 = generateRunId();
        const runStarted: MarionetteEvent = {
          agent_id: agentId,
          run_id: runId2,
          type: "run.started",
          ts: new Date().toISOString(),
          summary: "run started",
          status: "working",
        };
        await postEvent(runStarted);
        await settle();
        const agent = await getAgent(agentId);
        if (!agent) return { passed: false, detail: "agent not found" };
        if (agent.total_runs !== 0) {
          return { passed: false, detail: `run.started incremented total_runs to ${agent.total_runs} (design intent: only run.ended counts)` };
        }
        return { passed: true };
      },
    },
    {
      name: "[integration] run.ended → total_runs=1, session_runs=1",
      mode: "integration",
      async run(): Promise<TestResult> {
        const agentId = `agent_verify_re_${Date.now()}`;
        const sessionId = `sess_re_${Date.now()}`;
        await postEvent(makeConversationStartedEvent(agentId, sessionId));
        await settle();
        const runId2 = generateRunId();
        const runEnded: MarionetteEvent = {
          agent_id: agentId,
          run_id: runId2,
          type: "run.ended",
          ts: new Date().toISOString(),
          summary: "run ended",
          status: "idle",
          duration_ms: 1000,
        };
        await postEvent(runEnded);
        await settle();
        const agent = await getAgent(agentId);
        if (!agent) return { passed: false, detail: "agent not found" };
        if (agent.total_runs !== 1) return { passed: false, detail: `total_runs=${agent.total_runs}, expected 1` };
        if (agent.session_runs !== 1) return { passed: false, detail: `session_runs=${agent.session_runs}, expected 1` };
        return { passed: true };
      },
    },
    {
      name: "[integration] 2× run.started+run.ended → total_runs=2, session_runs=2",
      mode: "integration",
      async run(): Promise<TestResult> {
        const agentId = `agent_verify_2r_${Date.now()}`;
        const sessionId = `sess_2r_${Date.now()}`;
        await postEvent(makeConversationStartedEvent(agentId, sessionId));
        await settle();
        for (let i = 0; i < 2; i++) {
          const runId2 = generateRunId();
          await postEvent({
            agent_id: agentId, run_id: runId2, type: "run.started",
            ts: new Date().toISOString(), summary: "run started", status: "working",
          });
          await settle();
          await postEvent({
            agent_id: agentId, run_id: runId2, type: "run.ended",
            ts: new Date().toISOString(), summary: "run ended", status: "idle", duration_ms: 500,
          });
          await settle();
        }
        const agent = await getAgent(agentId);
        if (!agent) return { passed: false, detail: "agent not found" };
        if (agent.total_runs !== 2) return { passed: false, detail: `total_runs=${agent.total_runs}, expected 2` };
        if (agent.session_runs !== 2) return { passed: false, detail: `session_runs=${agent.session_runs}, expected 2` };
        return { passed: true };
      },
    },
    {
      name: "[integration] run.started produces no counter side-effect (design intent)",
      mode: "integration",
      async run(): Promise<TestResult> {
        const agentId = `agent_verify_rsnc_${Date.now()}`;
        const sessionId = `sess_rsnc_${Date.now()}`;
        await postEvent(makeConversationStartedEvent(agentId, sessionId));
        await settle();
        // Post multiple run.started events
        for (let i = 0; i < 3; i++) {
          await postEvent({
            agent_id: agentId, run_id: generateRunId(), type: "run.started",
            ts: new Date().toISOString(), summary: "run started", status: "working",
          });
          await settle();
        }
        const agent = await getAgent(agentId);
        if (!agent) return { passed: false, detail: "agent not found" };
        if (agent.total_runs !== 0) {
          return { passed: false, detail: `total_runs=${agent.total_runs} after 3× run.started — should be 0 (run.ended increments)` };
        }
        return { passed: true };
      },
    },
  ];
}

// ─── Category 6: Duration Tracking ───────────────────────────────────────────

function durationTrackingTests(): TestCase[] {
  const fp = TEST_FILE_PATH;
  const runId = generateRunId();

  return [
    {
      name: "buildTurnEndedEvent with durationMs=5432 → event.duration_ms === 5432",
      mode: "unit",
      run(): TestResult {
        const entry = makeAssistantEntry();
        const ev = buildTurnEndedEvent(entry, fp, runId, 5432);
        if (ev.duration_ms !== 5432) return { passed: false, detail: `duration_ms=${ev.duration_ms}` };
        return { passed: true };
      },
    },
    {
      name: "buildTurnEndedEvent with durationMs=0 → event.duration_ms === 0",
      mode: "unit",
      run(): TestResult {
        const entry = makeAssistantEntry();
        const ev = buildTurnEndedEvent(entry, fp, runId, 0);
        if (ev.duration_ms !== 0) return { passed: false, detail: `duration_ms=${ev.duration_ms}` };
        return { passed: true };
      },
    },
    {
      name: "makeTurnDurationEntry durationMs is numeric (watcher read path)",
      mode: "unit",
      run(): TestResult {
        const entry = makeTurnDurationEntry(9999);
        if (typeof entry.durationMs !== "number") return { passed: false, detail: `durationMs type=${typeof entry.durationMs}` };
        if (entry.durationMs !== 9999) return { passed: false, detail: `durationMs=${entry.durationMs}` };
        return { passed: true };
      },
    },
    // Integration tests
    {
      name: "[integration] POST run.ended duration_ms=5432 → total_duration_ms >= 5432",
      mode: "integration",
      async run(): Promise<TestResult> {
        const agentId = `agent_verify_dur_${Date.now()}`;
        const sessionId = `sess_dur_${Date.now()}`;
        await postEvent(makeConversationStartedEvent(agentId, sessionId));
        await settle();
        await postEvent({
          agent_id: agentId, run_id: generateRunId(), type: "run.ended",
          ts: new Date().toISOString(), summary: "run ended", status: "idle", duration_ms: 5432,
        });
        await settle();
        const agent = await getAgent(agentId);
        if (!agent) return { passed: false, detail: "agent not found" };
        if (agent.total_duration_ms < 5432) {
          return { passed: false, detail: `total_duration_ms=${agent.total_duration_ms}, expected >= 5432` };
        }
        return { passed: true };
      },
    },
    {
      name: "[integration] POST second run.ended duration_ms=1000 → total_duration_ms >= 6432",
      mode: "integration",
      async run(): Promise<TestResult> {
        const agentId = `agent_verify_dur2_${Date.now()}`;
        const sessionId = `sess_dur2_${Date.now()}`;
        await postEvent(makeConversationStartedEvent(agentId, sessionId));
        await settle();
        await postEvent({
          agent_id: agentId, run_id: generateRunId(), type: "run.ended",
          ts: new Date().toISOString(), summary: "run ended", status: "idle", duration_ms: 5432,
        });
        await settle();
        await postEvent({
          agent_id: agentId, run_id: generateRunId(), type: "run.ended",
          ts: new Date().toISOString(), summary: "run ended", status: "idle", duration_ms: 1000,
        });
        await settle();
        const agent = await getAgent(agentId);
        if (!agent) return { passed: false, detail: "agent not found" };
        if (agent.total_duration_ms < 6432) {
          return { passed: false, detail: `total_duration_ms=${agent.total_duration_ms}, expected >= 6432` };
        }
        return { passed: true };
      },
    },
    {
      name: "[integration] New agent starts at total_duration_ms = 0",
      mode: "integration",
      async run(): Promise<TestResult> {
        const agentId = `agent_verify_dur0_${Date.now()}`;
        const sessionId = `sess_dur0_${Date.now()}`;
        await postEvent(makeConversationStartedEvent(agentId, sessionId));
        await settle();
        const agent = await getAgent(agentId);
        if (!agent) return { passed: false, detail: "agent not found" };
        if (agent.total_duration_ms !== 0) {
          return { passed: false, detail: `total_duration_ms=${agent.total_duration_ms}, expected 0` };
        }
        return { passed: true };
      },
    },
  ];
}

// ─── Category 7: Current Task Extraction ─────────────────────────────────────

function currentTaskTests(): TestCase[] {
  const fp = TEST_FILE_PATH;

  function runStartedTask(content: string): string | undefined {
    const entry = makeUserEntry({ message: { role: "user", content } });
    const [ev] = buildRunStartedEvent(entry, fp);
    return (ev.payload as Record<string, unknown>)?.current_task as string | undefined;
  }

  return [
    {
      name: "25-char message → current_task equals the text",
      mode: "unit",
      run(): TestResult {
        const msg = "A".repeat(25);
        const task = runStartedTask(msg);
        if (task !== msg) return { passed: false, detail: `task=${task}, expected '${msg}'` };
        return { passed: true };
      },
    },
    {
      name: "19-char message (< 20) → no current_task in payload",
      mode: "unit",
      run(): TestResult {
        const msg = "A".repeat(19);
        const task = runStartedTask(msg);
        if (task !== undefined) return { passed: false, detail: `task='${task}', expected undefined` };
        return { passed: true };
      },
    },
    {
      name: "Exactly 20-char message → current_task set, no ellipsis",
      mode: "unit",
      run(): TestResult {
        const msg = "A".repeat(20);
        const task = runStartedTask(msg);
        if (task !== msg) return { passed: false, detail: `task='${task}', expected '${msg}'` };
        if (task && task.endsWith("…")) return { passed: false, detail: "unexpected ellipsis" };
        return { passed: true };
      },
    },
    {
      name: "120-char message → current_task = full 120 chars, no ellipsis",
      mode: "unit",
      run(): TestResult {
        const msg = "A".repeat(120);
        const task = runStartedTask(msg);
        if (!task) return { passed: false, detail: "no current_task" };
        if (task.length !== 120) return { passed: false, detail: `length=${task.length}, expected 120` };
        if (task.endsWith("…")) return { passed: false, detail: "unexpected ellipsis" };
        return { passed: true };
      },
    },
    {
      name: "121-char message → current_task ends with '…', total length 121",
      mode: "unit",
      run(): TestResult {
        const msg = "A".repeat(121);
        const task = runStartedTask(msg);
        if (!task) return { passed: false, detail: "no current_task" };
        if (!task.endsWith("…")) return { passed: false, detail: `does not end with ellipsis: '${task.slice(-5)}'` };
        if (task.length !== 121) return { passed: false, detail: `length=${task.length}, expected 121` };
        return { passed: true };
      },
    },
    {
      name: "200-char message → truncated to 120 chars + '…' = 121 total",
      mode: "unit",
      run(): TestResult {
        const msg = "A".repeat(200);
        const task = runStartedTask(msg);
        if (!task) return { passed: false, detail: "no current_task" };
        if (!task.endsWith("…")) return { passed: false, detail: "does not end with ellipsis" };
        if (task.length !== 121) return { passed: false, detail: `length=${task.length}, expected 121` };
        return { passed: true };
      },
    },
    {
      name: "Empty string content → no current_task",
      mode: "unit",
      run(): TestResult {
        const task = runStartedTask("");
        if (task !== undefined) return { passed: false, detail: `task='${task}', expected undefined` };
        return { passed: true };
      },
    },
  ];
}

// ─── Category 8: Agent ID Stability ──────────────────────────────────────────

function agentIdStabilityTests(): TestCase[] {
  const fp = TEST_FILE_PATH;

  return [
    {
      name: "Same sessionId → same deriveAgentId output (determinism)",
      mode: "unit",
      run(): TestResult {
        const entry1 = makeUserEntry({ sessionId: "stable-session-id" });
        const entry2 = makeUserEntry({ sessionId: "stable-session-id" });
        const id1 = deriveAgentId(entry1, fp);
        const id2 = deriveAgentId(entry2, fp);
        if (id1 !== id2) return { passed: false, detail: `${id1} !== ${id2}` };
        return { passed: true };
      },
    },
    {
      name: "Different sessionId → different agent IDs",
      mode: "unit",
      run(): TestResult {
        const id1 = deriveAgentId({ sessionId: "sess-aaa" }, fp);
        const id2 = deriveAgentId({ sessionId: "sess-bbb" }, fp);
        if (id1 === id2) return { passed: false, detail: "same ID for different sessions" };
        return { passed: true };
      },
    },
    {
      name: "Entry with agentId field → returns agent_<agentId> (subagent path)",
      mode: "unit",
      run(): TestResult {
        const entry = makeUserEntry({ agentId: "my-subagent-123", sessionId: "sess-abc" });
        const id = deriveAgentId(entry, fp);
        if (id !== "agent_my-subagent-123") return { passed: false, detail: `id=${id}` };
        return { passed: true };
      },
    },
    {
      name: "Entry with no agentId, no sessionId → SHA-256 of filePath fallback",
      mode: "unit",
      run(): TestResult {
        const entry: ClaudeJsonlEntry = {};
        const id = deriveAgentId(entry, fp);
        const expected = `agent_${createHash("sha256").update(fp).digest("hex").slice(0, 16)}`;
        if (id !== expected) return { passed: false, detail: `id=${id}, expected ${expected}` };
        return { passed: true };
      },
    },
    {
      name: "deriveAgentIdFromSession(sessionId) matches deriveAgentId({sessionId}, filePath)",
      mode: "unit",
      run(): TestResult {
        const sessionId = "test-session-for-match";
        const fromSession = deriveAgentIdFromSession(sessionId);
        const fromEntry = deriveAgentId({ sessionId }, fp);
        if (fromSession !== fromEntry) {
          return { passed: false, detail: `deriveAgentIdFromSession='${fromSession}' !== deriveAgentId='${fromEntry}'` };
        }
        return { passed: true };
      },
    },
    {
      name: "deriveSessionRunId is deterministic for same sessionId",
      mode: "unit",
      run(): TestResult {
        const id1 = deriveSessionRunId("same-session-x");
        const id2 = deriveSessionRunId("same-session-x");
        if (id1 !== id2) return { passed: false, detail: `${id1} !== ${id2}` };
        return { passed: true };
      },
    },
    {
      name: "deriveSessionRunId format matches /^run_[0-9a-f]{16}$/",
      mode: "unit",
      run(): TestResult {
        const id = deriveSessionRunId("any-session-id");
        if (!/^run_[0-9a-f]{16}$/.test(id)) return { passed: false, detail: `id=${id}` };
        return { passed: true };
      },
    },
  ];
}

// ─── Category 9: Session Counter Reset ───────────────────────────────────────

function sessionCounterResetTests(): TestCase[] {
  return [
    {
      name: "[integration] session A: 2× run.ended → session_runs=2, total_runs=2",
      mode: "integration",
      async run(): Promise<TestResult> {
        const agentId = `agent_verify_scr_${Date.now()}`;
        const sessionIdA = `sess_A_${Date.now()}`;
        await postEvent(makeConversationStartedEvent(agentId, sessionIdA));
        await settle();
        for (let i = 0; i < 2; i++) {
          await postEvent({
            agent_id: agentId, run_id: generateRunId(), type: "run.ended",
            ts: new Date().toISOString(), summary: "run ended", status: "idle", duration_ms: 100,
          });
          await settle();
        }
        const agent = await getAgent(agentId);
        if (!agent) return { passed: false, detail: "agent not found" };
        if (agent.session_runs !== 2) return { passed: false, detail: `session_runs=${agent.session_runs}, expected 2` };
        if (agent.total_runs !== 2) return { passed: false, detail: `total_runs=${agent.total_runs}, expected 2` };
        return { passed: true };
      },
    },
    {
      name: "[integration] New session B (same agent_id, different sessionId) → session_runs=0, total_runs preserved=2",
      mode: "integration",
      async run(): Promise<TestResult> {
        const agentId = `agent_verify_scrb_${Date.now()}`;
        const sessionIdA = `sess_A2_${Date.now()}`;
        const sessionIdB = `sess_B2_${Date.now()}`;
        // Session A: 2 runs
        await postEvent(makeConversationStartedEvent(agentId, sessionIdA));
        await settle();
        for (let i = 0; i < 2; i++) {
          await postEvent({
            agent_id: agentId, run_id: generateRunId(), type: "run.ended",
            ts: new Date().toISOString(), summary: "run ended", status: "idle", duration_ms: 100,
          });
          await settle();
        }
        // Session B: new conversation.started with different sessionId
        await postEvent(makeConversationStartedEvent(agentId, sessionIdB));
        await settle();
        const agent = await getAgent(agentId);
        if (!agent) return { passed: false, detail: "agent not found" };
        if (agent.session_runs !== 0) return { passed: false, detail: `session_runs=${agent.session_runs}, expected 0 (reset on new session)` };
        if (agent.total_runs !== 2) return { passed: false, detail: `total_runs=${agent.total_runs}, expected 2 (preserved across sessions)` };
        return { passed: true };
      },
    },
    {
      name: "[integration] run.ended after session B → session_runs=1, total_runs=3",
      mode: "integration",
      async run(): Promise<TestResult> {
        const agentId = `agent_verify_scrc_${Date.now()}`;
        const sessionIdA = `sess_Ac_${Date.now()}`;
        const sessionIdB = `sess_Bc_${Date.now()}`;
        // Session A: 2 runs
        await postEvent(makeConversationStartedEvent(agentId, sessionIdA));
        await settle();
        for (let i = 0; i < 2; i++) {
          await postEvent({
            agent_id: agentId, run_id: generateRunId(), type: "run.ended",
            ts: new Date().toISOString(), summary: "run ended", status: "idle", duration_ms: 100,
          });
          await settle();
        }
        // Session B
        await postEvent(makeConversationStartedEvent(agentId, sessionIdB));
        await settle();
        // One run in session B
        await postEvent({
          agent_id: agentId, run_id: generateRunId(), type: "run.ended",
          ts: new Date().toISOString(), summary: "run ended", status: "idle", duration_ms: 100,
        });
        await settle();
        const agent = await getAgent(agentId);
        if (!agent) return { passed: false, detail: "agent not found" };
        if (agent.session_runs !== 1) return { passed: false, detail: `session_runs=${agent.session_runs}, expected 1` };
        if (agent.total_runs !== 3) return { passed: false, detail: `total_runs=${agent.total_runs}, expected 3` };
        return { passed: true };
      },
    },
    {
      name: "[integration] conversation.started again with same session B ID → session_runs NOT reset (WS reconnect case)",
      mode: "integration",
      async run(): Promise<TestResult> {
        const agentId = `agent_verify_scrd_${Date.now()}`;
        const sessionIdA = `sess_Ad_${Date.now()}`;
        const sessionIdB = `sess_Bd_${Date.now()}`;
        // Session A → B with 1 run
        await postEvent(makeConversationStartedEvent(agentId, sessionIdA));
        await settle();
        await postEvent(makeConversationStartedEvent(agentId, sessionIdB));
        await settle();
        await postEvent({
          agent_id: agentId, run_id: generateRunId(), type: "run.ended",
          ts: new Date().toISOString(), summary: "run ended", status: "idle", duration_ms: 100,
        });
        await settle();
        // Reconnect: same session B again (WS reconnect)
        await postEvent(makeConversationStartedEvent(agentId, sessionIdB));
        await settle();
        const agent = await getAgent(agentId);
        if (!agent) return { passed: false, detail: "agent not found" };
        // session_runs should still be 1, not reset to 0
        if (agent.session_runs !== 1) {
          return { passed: false, detail: `session_runs=${agent.session_runs}, expected 1 (same session ID → no reset)` };
        }
        return { passed: true };
      },
    },
  ];
}

// ─── Category 10: Tool Use / Awaiting Input ───────────────────────────────────

function toolUseTests(): TestCase[] {
  const fp = TEST_FILE_PATH;
  const runId = generateRunId();

  return [
    {
      name: "entryHasToolUse with [{type:'tool_use',...}] → true",
      mode: "unit",
      run(): TestResult {
        const entry = makeAssistantEntry({
          message: {
            role: "assistant",
            content: [{ type: "tool_use", id: "call_1", name: "bash", input: {} }],
          },
        });
        if (!entryHasToolUse(entry)) return { passed: false, detail: "expected true" };
        return { passed: true };
      },
    },
    {
      name: "entryHasToolUse with [{type:'text',...}] → false",
      mode: "unit",
      run(): TestResult {
        const entry = makeAssistantEntry({
          message: { role: "assistant", content: [{ type: "text", text: "hi" }] },
        });
        if (entryHasToolUse(entry)) return { passed: false, detail: "expected false" };
        return { passed: true };
      },
    },
    {
      name: "entryHasToolUse with string content → false",
      mode: "unit",
      run(): TestResult {
        const entry = makeUserEntry({ message: { role: "user", content: "plain text" } });
        if (entryHasToolUse(entry)) return { passed: false, detail: "expected false" };
        return { passed: true };
      },
    },
    {
      name: "entryHasToolUse with no message → false",
      mode: "unit",
      run(): TestResult {
        const entry: ClaudeJsonlEntry = { type: "system" };
        if (entryHasToolUse(entry)) return { passed: false, detail: "expected false" };
        return { passed: true };
      },
    },
    {
      name: "buildAwaitingInputEvent → type=agent.status, status=awaiting_input",
      mode: "unit",
      run(): TestResult {
        const entry = makeAssistantEntry({
          message: {
            role: "assistant",
            content: [{ type: "tool_use", id: "call_2", name: "read_file", input: {} }],
          },
        });
        const ev = buildAwaitingInputEvent(entry, fp, runId);
        if (ev.type !== "agent.status") return { passed: false, detail: `type=${ev.type}` };
        if (ev.status !== "awaiting_input") return { passed: false, detail: `status=${ev.status}` };
        return { passed: true };
      },
    },
    {
      name: "buildToolResultEvent → type=agent.status, status=working",
      mode: "unit",
      run(): TestResult {
        const entry = makeUserEntry({ toolUseResult: { content: "ok" } });
        const ev = buildToolResultEvent(entry, fp, runId);
        if (ev.type !== "agent.status") return { passed: false, detail: `type=${ev.type}` };
        if (ev.status !== "working") return { passed: false, detail: `status=${ev.status}` };
        return { passed: true };
      },
    },
    {
      name: "buildToolResultEvent accepts a stableRunId param correctly",
      mode: "unit",
      run(): TestResult {
        const stableRunId = deriveSessionRunId("stable-session-for-tool");
        const entry = makeUserEntry({ toolUseResult: { content: "accepted" } });
        const ev = buildToolResultEvent(entry, fp, stableRunId);
        if (ev.run_id !== stableRunId) {
          return { passed: false, detail: `run_id=${ev.run_id}, expected ${stableRunId}` };
        }
        return { passed: true };
      },
    },
    // Integration tests
    {
      name: "[integration] POST agent.status awaiting_input → DB status=awaiting_input",
      mode: "integration",
      async run(): Promise<TestResult> {
        const agentId = `agent_verify_await2_${Date.now()}`;
        const sessionId = `sess_await2_${Date.now()}`;
        await postEvent(makeConversationStartedEvent(agentId, sessionId));
        await settle();
        await postEvent({
          agent_id: agentId,
          run_id: generateRunId(),
          type: "agent.status",
          ts: new Date().toISOString(),
          summary: "Waiting for tool permission",
          status: "awaiting_input",
        });
        await settle();
        const agent = await getAgent(agentId);
        if (!agent) return { passed: false, detail: "agent not found" };
        if (agent.status !== "awaiting_input") return { passed: false, detail: `status=${agent.status}` };
        return { passed: true };
      },
    },
    {
      name: "[integration] POST agent.status working → DB status=working",
      mode: "integration",
      async run(): Promise<TestResult> {
        const agentId = `agent_verify_toolw_${Date.now()}`;
        const sessionId = `sess_toolw_${Date.now()}`;
        await postEvent(makeConversationStartedEvent(agentId, sessionId));
        await settle();
        await postEvent({
          agent_id: agentId,
          run_id: generateRunId(),
          type: "agent.status",
          ts: new Date().toISOString(),
          summary: "Tool permission response received",
          status: "working",
        });
        await settle();
        const agent = await getAgent(agentId);
        if (!agent) return { passed: false, detail: "agent not found" };
        if (agent.status !== "working") return { passed: false, detail: `status=${agent.status}` };
        return { passed: true };
      },
    },
  ];
}

// ─── Test runner ─────────────────────────────────────────────────────────────

async function runCategory(
  category: TestCategory,
  runMode: "unit" | "integration"
): Promise<CategoryResult> {
  const relevantTests = category.tests.filter(
    (t) => t.mode === "both" || t.mode === runMode
  );

  if (relevantTests.length === 0) {
    return {
      displayName: category.displayName,
      reliability: category.reliability,
      passed: 0,
      total: 0,
      score: 100,
      failures: [],
      skipped: true,
    };
  }

  let passed = 0;
  const failures: string[] = [];

  for (const test of relevantTests) {
    try {
      const result = await test.run();
      if (result.passed) {
        passed++;
      } else {
        failures.push(`${test.name}${result.detail ? `: ${result.detail}` : ""}`);
      }
    } catch (err) {
      failures.push(`${test.name}: threw ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const total = relevantTests.length;
  const score = total > 0 ? Math.round((passed / total) * 100) : 100;

  return {
    displayName: category.displayName,
    reliability: category.reliability,
    passed,
    total,
    score,
    failures,
    skipped: false,
  };
}

// ─── Reporting ────────────────────────────────────────────────────────────────

function printReport(
  results: CategoryResult[],
  runMode: "unit" | "integration",
  startTime: Date
): number {
  const PAD_NAME = 38;
  const PAD_SCORE = 8;
  const PAD_TESTS = 11;

  console.log("\nMARIONETTE DATA COLLECTION VERIFICATION");
  console.log("=".repeat(56));
  console.log(`Mode: ${runMode} | Server: ${SERVER}`);
  console.log(`Run:  ${startTime.toISOString()}`);
  console.log("=".repeat(56));
  console.log();
  console.log(
    " " +
      "CATEGORY".padEnd(PAD_NAME) +
      "SCORE".padEnd(PAD_SCORE) +
      "TESTS".padEnd(PAD_TESTS) +
      "RELIABILITY"
  );
  console.log("─".repeat(PAD_NAME + PAD_SCORE + PAD_TESTS + 14));

  let totalPassed = 0;
  let totalTests = 0;
  const allFailures: { category: string; detail: string }[] = [];

  for (const r of results) {
    const skippedNote = r.skipped ? " (skipped)" : "";
    const scoreStr = `${r.score}/100${skippedNote}`;
    const testsStr = r.skipped ? "-" : `${r.passed}/${r.total}`;
    console.log(
      " " +
        r.displayName.padEnd(PAD_NAME) +
        scoreStr.padEnd(PAD_SCORE + 2) +
        testsStr.padEnd(PAD_TESTS) +
        r.reliability
    );

    if (!r.skipped) {
      totalPassed += r.passed;
      totalTests += r.total;
    }
    for (const f of r.failures) {
      allFailures.push({ category: r.displayName, detail: f });
    }
  }

  const overallScore = totalTests > 0 ? Math.round((totalPassed / totalTests) * 100) : 100;

  console.log("─".repeat(PAD_NAME + PAD_SCORE + PAD_TESTS + 14));
  console.log(
    " " +
      "OVERALL SCORE".padEnd(PAD_NAME) +
      `${overallScore}/100`.padEnd(PAD_SCORE + 2) +
      `${totalPassed}/${totalTests}`.padEnd(PAD_TESTS)
  );

  if (allFailures.length > 0) {
    console.log("\nFAILURES:");
    for (const f of allFailures) {
      console.log(`  • ${f.category}: ${f.detail}`);
    }
  } else {
    console.log("\nAll tests passed!");
  }

  console.log();
  return overallScore;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const startTime = new Date();

  // Check server reachability for integration mode
  if (mode === "integration") {
    try {
      const res = await fetch(`${SERVER}/api/health`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      console.error(`\nERROR: Cannot reach server at ${SERVER}/api/health`);
      console.error(`       Start the server first: pnpm --filter @marionette/server run dev`);
      console.error(`       Error: ${err instanceof Error ? err.message : String(err)}\n`);
      process.exit(1);
    }
  }

  const categories: TestCategory[] = [
    { name: "status", displayName: "Agent Status Transitions", reliability: "HIGH", tests: statusTransitionTests() },
    { name: "tokens", displayName: "Token Tracking", reliability: "HIGH", tests: tokenTrackingTests() },
    { name: "conversation", displayName: "Conversation Capture", reliability: "MEDIUM", tests: conversationCaptureTests() },
    { name: "metadata", displayName: "Agent Metadata", reliability: "HIGH", tests: agentMetadataTests() },
    { name: "runs", displayName: "Run Counters", reliability: "HIGH", tests: runCounterTests() },
    { name: "duration", displayName: "Duration Tracking", reliability: "HIGH", tests: durationTrackingTests() },
    { name: "task", displayName: "Current Task Extraction", reliability: "MEDIUM", tests: currentTaskTests() },
    { name: "agent-id", displayName: "Agent ID Stability", reliability: "HIGH", tests: agentIdStabilityTests() },
    { name: "session-reset", displayName: "Session Counter Reset", reliability: "LOW", tests: sessionCounterResetTests() },
    { name: "tool-use", displayName: "Tool Use / Awaiting Input", reliability: "HIGH", tests: toolUseTests() },
  ];

  const results: CategoryResult[] = [];

  for (const category of categories) {
    const result = await runCategory(category, mode);
    results.push(result);
  }

  const overallScore = printReport(results, mode, startTime);

  // Cleanup integration test agents
  if (mode === "integration" && cleanup && registeredAgentIds.size > 0) {
    process.stdout.write(`Cleaning up ${registeredAgentIds.size} test agent(s)... `);
    await Promise.allSettled([...registeredAgentIds].map((id) => deleteAgent(id)));
    console.log("done.");
  }

  process.exit(overallScore >= 70 ? 0 : 1);
}

main().catch((err) => {
  console.error("Fatal:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
