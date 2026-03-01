export const log = {
  info:  (...args: unknown[]) => console.log("[file-watcher]",  ...args),
  warn:  (...args: unknown[]) => console.warn("[file-watcher]", ...args),
  error: (...args: unknown[]) => console.error("[file-watcher]", ...args),
};
