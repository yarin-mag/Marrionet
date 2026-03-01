import { mkdir, appendFile } from "node:fs/promises";
import { join } from "node:path";
import { config } from "./config.js";
import { log } from "./logger.js";

/** Dirs we've already created this process lifetime — avoids redundant mkdir calls */
const createdDirs = new Set<string>();

/**
 * Append a raw JSONL line to the session archive file.
 * Creates parent directories on first write. Non-fatal on error.
 */
export async function archiveLine(slug: string, sessionId: string, rawLine: string): Promise<void> {
  try {
    const dir = join(config.archiveDir, slug);
    if (!createdDirs.has(dir)) {
      await mkdir(dir, { recursive: true });
      createdDirs.add(dir);
    }
    try {
      await appendFile(join(dir, `${sessionId}.jsonl`), rawLine + "\n", { encoding: "utf8" });
    } catch {
      // Directory may have been deleted externally — evict from cache and retry once
      createdDirs.delete(dir);
      await mkdir(dir, { recursive: true });
      createdDirs.add(dir);
      await appendFile(join(dir, `${sessionId}.jsonl`), rawLine + "\n", { encoding: "utf8" });
    }
  } catch (err) {
    log.warn("[file-watcher] archive error:", err);
  }
}
