import { describe, it, expect } from "vitest";
import { formatNumber, formatCost, formatTrend, formatStatus, formatMetricType, formatRelativeTime, formatTime } from "../../src/services/formatters";

describe("formatNumber", () => {
  it("formats millions", () => {
    expect(formatNumber(1_200_000)).toBe("1.2M");
    expect(formatNumber(5_000_000)).toBe("5.0M");
  });
  it("formats thousands", () => {
    expect(formatNumber(1_500)).toBe("1.5k");
    expect(formatNumber(304_300)).toBe("304.3k");
  });
  it("returns plain number below 1000", () => {
    expect(formatNumber(42)).toBe("42");
    expect(formatNumber(999)).toBe("999");
    expect(formatNumber(0)).toBe("0");
  });
});

describe("formatCost", () => {
  it("formats with dollar sign and 2 decimals", () => {
    expect(formatCost(6.18)).toBe("$6.18");
    expect(formatCost(0)).toBe("$0.00");
    expect(formatCost(17.5)).toBe("$17.50");
  });
});

describe("formatTrend", () => {
  it("adds + for positive", () => {
    expect(formatTrend(18.4)).toBe("+18%");
  });
  it("shows - for negative", () => {
    expect(formatTrend(-7.2)).toBe("-7%");
  });
  it("adds + for zero", () => {
    expect(formatTrend(0)).toBe("+0%");
  });
});

describe("formatStatus", () => {
  it("maps known statuses", () => {
    expect(formatStatus("ok")).toBe("Success");
    expect(formatStatus("retry")).toBe("Retried");
    expect(formatStatus("error")).toBe("Failed");
  });
  it("handles case insensitive", () => {
    expect(formatStatus("OK")).toBe("Success");
    expect(formatStatus("Error")).toBe("Failed");
  });
  it("returns original for unknown status", () => {
    expect(formatStatus("custom")).toBe("custom");
  });
});

describe("formatMetricType", () => {
  it("maps known metric types", () => {
    expect(formatMetricType("tokens")).toBe("Token usage");
    expect(formatMetricType("cost")).toBe("Cost");
  });
  it("returns original for unknown type", () => {
    expect(formatMetricType("latency")).toBe("latency");
  });
});

describe("formatTime", () => {
  it("formats a UTC timestamp", () => {
    const result = formatTime("2024-01-15T09:22:41Z");
    expect(result).toMatch(/\d{2}:\d{2}:\d{2}/);
  });
  it("handles space-separated timestamp", () => {
    const result = formatTime("2024-01-15 09:22:41");
    expect(result).toMatch(/\d{2}:\d{2}:\d{2}/);
  });
});

describe("formatRelativeTime", () => {
  it("returns time string for today", () => {
    const now = new Date();
    const ts = now.toISOString();
    const result = formatRelativeTime(ts);
    expect(result).toMatch(/\d{2}:\d{2}:\d{2}/);
  });
  it("returns Yesterday for yesterday", () => {
    const yesterday = new Date(Date.now() - 86_400_000 - 1000);
    const ts = yesterday.toISOString();
    const result = formatRelativeTime(ts);
    expect(result).toBe("Yesterday");
  });
  it("returns date for older dates", () => {
    const oldDate = new Date(Date.now() - 5 * 86_400_000);
    const ts = oldDate.toISOString();
    const result = formatRelativeTime(ts);
    expect(result).toMatch(/\w+ \d+/);
  });
});
