import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const MARIONETTE_DIR = join(homedir(), ".marionette");
const TRACKER_PATH  = join(MARIONETTE_DIR, "scanned-sessions.json");
const EXCLUDED_PATH = join(MARIONETTE_DIR, "excluded-sessions.json");

function readJsonArray(path: string): Set<string> {
  try {
    const data = JSON.parse(readFileSync(path, "utf8")) as unknown;
    if (Array.isArray(data)) return new Set(data as string[]);
  } catch {}
  return new Set();
}

function writeJsonArray(path: string, set: Set<string>): void {
  try {
    mkdirSync(MARIONETTE_DIR, { recursive: true });
    writeFileSync(path, JSON.stringify([...set], null, 2), "utf8");
  } catch (err) {
    console.warn("[scan-tracker] Failed to write", path, err);
  }
}

// ── Scanned sessions (files already processed — skip re-import) ────────────

/**
 * Load the set of JSONL file paths already fully processed by a previous run.
 * Used to avoid re-scanning and double-counting on restart.
 */
export function loadScannedSessions(): Set<string> {
  return readJsonArray(TRACKER_PATH);
}

/**
 * Persist newly scanned file paths so future restarts can skip them.
 */
export function markSessionsScanned(filePaths: string[]): void {
  if (filePaths.length === 0) return;
  const existing = readJsonArray(TRACKER_PATH);
  for (const p of filePaths) existing.add(p);
  writeJsonArray(TRACKER_PATH, existing);
}

// ── Excluded sessions (intentionally deleted — never re-import) ────────────

/**
 * Load the set of JSONL file paths that should never be re-imported,
 * because the user explicitly deleted those agents.
 * This file survives scanned-sessions.json being deleted.
 */
export function loadExcludedSessions(): Set<string> {
  return readJsonArray(EXCLUDED_PATH);
}

/**
 * Add file paths to the permanent exclusion list.
 * Called by the server when an agent is explicitly deleted.
 */
export function excludeSessions(filePaths: string[]): void {
  if (filePaths.length === 0) return;
  const existing = readJsonArray(EXCLUDED_PATH);
  for (const p of filePaths) existing.add(p);
  writeJsonArray(EXCLUDED_PATH, existing);
}
