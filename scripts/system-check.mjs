#!/usr/bin/env node
/**
 * Marionette System Check — scripts/system-check.mjs
 *
 * Real-system integration test runner. Runs against a live Marionette server
 * and produces a scored report across categories A–F.
 *
 * Usage:
 *   node scripts/system-check.mjs [--url http://localhost:8787] [--file-watcher] [--verbose]
 */

import { randomBytes } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { writeFileSync, appendFileSync, unlinkSync, mkdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';

// ── CLI args ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

const BASE_URL = (() => {
  const idx = args.indexOf('--url');
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : 'http://localhost:8787';
})();
const FILE_WATCHER = args.includes('--file-watcher');
const VERBOSE      = args.includes('--verbose');

// ── WebSocket (ws package via pnpm workspace) ─────────────────────────────────

let WebSocketClass;
try {
  // Resolve ws through the server package's node_modules so pnpm's non-hoisting
  // layout doesn't block us.
  const _require = createRequire(
    new URL('../apps/server/package.json', import.meta.url)
  );
  const wsModule = _require('ws');
  WebSocketClass = wsModule.WebSocket ?? wsModule.default?.WebSocket ?? wsModule;
} catch {
  // Fall back to Node.js 22+ built-in WebSocket global
  WebSocketClass = globalThis.WebSocket;
}

if (!WebSocketClass) {
  console.error('No WebSocket implementation found. Need either ws@8 or Node.js >= 22.');
  process.exit(1);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const hex = (n) => randomBytes(n).toString('hex');
const now  = ()  => new Date().toISOString();

// Stable IDs for this run — cleared up after all tests
const TEST_AGENT_ID = `agent_syschk_${hex(4)}`;
const TEST_RUN_ID   = `run_syschk_${hex(4)}`;

async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  try {
    const res  = await fetch(`${BASE_URL}${path}`, opts);
    let   data = null;
    try { data = await res.json(); } catch { /* text body or empty */ }
    return { status: res.status, ok: res.ok, data };
  } catch (err) {
    return { status: 0, ok: false, data: null, err: err.message };
  }
}

/** Open a /stream WebSocket and return helpers. */
function openWs(path = '/stream') {
  const wsUrl = BASE_URL.replace(/^http/, 'ws') + path;
  const ws    = new WebSocketClass(wsUrl);

  const queue     = [];   // buffered incoming messages
  const listeners = [];   // one-shot resolve fns

  const push = (msg) => {
    const l = listeners.shift();
    if (l) { l(msg); } else { queue.push(msg); }
  };

  ws.on('message', (raw) => {
    try { push(JSON.parse(raw.toString())); } catch { /* malformed */ }
  });
  ws.on('error', () => { /* suppress — callers handle via timeout */ });

  /** Wait for any next message (respects already-buffered messages). */
  function nextMessage(timeoutMs = 3000) {
    return new Promise((resolve, reject) => {
      if (queue.length > 0) return resolve(queue.shift());
      const t = setTimeout(() => {
        const i = listeners.indexOf(resolve);
        if (i >= 0) listeners.splice(i, 1);
        reject(new Error(`WS timeout (${timeoutMs}ms): no message`));
      }, timeoutMs);
      listeners.push((msg) => { clearTimeout(t); resolve(msg); });
    });
  }

  /**
   * Wait until a message of the given type arrives (scans queue first).
   * resolveWith=true → resolves with true; use for signal tests.
   */
  function waitForType(type, timeoutMs = 3000) {
    return new Promise((resolve, reject) => {
      const deadline = Date.now() + timeoutMs;

      function attempt() {
        const idx = queue.findIndex((m) => m.type === type);
        if (idx >= 0) { queue.splice(idx, 1); return resolve(true); }
        if (Date.now() >= deadline) {
          return reject(new Error(`WS timeout (${timeoutMs}ms): no "${type}" message`));
        }
        listeners.push(() => attempt());
      }
      attempt();
    });
  }

  const close = () => { try { ws.close(); } catch { /* ignore */ } };

  return { ws, nextMessage, waitForType, close };
}

/** Wait until fn() returns a truthy value, polling every intervalMs. */
async function waitFor(fn, timeoutMs = 5000, intervalMs = 250) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const v = await fn();
    if (v) return v;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`waitFor: condition not met within ${timeoutMs}ms`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Test runner ───────────────────────────────────────────────────────────────

class TestRunner {
  constructor() { this.all = []; }

  async run(id, name, fn) {
    let score = 0, detail = '';
    try {
      const r = await fn();
      score  = r.score ?? 0;
      detail = r.detail ?? '';
    } catch (err) {
      score  = 0;
      detail = `Exception: ${err.message}`;
    }
    const result = { id, name, score, detail };
    this.all.push(result);
    if (VERBOSE) {
      const mark = score >= 10 ? '✓' : score >= 7 ? '~' : '✗';
      console.log(`  ${mark} ${id}  ${name}: ${score}/10${detail ? '  (' + detail + ')' : ''}`);
    }
    return result;
  }
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

async function cleanup(agentId) {
  try { await api('DELETE', `/api/agents/${agentId}`); } catch { /* best-effort */ }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEST DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

async function runAll() {
  const runner     = new TestRunner();
  const categories = [];

  // ── Category A — Infrastructure ───────────────────────────────────────────

  {
    const r = runner;
    const tests = [];

    tests.push(await r.run('A1', 'Health endpoint', async () => {
      const res = await api('GET', '/api/health');
      if (res.status === 200 && res.data?.ok === true) return { score: 10 };
      return { score: 0, detail: `HTTP ${res.status}, ok=${res.data?.ok}` };
    }));

    tests.push(await r.run('A2', 'Status endpoint', async () => {
      const res = await api('GET', '/api/status');
      if (res.status !== 200) return { score: 0, detail: `HTTP ${res.status}` };
      const d = res.data;
      const hasFields = d && 'total_agents' in d && 'working' in d && 'idle' in d;
      if (hasFields) return { score: 10 };
      return { score: 5, detail: `Unexpected fields: ${Object.keys(d ?? {}).join(', ')}` };
    }));

    tests.push(await r.run('A3', 'Status returns numeric counts', async () => {
      const res = await api('GET', '/api/status');
      if (res.status !== 200) return { score: 0, detail: `HTTP ${res.status}` };
      const d = res.data;
      if (typeof d?.total_agents === 'number' && typeof d?.working === 'number') {
        return { score: 10, detail: `total_agents=${d.total_agents}` };
      }
      return { score: 5, detail: 'Count fields not numeric' };
    }));

    tests.push(await r.run('A4', 'WebSocket /stream connects', async () => {
      return new Promise((resolve) => {
        const ws  = new WebSocketClass(BASE_URL.replace(/^http/, 'ws') + '/stream');
        const t   = setTimeout(() => { ws.close(); resolve({ score: 0, detail: 'Connection timeout' }); }, 3000);
        ws.on('open', () => { clearTimeout(t); ws.close(); resolve({ score: 10 }); });
        ws.on('error', (e) => { clearTimeout(t); resolve({ score: 0, detail: e.message }); });
      });
    }));

    tests.push(await r.run('A5', 'WebSocket receives hello', async () => {
      return new Promise((resolve) => {
        const ws = new WebSocketClass(BASE_URL.replace(/^http/, 'ws') + '/stream');
        const t  = setTimeout(() => { ws.close(); resolve({ score: 0, detail: 'No hello within 2s' }); }, 2000);
        ws.on('message', (raw) => {
          try {
            const msg = JSON.parse(raw.toString());
            if (msg.type === 'hello') {
              clearTimeout(t);
              ws.close();
              resolve({ score: 10 });
            }
          } catch { /* skip malformed */ }
        });
        ws.on('error', (e) => { clearTimeout(t); resolve({ score: 0, detail: e.message }); });
      });
    }));

    const score = tests.reduce((s, t) => s + t.score, 0) / tests.length;
    categories.push({ id: 'A', name: 'Infrastructure', weight: 1, tests, score });
  }

  // ── Category B — REST API Correctness ─────────────────────────────────────

  {
    const r = runner;
    const tests = [];

    tests.push(await r.run('B1', 'GET /api/agents', async () => {
      const res = await api('GET', '/api/agents');
      if (res.status !== 200) return { score: 0, detail: `HTTP ${res.status}` };
      if (Array.isArray(res.data)) return { score: 10, detail: `${res.data.length} agents` };
      return { score: 5, detail: `Expected array, got ${typeof res.data}` };
    }));

    tests.push(await r.run('B2', 'POST single event', async () => {
      const event = {
        type: 'log.info', agent_id: TEST_AGENT_ID,
        run_id: TEST_RUN_ID, ts: now(), summary: 'syschk B2 test',
      };
      const res = await api('POST', '/api/events', event);
      if (res.status !== 200) return { score: 0, detail: `HTTP ${res.status}` };
      if (res.data?.processed === 1) return { score: 10 };
      if (res.data?.received === 1) return { score: 7, detail: `received=1 but processed=${res.data.processed}` };
      return { score: 5, detail: JSON.stringify(res.data) };
    }));

    tests.push(await r.run('B3', 'POST batch of 5 events', async () => {
      const events = Array.from({ length: 5 }, (_, i) => ({
        type: 'log.info', agent_id: TEST_AGENT_ID,
        run_id: `${TEST_RUN_ID}_b3`, ts: new Date(Date.now() + i).toISOString(),
        summary: `syschk B3 batch ${i}`,
      }));
      const res = await api('POST', '/api/events', events);
      if (res.status !== 200) return { score: 0, detail: `HTTP ${res.status}` };
      if (res.data?.processed === 5) return { score: 10 };
      if (res.data?.received === 5) return { score: 7, detail: `received=5 but processed=${res.data.processed}` };
      return { score: 5, detail: JSON.stringify(res.data) };
    }));

    tests.push(await r.run('B4', 'GET /api/preferences', async () => {
      const res = await api('GET', '/api/preferences');
      if (res.status !== 200) return { score: 0, detail: `HTTP ${res.status}` };
      if (res.data && 'mcpSetTaskEnabled' in res.data) return { score: 10 };
      return { score: 5, detail: `Missing mcpSetTaskEnabled. Keys: ${Object.keys(res.data ?? {}).join(', ')}` };
    }));

    tests.push(await r.run('B5', 'Preferences round-trip', async () => {
      // Use calendarClickToAdd — read current, flip, verify, restore
      const getRes  = await api('GET', '/api/preferences');
      const original = getRes.data?.calendarClickToAdd ?? false;
      const testVal  = !original;

      const putRes = await api('PUT', '/api/preferences', { calendarClickToAdd: testVal });
      if (putRes.status !== 200) return { score: 0, detail: `PUT failed HTTP ${putRes.status}` };

      const verify = await api('GET', '/api/preferences');
      if (verify.data?.calendarClickToAdd !== testVal) {
        return { score: 5, detail: `Expected ${testVal}, got ${verify.data?.calendarClickToAdd}` };
      }

      // Restore original value
      await api('PUT', '/api/preferences', { calendarClickToAdd: original });
      return { score: 10 };
    }));

    const score = tests.reduce((s, t) => s + t.score, 0) / tests.length;
    categories.push({ id: 'B', name: 'REST API Correctness', weight: 1.5, tests, score });
  }

  // ── Category C — Agent Lifecycle ──────────────────────────────────────────

  {
    const r = runner;
    const tests = [];

    tests.push(await r.run('C1', 'conversation.started → agent created (starting)', async () => {
      const res = await api('POST', '/api/events', {
        type: 'conversation.started', agent_id: TEST_AGENT_ID,
        run_id: TEST_RUN_ID, ts: now(),
        summary: 'syschk session started', status: 'starting',
      });
      if (!res.ok) return { score: 0, detail: `POST failed HTTP ${res.status}` };

      await sleep(150);

      const get = await api('GET', `/api/agents/${TEST_AGENT_ID}`);
      if (get.status !== 200) return { score: 0, detail: `Agent not found HTTP ${get.status}` };
      if (get.data.status === 'starting') return { score: 10 };
      return { score: 7, detail: `status=${get.data.status} (expected starting)` };
    }));

    tests.push(await r.run('C2', 'run.started → status working', async () => {
      const res = await api('POST', '/api/events', {
        type: 'run.started', agent_id: TEST_AGENT_ID,
        run_id: TEST_RUN_ID, ts: now(),
        summary: 'syschk run started', status: 'working',
      });
      if (!res.ok) return { score: 0, detail: `POST failed HTTP ${res.status}` };

      await sleep(150);

      const get = await api('GET', `/api/agents/${TEST_AGENT_ID}`);
      if (get.data?.status === 'working') return { score: 10 };
      return { score: 5, detail: `status=${get.data?.status}` };
    }));

    tests.push(await r.run('C3', 'llm.call → session_tokens accumulated', async () => {
      const res = await api('POST', '/api/events', {
        type: 'llm.call', agent_id: TEST_AGENT_ID,
        run_id: TEST_RUN_ID, ts: now(),
        summary: 'syschk llm call',
        tokens: { input_tokens: 100, output_tokens: 50 },
      });
      if (!res.ok) return { score: 0, detail: `POST failed HTTP ${res.status}` };

      await sleep(150);

      const get = await api('GET', `/api/agents/${TEST_AGENT_ID}`);
      const tok = get.data?.session_tokens ?? 0;
      if (tok >= 150) return { score: 10, detail: `session_tokens=${tok}` };
      if (tok > 0)    return { score: 7,  detail: `session_tokens=${tok} (expected ≥150)` };
      return { score: 0, detail: `session_tokens=${tok}` };
    }));

    tests.push(await r.run('C4', 'run.ended → status idle, session_runs incremented', async () => {
      const before = await api('GET', `/api/agents/${TEST_AGENT_ID}`);
      const runsBefore = before.data?.session_runs ?? 0;

      const res = await api('POST', '/api/events', {
        type: 'run.ended', agent_id: TEST_AGENT_ID,
        run_id: TEST_RUN_ID, ts: now(),
        summary: 'syschk run ended', status: 'idle',
      });
      if (!res.ok) return { score: 0, detail: `POST failed HTTP ${res.status}` };

      await sleep(150);

      const get  = await api('GET', `/api/agents/${TEST_AGENT_ID}`);
      const statusOk = get.data?.status === 'idle';
      const runsOk   = (get.data?.session_runs ?? 0) > runsBefore;

      if (statusOk && runsOk) return { score: 10, detail: `session_runs=${get.data.session_runs}` };
      if (statusOk)           return { score: 7,  detail: `idle but session_runs=${get.data?.session_runs} (was ${runsBefore})` };
      return { score: 3, detail: `status=${get.data?.status}, session_runs=${get.data?.session_runs}` };
    }));

    tests.push(await r.run('C5', 'agent.disconnected → status disconnected', async () => {
      const res = await api('POST', '/api/events', {
        type: 'agent.disconnected', agent_id: TEST_AGENT_ID,
        run_id: TEST_RUN_ID, ts: now(),
        summary: 'syschk agent disconnected', status: 'disconnected',
      });
      if (!res.ok) return { score: 0, detail: `POST failed HTTP ${res.status}` };

      await sleep(150);

      const get = await api('GET', `/api/agents/${TEST_AGENT_ID}`);
      if (get.data?.status === 'disconnected') return { score: 10 };
      return { score: 5, detail: `status=${get.data?.status}` };
    }));

    tests.push(await r.run('C6', 'PATCH current_task → field updated', async () => {
      // Re-create the agent so the PATCH doesn't skip (agent may be disconnected)
      await api('POST', '/api/events', {
        type: 'conversation.started', agent_id: TEST_AGENT_ID,
        run_id: TEST_RUN_ID, ts: now(),
        summary: 'syschk c6 re-create', status: 'idle',
      });
      await sleep(150);

      const patch = await api('PATCH', `/api/agents/${TEST_AGENT_ID}`, {
        current_task: 'syschk-test-task',
      });
      if (!patch.ok) return { score: 0, detail: `PATCH failed HTTP ${patch.status}` };

      await sleep(100);

      const get = await api('GET', `/api/agents/${TEST_AGENT_ID}`);
      if (get.data?.current_task === 'syschk-test-task') return { score: 10 };
      return { score: 5, detail: `current_task=${get.data?.current_task}` };
    }));

    const score = tests.reduce((s, t) => s + t.score, 0) / tests.length;
    categories.push({ id: 'C', name: 'Agent Lifecycle', weight: 2, tests, score });
  }

  // ── Category D — Data Integrity ───────────────────────────────────────────

  {
    const r = runner;
    const tests = [];

    tests.push(await r.run('D1', 'Events stored and retrievable', async () => {
      const runId = `${TEST_RUN_ID}_d1`;
      await api('POST', '/api/events', {
        type: 'log.info', agent_id: TEST_AGENT_ID,
        run_id: runId, ts: now(), summary: 'syschk D1 storage test',
      });
      await sleep(150);

      const res = await api('GET', `/api/events?agent_id=${TEST_AGENT_ID}&type=log.info&limit=100`);
      if (!res.ok)                    return { score: 0, detail: `GET failed HTTP ${res.status}` };
      if (!Array.isArray(res.data))   return { score: 0, detail: 'Response not an array' };
      const found = res.data.some((e) => e.run_id === runId);
      if (found) return { score: 10, detail: `${res.data.length} events total` };
      return { score: 3, detail: `Event not found among ${res.data.length} returned` };
    }));

    tests.push(await r.run('D2', 'Token math accuracy', async () => {
      const baseline = await api('GET', `/api/agents/${TEST_AGENT_ID}`);
      const tokBefore = baseline.data?.session_tokens ?? 0;

      // Post two llm.call events with known token counts: 300 + 75 = 375
      const events = [
        {
          type: 'llm.call', agent_id: TEST_AGENT_ID,
          run_id: `${TEST_RUN_ID}_d2a`, ts: new Date(Date.now()).toISOString(),
          summary: 'syschk D2 llm 1', tokens: { input_tokens: 200, output_tokens: 100 },
        },
        {
          type: 'llm.call', agent_id: TEST_AGENT_ID,
          run_id: `${TEST_RUN_ID}_d2b`, ts: new Date(Date.now() + 1).toISOString(),
          summary: 'syschk D2 llm 2', tokens: { input_tokens: 50, output_tokens: 25 },
        },
      ];
      await api('POST', '/api/events', events);
      await sleep(200);

      const after = await api('GET', `/api/agents/${TEST_AGENT_ID}`);
      const delta    = (after.data?.session_tokens ?? 0) - tokBefore;
      const expected = 375;

      if (delta === expected)               return { score: 10, detail: `delta=${delta}` };
      if (Math.abs(delta - expected) <= 5)  return { score: 7,  detail: `delta=${delta}, expected=${expected}` };
      return { score: 0, detail: `delta=${delta}, expected=${expected}` };
    }));

    tests.push(await r.run('D3', 'Timestamps preserved exactly', async () => {
      const ts    = '2026-01-15T12:34:56.789Z';
      const runId = `${TEST_RUN_ID}_d3`;
      await api('POST', '/api/events', {
        type: 'log.info', agent_id: TEST_AGENT_ID,
        run_id: runId, ts, summary: 'syschk D3 timestamp test',
      });
      await sleep(150);

      const res   = await api('GET', `/api/events?agent_id=${TEST_AGENT_ID}&run_id=${runId}`);
      if (!Array.isArray(res.data)) return { score: 0, detail: 'Not an array' };
      const found = res.data.find((e) => e.run_id === runId);
      if (!found) return { score: 0, detail: 'Event not found' };
      if (found.ts === ts) return { score: 10 };
      if (found.ts?.startsWith('2026-01-15T12:34:56')) return { score: 7, detail: `ts=${found.ts}` };
      return { score: 3, detail: `ts=${found.ts}, expected=${ts}` };
    }));

    tests.push(await r.run('D4', 'Batch insertion order preserved', async () => {
      const base  = Date.now();
      const runId = `${TEST_RUN_ID}_d4`;
      const events = Array.from({ length: 5 }, (_, i) => ({
        type: 'log.info', agent_id: TEST_AGENT_ID, run_id: runId,
        ts: new Date(base + i * 1000).toISOString(),
        summary: `syschk D4 order ${i}`,
      }));
      await api('POST', '/api/events', events);
      await sleep(200);

      const res      = await api('GET', `/api/events?agent_id=${TEST_AGENT_ID}&run_id=${runId}&limit=20`);
      if (!Array.isArray(res.data)) return { score: 0, detail: 'Not an array' };
      const relevant = res.data.filter((e) => e.run_id === runId);
      if (relevant.length < 5) return { score: 3, detail: `Only ${relevant.length}/5 events found` };

      // findWithFilters → ORDER BY ts DESC, then controller calls .reverse() → ascending (oldest first)
      let ascending = true;
      for (let i = 1; i < relevant.length; i++) {
        if (relevant[i].ts <= relevant[i - 1].ts) { ascending = false; break; }
      }
      if (ascending) return { score: 10, detail: 'Ascending order confirmed' };
      return { score: 7, detail: 'All 5 found but order not strictly ascending' };
    }));

    const score = tests.reduce((s, t) => s + t.score, 0) / tests.length;
    categories.push({ id: 'D', name: 'Data Integrity', weight: 1.5, tests, score });
  }

  // ── Category E — WebSocket Real-time ──────────────────────────────────────

  {
    const r = runner;
    const tests = [];

    tests.push(await r.run('E1', 'agents_updated on connect', async () => {
      return new Promise((resolve) => {
        const received = [];
        const ws = new WebSocketClass(BASE_URL.replace(/^http/, 'ws') + '/stream');
        const t  = setTimeout(() => {
          ws.close();
          const ok = received.some((m) => m.type === 'agents_updated');
          resolve(ok
            ? { score: 10 }
            : { score: 0, detail: `Got: ${received.map((m) => m.type).join(', ')}` }
          );
        }, 2000);
        ws.on('message', (raw) => {
          try { received.push(JSON.parse(raw.toString())); } catch { /* skip */ }
        });
        ws.on('error', (e) => { clearTimeout(t); ws.close(); resolve({ score: 0, detail: e.message }); });
      });
    }));

    tests.push(await r.run('E2', 'Event POST broadcasts to WS within 2s', async () => {
      return new Promise((resolve) => {
        const initial = [];
        let   waiting = false;
        const ws = new WebSocketClass(BASE_URL.replace(/^http/, 'ws') + '/stream');
        ws.on('error', (e) => resolve({ score: 0, detail: e.message }));

        ws.on('message', async (raw) => {
          try {
            const msg = JSON.parse(raw.toString());
            if (waiting) {
              if (msg.type === 'events') {
                const latency = Date.now() - broadcastStart;
                ws.close();
                resolve({ score: 10, detail: `latency=${latency}ms` });
              }
              return;
            }
            initial.push(msg);
            // After receiving both hello + agents_updated, post a test event
            if (initial.some((m) => m.type === 'hello') && initial.some((m) => m.type === 'agents_updated')) {
              waiting = true;
              broadcastStart = Date.now();
              api('POST', '/api/events', {
                type: 'log.info', agent_id: TEST_AGENT_ID,
                run_id: `${TEST_RUN_ID}_e2`, ts: now(),
                summary: 'syschk E2 broadcast test',
              });
              setTimeout(() => {
                ws.close();
                resolve({ score: 0, detail: 'Timeout: no events broadcast within 2s' });
              }, 2000);
            }
          } catch { /* skip */ }
        });
        let broadcastStart = 0;
      });
    }));

    tests.push(await r.run('E3', 'agent.disconnected triggers agents_updated broadcast', async () => {
      return new Promise((resolve) => {
        const initial = [];
        let   posted  = false;
        const ws = new WebSocketClass(BASE_URL.replace(/^http/, 'ws') + '/stream');
        ws.on('error', (e) => resolve({ score: 0, detail: e.message }));

        ws.on('message', async (raw) => {
          try {
            const msg = JSON.parse(raw.toString());
            if (posted) {
              if (msg.type === 'agents_updated') {
                ws.close();
                resolve({ score: 10 });
              }
              return;
            }
            initial.push(msg);
            if (initial.some((m) => m.type === 'hello') && initial.some((m) => m.type === 'agents_updated')) {
              posted = true;
              api('POST', '/api/events', {
                type: 'agent.disconnected', agent_id: TEST_AGENT_ID,
                run_id: `${TEST_RUN_ID}_e3`, ts: now(),
                summary: 'syschk E3 disconnect test', status: 'disconnected',
              });
              setTimeout(() => {
                ws.close();
                resolve({ score: 0, detail: 'Timeout: no agents_updated after agent.disconnected' });
              }, 2000);
            }
          } catch { /* skip */ }
        });
      });
    }));

    const score = tests.reduce((s, t) => s + t.score, 0) / tests.length;
    categories.push({ id: 'E', name: 'WebSocket Real-time', weight: 1.5, tests, score });
  }

  // ── Category F — File Watcher (optional) ──────────────────────────────────

  if (FILE_WATCHER) {
    const r = runner;
    const tests = [];

    const FW_SESSION_ID  = hex(16);
    const FW_PROJECT_DIR = join(homedir(), '.claude', 'projects', `marionette-syscheck-${Date.now()}`);
    const FW_FILE        = join(FW_PROJECT_DIR, `${FW_SESSION_ID}.jsonl`);

    const writeLines = (lines) =>
      writeFileSync(FW_FILE, lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
    const appendLine = (line) =>
      appendFileSync(FW_FILE, JSON.stringify(line) + '\n');

    // Helper: find the agent created from our session file
    const findFwAgent = async () => {
      const res = await api('GET', '/api/agents');
      if (!Array.isArray(res.data)) return null;
      return res.data.find((a) => a.source_file?.includes(FW_SESSION_ID)) ?? null;
    };

    try {
      tests.push(await r.run('F1', 'New JSONL → agent appears (conversation.started)', async () => {
        mkdirSync(FW_PROJECT_DIR, { recursive: true });
        // First line must have a valid `type` field
        writeLines([{
          type: 'system', sessionId: FW_SESSION_ID,
          uuid: hex(8), cwd: FW_PROJECT_DIR,
          message: { role: 'system', content: 'System prompt' },
        }]);
        try {
          await waitFor(findFwAgent, 10_000);
          return { score: 10 };
        } catch {
          return { score: 0, detail: 'Agent not detected within 10s' };
        }
      }));

      tests.push(await r.run('F2', 'User message → status working (run.started)', async () => {
        appendLine({
          type: 'user', sessionId: FW_SESSION_ID, uuid: hex(8),
          cwd: FW_PROJECT_DIR, isSidechain: false, userType: 'external',
          message: { role: 'user', content: [{ type: 'text', text: 'Hello test' }] },
        });
        try {
          await waitFor(async () => {
            const a = await findFwAgent();
            return a?.status === 'working';
          }, 10_000);
          return { score: 10 };
        } catch {
          return { score: 0, detail: 'Status working not set within 10s' };
        }
      }));

      tests.push(await r.run('F3', 'Assistant entry → llm.call / tokens accumulated', async () => {
        appendLine({
          type: 'assistant', sessionId: FW_SESSION_ID, uuid: hex(8), isSidechain: false,
          message: {
            role: 'assistant',
            content: [{ type: 'text', text: 'Hello response' }],
            usage: { input_tokens: 77, output_tokens: 23,
                     cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
          },
        });
        try {
          await waitFor(async () => {
            const a = await findFwAgent();
            return a && (a.session_tokens ?? 0) >= 100;
          }, 10_000);
          return { score: 10, detail: 'session_tokens ≥ 100' };
        } catch {
          const a = await findFwAgent();
          return { score: 0, detail: `session_tokens=${a?.session_tokens ?? 0}` };
        }
      }));

      tests.push(await r.run('F4', 'turn_duration → status idle (run.ended)', async () => {
        appendLine({
          type: 'system', subtype: 'turn_duration',
          sessionId: FW_SESSION_ID, uuid: hex(8),
          durationMs: 1234,
        });
        try {
          await waitFor(async () => {
            const a = await findFwAgent();
            return a?.status === 'idle';
          }, 10_000);
          return { score: 10 };
        } catch {
          const a = await findFwAgent();
          return { score: 0, detail: `Status after turn_duration: ${a?.status}` };
        }
      }));

      tests.push(await r.run('F5', 'File delete → status disconnected', async () => {
        try { unlinkSync(FW_FILE); } catch { /* already gone */ }
        try {
          await waitFor(async () => {
            const a = await findFwAgent();
            return a?.status === 'disconnected';
          }, 18_000);
          return { score: 10 };
        } catch {
          const a = await findFwAgent();
          return { score: 0, detail: `Status after delete: ${a?.status ?? 'agent gone'}` };
        }
      }));

    } finally {
      // Clean up test project directory
      try { rmSync(FW_PROJECT_DIR, { recursive: true, force: true }); } catch { /* ignore */ }
    }

    const score = tests.reduce((s, t) => s + t.score, 0) / tests.length;
    categories.push({ id: 'F', name: 'File Watcher', weight: 2, tests, score });

  } else {
    categories.push({ id: 'F', name: 'File Watcher', weight: 2, skipped: true });
  }

  // ── Cleanup test agent ────────────────────────────────────────────────────

  await cleanup(TEST_AGENT_ID);

  // ── Print report ──────────────────────────────────────────────────────────

  printReport(categories);
}

// ═══════════════════════════════════════════════════════════════════════════════
// REPORT
// ═══════════════════════════════════════════════════════════════════════════════

function printReport(categories) {
  const W    = 56;
  const BAR  = '═'.repeat(W);
  const DASH = '─'.repeat(44);

  const dateStr = new Date().toLocaleString('en-US', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });

  console.log(`\n${BAR}`);
  console.log(`  MARIONETTE SYSTEM CHECK  —  ${dateStr}`);
  console.log(`  Server: ${BASE_URL}`);
  console.log(BAR);

  let weightedSum = 0;
  let weightTotal = 0;

  for (const cat of categories) {
    console.log(`\n[${cat.id}] ${cat.name}`);

    if (cat.skipped) {
      console.log(`  (SKIPPED — run with --file-watcher)`);
      continue;
    }

    for (const t of cat.tests) {
      const mark  = t.score >= 10 ? '✓' : t.score >= 7 ? '~' : '✗';
      const name  = t.name.padEnd(36);
      const score = `${t.score}/10`.padStart(6);
      const note  = t.detail ? `  (${t.detail})` : '';
      console.log(`  ${mark} ${t.id}  ${name} ${score}${note}`);
    }

    console.log(`  ${DASH}`);
    console.log(`  Category ${cat.id} score:  ${cat.score.toFixed(1)}/10\n`);

    weightedSum += cat.score * cat.weight;
    weightTotal += cat.weight;
  }

  const pct   = weightTotal > 0 ? Math.round((weightedSum / weightTotal) * 10) : 0;
  const grade = pct >= 95 ? 'A+' : pct >= 90 ? 'A'  : pct >= 85 ? 'B+'
              : pct >= 80 ? 'B'  : pct >= 75 ? 'C+' : pct >= 70 ? 'C'
              : pct >= 60 ? 'D'  : 'F';

  console.log(BAR);
  console.log(`  OVERALL SCORE: ${pct}/100  (${grade})`);
  console.log(`${BAR}\n`);
}

// ── Entry point ───────────────────────────────────────────────────────────────

runAll().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
