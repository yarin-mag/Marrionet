import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { log } from "./logger.js";

/** Track the byte offset we've read up to per file path */
const fileOffsets = new Map<string, number>();

export interface JsonlLine {
  parsed: Record<string, unknown>;
  raw: string;
}

/**
 * Read new JSONL lines appended since the last call for this file.
 * Returns both the parsed object and the raw string for each complete new line.
 */
export async function readNewLines(filePath: string): Promise<JsonlLine[]> {
  try {
    const stats = await stat(filePath);
    const offset = fileOffsets.get(filePath) ?? 0;

    if (stats.size <= offset) {
      return [];
    }

    const chunk = await readRange(filePath, offset, stats.size);
    fileOffsets.set(filePath, stats.size);

    if (fileOffsets.size > 500) {
      log.warn(`fileOffsets has ${fileOffsets.size} entries — possible leak`);
    }

    return chunk
      .split(/\r?\n/)
      .filter((l) => l.trim().length > 0)
      .flatMap((l) => {
        try {
          return [{ parsed: JSON.parse(l) as Record<string, unknown>, raw: l }];
        } catch {
          log.warn("Skipping malformed JSONL line:", l.slice(0, 80));
          return [];
        }
      });
  } catch {
    return [];
  }
}

/**
 * Mark a file as unread (call when a new file is detected so we start from 0).
 */
export function resetOffset(filePath: string): void {
  fileOffsets.delete(filePath);
}

/**
 * Remove a file's byte-offset entry entirely (call when a file is deleted so
 * the Map doesn't accumulate stale entries for gone files).
 */
export function clearOffset(filePath: string): void {
  fileOffsets.delete(filePath);
}

/**
 * Clear all tracked offsets (called by watcher stop() for clean shutdown).
 */
export function clearAllOffsets(): void {
  fileOffsets.clear();
}

/**
 * Advance the byte offset to the current end of the file without reading content.
 * Call for already-scanned files on restart so the live watcher only picks up
 * bytes written after Marionette started — not the full historical content.
 */
export async function setOffsetToEnd(filePath: string): Promise<void> {
  try {
    const stats = await stat(filePath);
    fileOffsets.set(filePath, stats.size);
  } catch {
    // File might have been deleted — leave offset unset (defaults to 0)
  }
}

function readRange(filePath: string, start: number, end: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const stream = createReadStream(filePath, { start, end: end - 1 });
    stream.on("data", (chunk: string | Buffer) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    stream.on("error", (err) => {
      stream.destroy();
      reject(err);
    });
  });
}
