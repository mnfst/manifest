import { describe, it, expect } from "vitest";
import { rangeToSeconds, formatAxisTimestamp, parseTimestamps, timeScaleRange } from "../../src/services/chart-utils";

describe("rangeToSeconds", () => {
  it("returns correct seconds for known ranges", () => {
    expect(rangeToSeconds("1h")).toBe(3600);
    expect(rangeToSeconds("6h")).toBe(21600);
    expect(rangeToSeconds("24h")).toBe(86400);
    expect(rangeToSeconds("7d")).toBe(604800);
    expect(rangeToSeconds("30d")).toBe(2592000);
  });
  it("defaults to 86400 for unknown range", () => {
    expect(rangeToSeconds("unknown")).toBe(86400);
  });
});

describe("formatAxisTimestamp", () => {
  it("shows HH:MM for short ranges", () => {
    const epoch = Date.UTC(2024, 0, 15, 10, 30) / 1000;
    const result = formatAxisTimestamp(epoch, 3600);
    expect(result).toBe("10:30");
  });
  it("shows date + time for weekly range", () => {
    const epoch = Date.UTC(2024, 0, 15, 10, 30) / 1000;
    const result = formatAxisTimestamp(epoch, 604800);
    expect(result).toBe("Jan 15 10:30");
  });
  it("shows just date for monthly range", () => {
    const epoch = Date.UTC(2024, 0, 15, 10, 30) / 1000;
    const result = formatAxisTimestamp(epoch, 2592000);
    expect(result).toBe("Jan 15");
  });
});

describe("parseTimestamps", () => {
  it("parses hour-based timestamps", () => {
    const data = [{ hour: "2024-01-15 10:00:00" }];
    const result = parseTimestamps(data);
    expect(result).toHaveLength(1);
    expect(typeof result[0]).toBe("number");
  });
  it("parses date-based timestamps", () => {
    const data = [{ date: "2024-01-15" }];
    const result = parseTimestamps(data);
    expect(result).toHaveLength(1);
    expect(typeof result[0]).toBe("number");
  });
});

describe("timeScaleRange", () => {
  it("expands small ranges to minimum 6 hours", () => {
    const [min, max] = timeScaleRange(null as any, 100, 200);
    const span = max - min;
    expect(span).toBe(6 * 3600);
  });
  it("keeps range when span is larger than minimum", () => {
    const [min, max] = timeScaleRange(null as any, 0, 100000);
    expect(min).toBe(0);
    expect(max).toBe(100000);
  });
});
