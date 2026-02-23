import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind classes with proper override handling
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format timestamp to relative time
 */
export function formatTime(isoString?: string): string {
  if (!isoString) return "never";
  // SQLite CURRENT_TIMESTAMP returns "2024-01-01 12:00:00" without timezone —
  // browsers parse that as local time. Normalize to UTC.
  const normalized =
    isoString.includes("Z") || isoString.includes("+")
      ? isoString
      : isoString.replace(" ", "T") + "Z";
  const date = new Date(normalized);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);

  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  return date.toLocaleDateString();
}

/**
 * Format tokens with K/M suffixes
 */
export function formatTokens(tokens: number): string {
  if (tokens < 1000) return tokens.toString();
  if (tokens < 1000000) return `${(tokens / 1000).toFixed(1)}K`;
  return `${(tokens / 1000000).toFixed(1)}M`;
}

/**
 * Extract folder name from path
 */
export function extractFolder(cwd?: string): string {
  if (!cwd) return "unknown";
  const parts = cwd.split("/");
  return parts[parts.length - 1] || "root";
}

/**
 * Format duration in milliseconds to human readable
 */
export function formatDuration(ms?: number): string {
  if (!ms) return "0s";
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}
