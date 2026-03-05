import { describe, it, expect } from "vitest";
import { uid, generateRunId } from "../ids.js";

describe("uid", () => {
  it("returns a string", () => {
    expect(typeof uid()).toBe("string");
  });

  it("uses the given prefix", () => {
    expect(uid("agent").startsWith("agent_")).toBe(true);
    expect(uid("run").startsWith("run_")).toBe(true);
  });

  it("uses 'id' as default prefix", () => {
    expect(uid().startsWith("id_")).toBe(true);
  });

  it("generates unique values", () => {
    const ids = new Set(Array.from({ length: 100 }, () => uid()));
    expect(ids.size).toBe(100);
  });

  it("has the expected format: prefix_timestamp_rand", () => {
    const id = uid("test");
    const parts = id.split("_");
    expect(parts.length).toBe(3);
    expect(parts[0]).toBe("test");
    // Timestamp is base-36
    expect(parts[1]).toMatch(/^[0-9a-z]+$/);
    // Random hex
    expect(parts[2]).toMatch(/^[0-9a-f]+$/);
  });
});

describe("generateRunId", () => {
  it("starts with 'run_'", () => {
    expect(generateRunId().startsWith("run_")).toBe(true);
  });

  it("generates unique values", () => {
    const ids = new Set(Array.from({ length: 50 }, () => generateRunId()));
    expect(ids.size).toBe(50);
  });
});
