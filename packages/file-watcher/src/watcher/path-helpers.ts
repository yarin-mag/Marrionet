import { normalize } from "node:path";
import { config } from "../config.js";
import { log } from "../logger.js";

function toForwardSlashes(p: string): string {
  return normalize(p).replace(/\\/g, "/");
}

const projectsDirFwd = toForwardSlashes(config.projectsDir);

function parsePath(filePath: string): { rel: string; parts: string[] } {
  const fwd = toForwardSlashes(filePath);
  const rel = fwd.startsWith(projectsDirFwd + "/")
    ? fwd.slice(projectsDirFwd.length + 1)
    : fwd;
  return { rel, parts: rel.split("/") };
}

/** `projects/{slug}/subagents/agent-*.jsonl` */
export function isSubagentFile(filePath: string): boolean {
  return parsePath(filePath).rel.includes("/subagents/");
}

/** `projects/{slug}/{uuid}.jsonl`  (depth = 2 after stripping projectsDir) */
export function isMainSessionFile(filePath: string): boolean {
  const { parts } = parsePath(filePath);
  return parts.length === 2 && parts[1].endsWith(".jsonl");
}

export function extractPathComponents(filePath: string): { slug: string; sessionId: string } {
  const { parts } = parsePath(filePath);
  if (!parts[0]) {
    log.warn(`Could not derive slug from path: ${filePath} — using full path as key`);
  }
  const slug = parts[0] ?? filePath.replace(/[^a-zA-Z0-9_-]/g, "-");
  const sessionId = (parts[1] ?? filePath).replace(/\.jsonl$/, "");
  return { slug, sessionId };
}
