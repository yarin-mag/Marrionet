import express from "express";
import fetch from "node-fetch";
import type { MarionetteEvent, TokenUsage } from "@marionette/shared";
import { uid } from "@marionette/shared";

const PORT = Number(process.env.PORT ?? 9797);
const FORWARD_URL = process.env.MCP_FORWARD_URL ?? "http://localhost:9999";
const INGEST_URL = process.env.MARIONETTE_INGEST ?? "http://localhost:8787/events";

const ORG_ID = process.env.MARIONETTE_ORG_ID;
const PROJECT_ID = process.env.MARIONETTE_PROJECT_ID;
const USER_ID = process.env.MARIONETTE_USER_ID;

const app = express();
app.use(express.json({ limit: "2mb" }));

function isoNow() {
  return new Date().toISOString();
}

function safeStringify(obj: unknown) {
  try { return JSON.stringify(obj); } catch { return "<unstringifiable>"; }
}

/**
 * Best-effort token extraction.
 * - If upstream returns { usage: { input_tokens/output_tokens/total_tokens } } or OpenAI-like usage
 * - Or if headers include x-marionette-tokens-in/out
 */
function extractTokens(upstreamJson: any, reqHeaders: any): TokenUsage | undefined {
  const hIn = Number(reqHeaders["x-marionette-tokens-in"]);
  const hOut = Number(reqHeaders["x-marionette-tokens-out"]);
  const headerTokens = (Number.isFinite(hIn) || Number.isFinite(hOut))
    ? { input_tokens: Number.isFinite(hIn) ? hIn : undefined, output_tokens: Number.isFinite(hOut) ? hOut : undefined }
    : undefined;

  const u = upstreamJson?.usage ?? upstreamJson?.meta?.usage ?? upstreamJson?.result?.usage;
  if (u && typeof u === "object") {
    const input_tokens = u.input_tokens ?? u.prompt_tokens ?? u.inputTokens;
    const output_tokens = u.output_tokens ?? u.completion_tokens ?? u.outputTokens;
    const total_tokens = u.total_tokens ?? u.totalTokens ?? (input_tokens && output_tokens ? input_tokens + output_tokens : undefined);
    const cost_usd = u.cost_usd ?? u.costUSD;
    return {
      input_tokens: typeof input_tokens === "number" ? input_tokens : headerTokens?.input_tokens,
      output_tokens: typeof output_tokens === "number" ? output_tokens : headerTokens?.output_tokens,
      total_tokens: typeof total_tokens === "number" ? total_tokens : undefined,
      cost_usd: typeof cost_usd === "number" ? cost_usd : undefined,
      raw: u
    };
  }
  return headerTokens;
}

async function emit(e: MarionetteEvent) {
  try {
    await fetch(INGEST_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: safeStringify(e)
    });
  } catch (err) {
    // swallow: proxy should not break tool calls
    console.error("[marionette-proxy] telemetry emit failed:", err);
  }
}

/**
 * Minimal MCP-like passthrough:
 * - POST /mcp  body: JSON-RPC-ish { id, method, params }
 * - forwarded to FORWARD_URL/mcp
 *
 * This is intentionally generic: many MCP implementations use JSON-RPC over stdio,
 * but web-based MCP gateways often use HTTP. Adjust to your environment.
 */
app.post("/mcp", async (req, res) => {
  const started = Date.now();
  const run_id = (req.headers["x-marionette-run-id"]?.toString()) || uid("run");
  const agent_id = req.headers["x-marionette-agent-id"]?.toString() || "agent";
  const trace_id = req.headers["x-marionette-trace-id"]?.toString() || uid("trace");
  const span_id = uid("span");

  const method = req.body?.method ?? "<unknown>";
  const params = req.body?.params ?? {};

  await emit({
    org_id: ORG_ID,
    project_id: PROJECT_ID,
    user_id: USER_ID,
    run_id,
    agent_id,
    type: "tool.called",
    ts: isoNow(),
    summary: String(method),
    trace_id,
    span_id,
    env: (process.env.MARIONETTE_ENV as any) ?? "local",
    host: process.env.MARIONETTE_HOST ?? undefined,
    payload: { method, params }
  });

  let upstreamJson: any = null;
  try {
    const upstream = await fetch(`${FORWARD_URL}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: safeStringify(req.body)
    });

    const text = await upstream.text();
    upstreamJson = (() => { try { return JSON.parse(text); } catch { return { raw: text }; } })();

    const duration_ms = Date.now() - started;
    const tokens = extractTokens(upstreamJson, req.headers);

    await emit({
      org_id: ORG_ID,
      project_id: PROJECT_ID,
      user_id: USER_ID,
      run_id,
      agent_id,
      type: "tool.result",
      ts: isoNow(),
      summary: String(method),
      trace_id,
      span_id: uid("spanr"),
      parent_span_id: span_id,
      env: (process.env.MARIONETTE_ENV as any) ?? "local",
      host: process.env.MARIONETTE_HOST ?? undefined,
      tokens,
      payload: { ok: upstream.ok, status: upstream.status, duration_ms, result: upstreamJson }
    });

    res.status(upstream.status).send(text);
  } catch (err: any) {
    const duration_ms = Date.now() - started;
    await emit({
      org_id: ORG_ID,
      project_id: PROJECT_ID,
      user_id: USER_ID,
      run_id,
      agent_id,
      type: "log.error",
      ts: isoNow(),
      summary: `Proxy error calling ${method}`,
      trace_id,
      span_id: uid("spanerr"),
      parent_span_id: span_id,
      payload: { duration_ms, error: String(err?.message ?? err) }
    });
    res.status(502).json({ error: "proxy_failed", detail: String(err?.message ?? err) });
  }
});

app.get("/health", (_req, res) => res.json({ ok: true, forward: FORWARD_URL, ingest: INGEST_URL }));

app.listen(PORT, () => {
  console.log(`[marionette-proxy] listening on http://localhost:${PORT}`);
  console.log(`[marionette-proxy] forwarding -> ${FORWARD_URL}/mcp`);
  console.log(`[marionette-proxy] ingest -> ${INGEST_URL}`);
});
