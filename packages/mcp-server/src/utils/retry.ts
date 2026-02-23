/**
 * Calls `fn` every `intervalMs` milliseconds.
 * Returns a stop function that cancels the retry loop.
 *
 * @example
 * const stop = withRetry(() => maybeTryReconnect(), 30_000);
 * // later...
 * stop(); // cancels the loop
 */
export function withRetry(fn: () => void, intervalMs: number): () => void {
  const id = setInterval(fn, intervalMs);
  return () => clearInterval(id);
}