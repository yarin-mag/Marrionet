import { describe, it, expect, vi } from "vitest";

// Mock the db module so tests don't need a real SQLite file
vi.mock("../db.js", () => ({
  DatabaseClient: {
    initialize: vi.fn(),
    query: vi.fn().mockResolvedValue([]),
    queryOne: vi.fn().mockResolvedValue(null),
    run: vi.fn().mockResolvedValue({ changes: 0, lastInsertRowid: 0 }),
    getDb: vi.fn(),
    close: vi.fn(),
  },
}));

const { createApp } = await import("../app.js");

describe("createApp", () => {
  it("returns an Express application", () => {
    const app = createApp();
    expect(app).toBeDefined();
    expect(typeof app).toBe("function"); // Express apps are request handler functions
  });

  it("rejects CORS from non-localhost origins", async () => {
    const app = createApp();
    const response = await new Promise<{ statusCode: number; headers: Record<string, string> }>(
      (resolve) => {
        const req = {
          method: "OPTIONS",
          url: "/",
          headers: { origin: "https://evil.com", "access-control-request-method": "GET" },
        };
        const res = {
          statusCode: 200,
          headers: {} as Record<string, string>,
          setHeader(key: string, val: string) {
            this.headers[key.toLowerCase()] = val;
          },
          getHeader(key: string) {
            return this.headers[key.toLowerCase()];
          },
          end() {
            resolve({ statusCode: this.statusCode, headers: this.headers });
          },
        };
        // Drive through the CORS middleware by simulating an OPTIONS preflight
        // Express handles this internally; a rejected origin won't set the ACAO header.
        app(req as any, res as any, () => resolve({ statusCode: 200, headers: res.headers }));
      }
    );
    // CORS header must NOT be set for a rejected foreign origin
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
