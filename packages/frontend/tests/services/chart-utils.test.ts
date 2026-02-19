import { describe, it, expect } from "vitest";
import { parseTimestamps, formatAxisTimestamp, timeScaleRange, rangeToSeconds } from "../../src/services/chart-utils.js";

describe("parseTimestamps", () => {
  it("parses ISO date strings from hour field", () => {
    const data = [
      { hour: "2026-02-16 09:00", value: 100 },
      { hour: "2026-02-16 10:00", value: 200 },
    ];
    const result = parseTimestamps(data);
    expect(result).toHaveLength(2);
    expect(result[0]).toBeGreaterThan(0);
    expect(result[1]! - result[0]!).toBe(3600);
  });

  it("parses ISO date strings from date field", () => {
    const data = [
      { date: "2026-02-15", count: 10 },
      { date: "2026-02-16", count: 20 },
    ];
    const result = parseTimestamps(data);
    expect(result).toHaveLength(2);
    expect(result[1]! - result[0]!).toBe(86400);
  });

  it("prefers hour over date when both present", () => {
    const data = [{ hour: "2026-02-16 09:00", date: "2026-02-16", value: 1 }];
    const hourOnly = [{ hour: "2026-02-16 09:00", value: 1 }];
    const resultBoth = parseTimestamps(data);
    const resultHourOnly = parseTimestamps(hourOnly);
    expect(resultBoth[0]).toBe(resultHourOnly[0]);
  });

  it("returns empty array for empty input", () => {
    expect(parseTimestamps([])).toEqual([]);
  });
});

describe("formatAxisTimestamp", () => {
  // 2026-02-18 14:30:00 UTC
  const epoch = Date.UTC(2026, 1, 18, 14, 30, 0) / 1000;

  it('returns "HH:MM" for 1h range', () => {
    expect(formatAxisTimestamp(epoch, 3600)).toBe("14:30");
  });

  it('returns "HH:MM" for 24h range', () => {
    expect(formatAxisTimestamp(epoch, 86400)).toBe("14:30");
  });

  it('returns "Mon DD HH:MM" for 7d range', () => {
    expect(formatAxisTimestamp(epoch, 7 * 86400)).toBe("Feb 18 14:30");
  });

  it('returns "Mon DD" for 30d range', () => {
    expect(formatAxisTimestamp(epoch, 30 * 86400)).toBe("Feb 18");
  });
});

describe("rangeToSeconds", () => {
  it("maps known range strings to seconds", () => {
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

describe("timeScaleRange", () => {
  const fakeU = {} as Parameters<typeof timeScaleRange>[0];

  it("pads range when span < 6 hours", () => {
    const [min, max] = timeScaleRange(fakeU, 1000, 2000);
    expect(max - min).toBe(6 * 3600);
  });

  it("returns original range when span >= 6 hours", () => {
    const sixH = 6 * 3600;
    const [min, max] = timeScaleRange(fakeU, 0, sixH);
    expect(min).toBe(0);
    expect(max).toBe(sixH);
  });

  it("centers the padded range around the midpoint", () => {
    const [min, max] = timeScaleRange(fakeU, 1000, 2000);
    const mid = (1000 + 2000) / 2;
    expect(min).toBe(mid - 3 * 3600);
    expect(max).toBe(mid + 3 * 3600);
  });
});
