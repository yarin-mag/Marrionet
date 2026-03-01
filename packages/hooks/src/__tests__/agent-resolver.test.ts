import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readTempFileAgentId, lookupAgentByCwd } from "../lib/agent-resolver.js";

// ── readTempFileAgentId ───────────────────────────────────────────────────

vi.mock("node:fs");
vi.mock("@marionette/shared", () => ({
  agentTempFilePath: (cwd: string) => `/tmp/marionette-agent-${cwd.slice(-8)}`,
}));

import { readFileSync } from "node:fs";

describe("readTempFileAgentId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns agent ID when temp file exists with valid content", () => {
    vi.mocked(readFileSync).mockReturnValue("agent_abc1234567890def");
    const result = readTempFileAgentId("/home/user/project");
    expect(result).toBe("agent_abc1234567890def");
  });

  it("returns null when temp file does not exist (ENOENT)", () => {
    vi.mocked(readFileSync).mockImplementation(() => {
      throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    });
    expect(readTempFileAgentId("/home/user/project")).toBeNull();
  });

  it("returns null when temp file content is not a valid agent ID format", () => {
    vi.mocked(readFileSync).mockReturnValue("not-an-agent-id");
    expect(readTempFileAgentId("/home/user/project")).toBeNull();
  });

  it("returns null when temp file content is too short", () => {
    vi.mocked(readFileSync).mockReturnValue("agent_short");
    expect(readTempFileAgentId("/home/user/project")).toBeNull();
  });

  it("returns null when temp file content contains uppercase hex (invalid)", () => {
    vi.mocked(readFileSync).mockReturnValue("agent_ABC1234567890DEF");
    expect(readTempFileAgentId("/home/user/project")).toBeNull();
  });

  it("trims whitespace before validating", () => {
    vi.mocked(readFileSync).mockReturnValue("  agent_abc1234567890def\n");
    expect(readTempFileAgentId("/home/user/project")).toBe("agent_abc1234567890def");
  });
});

// ── lookupAgentByCwd ─────────────────────────────────────────────────────

describe("lookupAgentByCwd", () => {
  const mockFetch = vi.fn<typeof fetch>();
  const CWD = "/home/user/myproject";
  const API_URL = "http://localhost:8787";

  function makeAgents(overrides: Array<Partial<{ agent_id: string; cwd: string; status: string; last_activity: string }>>) {
    return overrides.map((a) => ({
      agent_id: "agent_0000000000000001",
      cwd: CWD,
      status: "working",
      last_activity: "2024-01-01T00:00:00Z",
      ...a,
    }));
  }

  function mockResponse(agents: unknown[]) {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => agents,
    } as Response);
  }

  it("returns agent_id when a matching active agent is found", async () => {
    mockResponse(makeAgents([{ agent_id: "agent_abc1234567890def", status: "working" }]));
    const result = await lookupAgentByCwd(CWD, API_URL, mockFetch);
    expect(result).toBe("agent_abc1234567890def");
  });

  it("returns the most recently active agent when multiple match", async () => {
    mockResponse(makeAgents([
      { agent_id: "agent_0000000000000001", status: "working", last_activity: "2024-01-01T00:00:00Z" },
      { agent_id: "agent_0000000000000002", status: "working", last_activity: "2024-01-02T00:00:00Z" },
    ]));
    const result = await lookupAgentByCwd(CWD, API_URL, mockFetch);
    expect(result).toBe("agent_0000000000000002");
  });

  it("returns null when no agents match the cwd", async () => {
    mockResponse(makeAgents([{ cwd: "/other/project" }]));
    expect(await lookupAgentByCwd(CWD, API_URL, mockFetch)).toBeNull();
  });

  it("returns null when no agents are in active statuses", async () => {
    mockResponse(makeAgents([{ status: "idle" }, { status: "disconnected" }]));
    expect(await lookupAgentByCwd(CWD, API_URL, mockFetch)).toBeNull();
  });

  it("matches all three active statuses: working, awaiting_input, starting", async () => {
    for (const status of ["working", "awaiting_input", "starting"]) {
      mockResponse(makeAgents([{ status }]));
      const result = await lookupAgentByCwd(CWD, API_URL, mockFetch);
      expect(result, `should match status: ${status}`).not.toBeNull();
    }
  });

  it("returns null when API responds with a non-ok status", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 } as Response);
    expect(await lookupAgentByCwd(CWD, API_URL, mockFetch)).toBeNull();
  });

  it("returns null when fetch throws (network error)", async () => {
    mockFetch.mockRejectedValue(new Error("connection refused"));
    expect(await lookupAgentByCwd(CWD, API_URL, mockFetch)).toBeNull();
  });
});
