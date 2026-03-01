import { describe, it, expect, vi } from "vitest";
import { runOnStop, type OnStopDeps } from "../on-stop.js";
import { deriveRunId } from "../lib/run-id.js";

// ── Helpers ───────────────────────────────────────────────────────────────

const AGENT_ID = "agent_abc1234567890def";
const SESSION_ID = "claude-session-uuid-123";
const CWD = "/home/user/myproject";
const API_URL = "http://localhost:8787";

function makeDeps(overrides: Partial<OnStopDeps> = {}): OnStopDeps {
  return {
    readStdin: async () => JSON.stringify({ session_id: SESSION_ID }),
    resolveAgentId: async () => AGENT_ID,
    getAgentStatus: async () => "idle",
    postDisconnect: vi.fn(async () => {}),
    sleep: vi.fn(async () => {}),
    getCwd: () => CWD,
    getApiUrl: () => API_URL,
    ...overrides,
  };
}

// ── Clean exit scenarios (no disconnect event) ────────────────────────────

describe("on-stop: clean exit (no disconnect event emitted)", () => {
  it("does nothing when agent status is idle after wait", async () => {
    const postDisconnect = vi.fn();
    await runOnStop(makeDeps({ getAgentStatus: async () => "idle", postDisconnect }));
    expect(postDisconnect).not.toHaveBeenCalled();
  });

  it("does nothing when agent status is disconnected after wait", async () => {
    const postDisconnect = vi.fn();
    await runOnStop(makeDeps({ getAgentStatus: async () => "disconnected", postDisconnect }));
    expect(postDisconnect).not.toHaveBeenCalled();
  });

  it("does nothing when agent status is finished after wait", async () => {
    const postDisconnect = vi.fn();
    await runOnStop(makeDeps({ getAgentStatus: async () => "finished", postDisconnect }));
    expect(postDisconnect).not.toHaveBeenCalled();
  });

  it("does nothing when status check returns null (API error)", async () => {
    const postDisconnect = vi.fn();
    await runOnStop(makeDeps({ getAgentStatus: async () => null, postDisconnect }));
    expect(postDisconnect).not.toHaveBeenCalled();
  });

  it("does nothing when no agent is found (resolveAgentId returns null)", async () => {
    const postDisconnect = vi.fn();
    await runOnStop(makeDeps({ resolveAgentId: async () => null, postDisconnect }));
    expect(postDisconnect).not.toHaveBeenCalled();
  });
});

// ── Kill mid-turn scenarios (disconnect event emitted) ────────────────────

describe("on-stop: kill mid-turn (disconnect event emitted)", () => {
  it("emits disconnect when agent is still 'working' after wait", async () => {
    const postDisconnect = vi.fn();
    await runOnStop(makeDeps({ getAgentStatus: async () => "working", postDisconnect }));
    expect(postDisconnect).toHaveBeenCalledOnce();
  });

  it("emits disconnect when agent is still 'awaiting_input' after wait", async () => {
    const postDisconnect = vi.fn();
    await runOnStop(makeDeps({ getAgentStatus: async () => "awaiting_input", postDisconnect }));
    expect(postDisconnect).toHaveBeenCalledOnce();
  });

  it("emits disconnect when agent is still 'starting' after wait", async () => {
    const postDisconnect = vi.fn();
    await runOnStop(makeDeps({ getAgentStatus: async () => "starting", postDisconnect }));
    expect(postDisconnect).toHaveBeenCalledOnce();
  });
});

// ── Disconnect event payload ──────────────────────────────────────────────

describe("on-stop: disconnect event arguments", () => {
  it("passes correct agentId, cwd, and apiUrl to postDisconnect", async () => {
    const postDisconnect = vi.fn();
    await runOnStop(makeDeps({ getAgentStatus: async () => "working", postDisconnect }));

    const [agentId, , cwd, apiUrl] = postDisconnect.mock.calls[0] as [string, string, string, string];
    expect(agentId).toBe(AGENT_ID);
    expect(cwd).toBe(CWD);
    expect(apiUrl).toBe(API_URL);
  });

  it("derives run_id from session_id (matches file-watcher formula)", async () => {
    const postDisconnect = vi.fn();
    await runOnStop(makeDeps({ getAgentStatus: async () => "working", postDisconnect }));

    const [, runId] = postDisconnect.mock.calls[0] as [string, string, string, string];
    expect(runId).toBe(deriveRunId(SESSION_ID));
    expect(runId).toMatch(/^run_[0-9a-f]{16}$/);
  });

  it("run_id is consistent — same session_id always produces the same run_id", async () => {
    const postDisconnect1 = vi.fn();
    const postDisconnect2 = vi.fn();

    const deps = makeDeps({ getAgentStatus: async () => "working" });
    await runOnStop({ ...deps, postDisconnect: postDisconnect1 });
    await runOnStop({ ...deps, postDisconnect: postDisconnect2 });

    const [, runId1] = postDisconnect1.mock.calls[0] as [string, string, string, string];
    const [, runId2] = postDisconnect2.mock.calls[0] as [string, string, string, string];
    expect(runId1).toBe(runId2);
  });

  it("falls back to run_stop_{timestamp} when stdin has no session_id", async () => {
    const postDisconnect = vi.fn();
    await runOnStop(makeDeps({
      readStdin: async () => "{}",
      getAgentStatus: async () => "working",
      postDisconnect,
    }));

    const [, runId] = postDisconnect.mock.calls[0] as [string, string, string, string];
    expect(runId).toMatch(/^run_stop_\d+$/);
  });

  it("falls back to run_stop_{timestamp} when stdin is not valid JSON", async () => {
    const postDisconnect = vi.fn();
    await runOnStop(makeDeps({
      readStdin: async () => "{{invalid json",
      getAgentStatus: async () => "working",
      postDisconnect,
    }));

    const [, runId] = postDisconnect.mock.calls[0] as [string, string, string, string];
    expect(runId).toMatch(/^run_stop_\d+$/);
  });
});

// ── Sleep behaviour ───────────────────────────────────────────────────────

describe("on-stop: sleep behaviour", () => {
  it("sleeps for 3000 ms when an agent is found", async () => {
    const sleep = vi.fn(async () => {});
    await runOnStop(makeDeps({ sleep }));
    expect(sleep).toHaveBeenCalledOnce();
    expect(sleep).toHaveBeenCalledWith(3000);
  });

  it("does NOT sleep when no agent is found", async () => {
    const sleep = vi.fn(async () => {});
    await runOnStop(makeDeps({ resolveAgentId: async () => null, sleep }));
    expect(sleep).not.toHaveBeenCalled();
  });

  it("sleeps before checking agent status", async () => {
    const order: string[] = [];
    await runOnStop(makeDeps({
      sleep: vi.fn(async () => { order.push("sleep"); }),
      getAgentStatus: vi.fn(async () => { order.push("statusCheck"); return "idle"; }),
    }));
    expect(order).toEqual(["sleep", "statusCheck"]);
  });
});

// ── Agent ID resolution ───────────────────────────────────────────────────

describe("on-stop: agent ID resolution", () => {
  it("uses resolveAgentId with the correct cwd and apiUrl", async () => {
    const resolveAgentId = vi.fn(async () => AGENT_ID);
    await runOnStop(makeDeps({
      resolveAgentId,
      getCwd: () => "/custom/cwd",
      getApiUrl: () => "http://custom-api:9000",
    }));
    expect(resolveAgentId).toHaveBeenCalledOnce();
    expect(resolveAgentId).toHaveBeenCalledWith("/custom/cwd", "http://custom-api:9000");
  });

  it("uses the resolved agent ID when calling getAgentStatus", async () => {
    const getAgentStatus = vi.fn(async () => "idle");
    await runOnStop(makeDeps({ resolveAgentId: async () => "agent_custom000000000", getAgentStatus }));
    expect(getAgentStatus).toHaveBeenCalledWith("agent_custom000000000", API_URL);
  });

  it("does not call getAgentStatus when resolveAgentId returns null", async () => {
    const getAgentStatus = vi.fn(async () => "working");
    await runOnStop(makeDeps({ resolveAgentId: async () => null, getAgentStatus }));
    expect(getAgentStatus).not.toHaveBeenCalled();
  });
});
