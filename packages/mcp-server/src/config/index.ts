/**
 * MCP Server configuration
 * Centralized constants and environment variables
 */
export const config = {
  apiUrl: process.env.MARIONETTE_API_URL ?? "http://localhost:8787",
  serverUrl: process.env.MARIONETTE_SERVER_URL ?? "http://localhost:3001",

  get wsUrl(): string {
    return this.apiUrl.replace(/^https?/, (scheme) => scheme === "https" ? "wss" : "ws") + "/agent-stream";
  },

  heartbeat: {
    intervalMs: 30000, // 30 seconds
  },

  jira: {
    ticketPattern: /\b([A-Z][A-Z0-9]+-\d+)\b/g,
    ticketFormat: /^[A-Z][A-Z0-9]+-\d+$/,
  },

  mcp: {
    name: "marionette",
    version: "0.1.0",
  },
} as const;
