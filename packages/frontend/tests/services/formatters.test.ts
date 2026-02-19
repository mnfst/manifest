import { describe, it, expect, vi, afterEach } from "vitest";
import { formatNumber, formatCost, formatTrend, formatTime, formatRelativeTime } from "../../src/services/formatters.js";

describe("formatNumber", () => {
  it("formats millions", () => {
    expect(formatNumber(1_200_000)).toBe("1.2M");
    expect(formatNumber(304_300_000)).toBe("304.3M");
  });

  it("formats thousands", () => {
    expect(formatNumber(304_300)).toBe("304.3k");
    expect(formatNumber(1_800)).toBe("1.8k");
    expect(formatNumber(182_100)).toBe("182.1k");
  });

  it("formats small numbers as-is", () => {
    expect(formatNumber(342)).toBe("342");
    expect(formatNumber(0)).toBe("0");
    expect(formatNumber(999)).toBe("999");
  });
});

describe("formatCost", () => {
  it("formats USD cost", () => {
    expect(formatCost(6.18)).toBe("$6.18");
    expect(formatCost(17.5)).toBe("$17.50");
    expect(formatCost(0.41)).toBe("$0.41");
    expect(formatCost(8.68)).toBe("$8.68");
  });
});

describe("formatTrend", () => {
  it("formats positive trends", () => {
    expect(formatTrend(18)).toBe("+18%");
    expect(formatTrend(4)).toBe("+4%");
  });

  it("formats negative trends", () => {
    expect(formatTrend(-7)).toBe("-7%");
    expect(formatTrend(-12)).toBe("-12%");
  });

  it("formats zero", () => {
    expect(formatTrend(0)).toBe("+0%");
  });
});

describe("formatTime", () => {
  it("formats ISO timestamp to HH:MM:SS", () => {
    const result = formatTime("2026-02-16T09:22:41Z");
    expect(result).toMatch(/\d{2}:\d{2}:\d{2}/);
  });
});

describe("formatRelativeTime", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns time string for today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-16T12:00:00Z"));

    const result = formatRelativeTime("2026-02-16T09:22:41Z");
    expect(result).toMatch(/\d{2}:\d{2}:\d{2}/);
  });

  it("returns 'Yesterday' for previous day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-17T12:00:00Z"));

    const result = formatRelativeTime("2026-02-16T09:22:41Z");
    expect(result).toBe("Yesterday");
  });

  it("returns formatted date for older dates", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-20T12:00:00Z"));

    const result = formatRelativeTime("2026-02-14T09:22:41Z");
    expect(result).toContain("Feb");
    expect(result).toContain("14");
  });

  it("handles boundary at exactly 1 day ago", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-17T09:22:41Z"));

    const result = formatRelativeTime("2026-02-16T09:22:41Z");
    expect(result).toBe("Yesterday");
  });
});
