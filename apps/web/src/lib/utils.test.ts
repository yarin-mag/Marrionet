import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { formatTokens, extractFolder, formatDuration, formatTime } from "./utils";

describe("formatTokens", () => {
  it("returns exact number string under 1000", () => {
    expect(formatTokens(0)).toBe("0");
    expect(formatTokens(1)).toBe("1");
    expect(formatTokens(999)).toBe("999");
  });

  it("formats thousands with K suffix", () => {
    expect(formatTokens(1000)).toBe("1.0K");
    expect(formatTokens(1500)).toBe("1.5K");
    expect(formatTokens(10000)).toBe("10.0K");
    expect(formatTokens(999900)).toBe("999.9K");
  });

  it("formats millions with M suffix", () => {
    expect(formatTokens(1000000)).toBe("1.0M");
    expect(formatTokens(1500000)).toBe("1.5M");
    expect(formatTokens(10000000)).toBe("10.0M");
  });
});

describe("extractFolder", () => {
  it("returns 'unknown' for undefined or empty input", () => {
    expect(extractFolder(undefined)).toBe("unknown");
    expect(extractFolder("")).toBe("unknown");
  });

  it("returns last path segment", () => {
    expect(extractFolder("/home/user/project")).toBe("project");
    expect(extractFolder("/home/user/my-app")).toBe("my-app");
  });

  it("returns path itself when no slashes", () => {
    expect(extractFolder("project")).toBe("project");
  });

  it("returns 'root' for trailing slash or root path", () => {
    expect(extractFolder("/")).toBe("root");
    expect(extractFolder("/home/user/")).toBe("root");
  });
});

describe("formatDuration", () => {
  it("returns '0s' for undefined or 0", () => {
    expect(formatDuration(undefined)).toBe("0s");
    expect(formatDuration(0)).toBe("0s");
  });

  it("formats seconds only", () => {
    expect(formatDuration(1000)).toBe("1s");
    expect(formatDuration(59000)).toBe("59s");
  });

  it("formats minutes and seconds", () => {
    expect(formatDuration(60000)).toBe("1m 0s");
    expect(formatDuration(90000)).toBe("1m 30s");
    expect(formatDuration(3599000)).toBe("59m 59s");
  });

  it("formats hours and minutes", () => {
    expect(formatDuration(3600000)).toBe("1h 0m");
    expect(formatDuration(3661000)).toBe("1h 1m");
    expect(formatDuration(7200000)).toBe("2h 0m");
  });
});

describe("formatTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'never' for undefined input", () => {
    expect(formatTime(undefined)).toBe("never");
  });

  it("returns seconds ago for recent timestamps", () => {
    vi.setSystemTime(new Date("2024-06-01T12:00:30Z"));
    expect(formatTime("2024-06-01T12:00:00Z")).toBe("30s ago");
  });

  it("returns minutes ago", () => {
    vi.setSystemTime(new Date("2024-06-01T12:05:00Z"));
    expect(formatTime("2024-06-01T12:00:00Z")).toBe("5m ago");
  });

  it("returns hours ago", () => {
    vi.setSystemTime(new Date("2024-06-01T15:00:00Z"));
    expect(formatTime("2024-06-01T12:00:00Z")).toBe("3h ago");
  });

  it("normalizes SQLite timestamps (no timezone) to UTC", () => {
    vi.setSystemTime(new Date("2024-06-01T12:00:59Z"));
    // SQLite format: space separator, no Z suffix → should be treated as UTC
    expect(formatTime("2024-06-01 12:00:00")).toBe("59s ago");
  });
});
