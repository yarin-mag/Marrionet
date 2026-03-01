import { useState, useEffect } from "react";

/**
 * Returns a live-updating `Date.now()` value, refreshed every `intervalMs` milliseconds.
 * Use this in components that need elapsed-time displays to tick in real time.
 */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
