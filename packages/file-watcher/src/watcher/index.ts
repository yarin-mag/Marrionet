import chokidar from "chokidar";
import { config } from "../config.js";
import { clearAllOffsets } from "../jsonl-reader.js";
import { log } from "../logger.js";
import { fileStates, activeFilePerSlug } from "./state.js";
import { handleNewFile, handleFileChanged, handleFileRemoved } from "./file-handlers.js";
import { createInactivityTimer } from "./inactivity-detector.js";
import type { EmitFn } from "./types.js";

export { scanHistoricalSessions } from "./historical-scanner.js";

let _watcherActive = false;

function registerWatcherEvents(watcher: ReturnType<typeof chokidar.watch>, emit: EmitFn): void {
  watcher.on("add", (filePath: string) => {
    if (!filePath.endsWith(".jsonl")) return;
    handleNewFile(filePath, emit).catch((err) =>
      log.error("add handler error:", err)
    );
  });

  watcher.on("change", (filePath: string) => {
    if (!filePath.endsWith(".jsonl")) return;
    handleFileChanged(filePath, emit).catch((err) =>
      log.error("change handler error:", err)
    );
  });

  watcher.on("unlink", (filePath: string) => {
    if (!filePath.endsWith(".jsonl")) return;
    handleFileRemoved(filePath, emit);
  });

  watcher.on("error", (err: unknown) => {
    log.error("chokidar error:", err);
  });
}

/**
 * Start watching `~/.claude/projects/**\/*.jsonl`.
 * Returns a `stop` function that closes the watcher.
 */
export function startWatcher(emit: EmitFn): () => Promise<void> {
  if (_watcherActive) {
    throw new Error("[file-watcher] startWatcher() called while already running — call stop() first");
  }
  _watcherActive = true;

  // TODO: chokidar v4 glob patterns are broken on macOS (patterns silently match nothing).
  // Until this is fixed upstream, we watch the entire projectsDir and filter .jsonl manually
  // in each event handler. Track: https://github.com/paulmillr/chokidar/issues/1317
  const watcher = chokidar.watch(config.projectsDir, {
    ignoreInitial: true,
    persistent: true,
    depth: 3,
    awaitWriteFinish: {
      stabilityThreshold: 100,
      pollInterval: 50,
    },
  });

  registerWatcherEvents(watcher, emit);
  const inactivityTimer = createInactivityTimer(emit);

  return async () => {
    _watcherActive = false;
    clearInterval(inactivityTimer);
    await watcher.close();
    fileStates.clear();
    activeFilePerSlug.clear();
    clearAllOffsets();
  };
}
