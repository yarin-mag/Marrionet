Copy/paste prompt for an LLM to extend Marionette.

## Prompt
You are a senior TypeScript engineer building a minimal but production-grade “Agent Observability Dashboard” called **Marionette**.

Goal:
- Observe AI agent runs by intercepting MCP tool calls via an **MCP HTTP proxy**.
- Stream events to a backend and visualize them in a web UI.
- Track token usage per tool call and aggregate per run (best-effort), including input/output/total tokens and cost when available.

Repo structure (already exists):
- apps/server: Express + WS telemetry ingest (in-memory MVP)
- packages/mcp-proxy: Express MCP proxy forwarding /mcp to an upstream MCP server
- apps/web: Vite + React dashboard UI
- packages/shared: event schema/types

Your tasks:
1) Improve the MCP proxy to support:
   - configurable redaction rules for payloads (JSON paths + regex)
   - batching telemetry to reduce ingest calls
   - robust correlation: trace_id/span_id, parent_span_id
2) Improve the server to support:
   - multi-tenant org/project/user RBAC (MVP roles)
   - persistent storage (Postgres) with migrations
   - query endpoints for runs summary + time range filters
3) Improve the UI to become “best in market”:
   - real trace waterfall (tool called → tool result linked)
   - agent swimlanes, live “what’s running now”
   - run comparison, errors dashboard, slow tools dashboard
   - token & cost charts
4) Keep code clean, minimal dependencies, excellent DX.
5) Provide diffs or file-level changes; do not invent new folders unless needed.

Constraints:
- TypeScript everywhere.
- Keep the MVP running with `pnpm dev`.
- Do not remove existing minimal functionality.
- Add only a small number of dependencies when justified.
