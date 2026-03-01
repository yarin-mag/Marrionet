#!/usr/bin/env node
// Verification test for token counting fix.
// Usage: node scripts/test-tokens.mjs
// Requires the server to be running on http://localhost:8787

import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
// Resolve better-sqlite3 from the workspace root (pnpm hoists it there)
const Database = require(path.resolve(__dirname, '../apps/server/node_modules/better-sqlite3'));

const DB_PATH = path.resolve(__dirname, '../db/marionette.db');
const API = 'http://localhost:8787';
const TEST_AGENT = 'agent_test_tokencheck';
const TEST_RUN = 'run_test_tokencheck_001';

async function post(body) {
  const res = await fetch(`${API}/api/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST /api/events failed ${res.status}: ${text}`);
  }
  return res.json();
}

function readTokens(db) {
  return db.prepare('SELECT total_tokens FROM agents WHERE agent_id = ?').get(TEST_AGENT);
}

async function main() {
  console.log('Token counting verification test');
  console.log('=================================');

  // Step 1: Register test agent
  console.log(`\n1. Registering test agent "${TEST_AGENT}"...`);
  await post({
    type: 'conversation.started',
    agent_id: TEST_AGENT,
    run_id: TEST_RUN,
    ts: new Date().toISOString(),
    summary: 'session started',
    metadata: { name: 'Token Test Agent' },
  });

  // Give server a moment to persist
  await new Promise(r => setTimeout(r, 200));

  // Step 2: Read tokens before
  const db = new Database(DB_PATH, { readonly: true });
  const before = readTokens(db);
  db.close();
  console.log(`2. total_tokens before: ${before?.total_tokens ?? '(agent not found)'}`);

  // Step 3: Post run.ended with known token count
  const EXPECTED = 9999;
  console.log(`3. Posting run.ended with total_tokens=${EXPECTED}...`);
  await post({
    type: 'run.ended',
    agent_id: TEST_AGENT,
    run_id: TEST_RUN,
    ts: new Date().toISOString(),
    summary: 'run ended',
    status: 'idle',
    tokens: {
      input_tokens: 3000,
      output_tokens: 2000,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
      total_tokens: EXPECTED,
    },
    duration_ms: 1234,
  });

  await new Promise(r => setTimeout(r, 200));

  // Step 4: Read tokens after
  const db2 = new Database(DB_PATH, { readonly: true });
  const after = readTokens(db2);
  db2.close();
  console.log(`4. total_tokens after:  ${after?.total_tokens ?? '(agent not found)'}`);

  // Step 5: Verdict
  console.log('');
  if (after?.total_tokens === EXPECTED) {
    console.log('PASS ✓  — tokens correctly incremented');
    process.exit(0);
  } else {
    console.log(`FAIL ✗  — expected ${EXPECTED}, got ${after?.total_tokens}`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
