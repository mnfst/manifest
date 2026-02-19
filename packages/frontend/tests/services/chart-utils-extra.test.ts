import { describe, it, expect } from "vitest";
import { parseTimestamps } from "../../src/services/chart-utils.js";

describe("parseTimestamps edge cases", () => {
  it("handles timestamps with T separator", () => {
    const data = [{ hour: "2026-02-16T09:00:00" }];
    const result = parseTimestamps(data);
    expect(result).toHaveLength(1);
    expect(result[0]).toBeGreaterThan(0);
  });

  it("handles timestamps with space separator", () => {
    const data = [{ hour: "2026-02-16 09:00" }];
    const result = parseTimestamps(data);
    expect(result).toHaveLength(1);
    expect(result[0]).toBeGreaterThan(0);
  });

  it("produces epoch seconds (not milliseconds)", () => {
    const data = [{ hour: "2026-02-16T00:00:00" }];
    const result = parseTimestamps(data);
    // Epoch seconds for 2026-02-16 should be around 1.77 billion, not trillions
    expect(result[0]).toBeLessThan(2_000_000_000);
    expect(result[0]).toBeGreaterThan(1_000_000_000);
  });

  it("handles date-only entries without hour field", () => {
    const data = [
      { date: "2026-02-15" },
      { date: "2026-02-16" },
    ];
    const result = parseTimestamps(data);
    expect(result).toHaveLength(2);
    // One day = 86400 seconds
    expect(result[1]! - result[0]!).toBe(86400);
  });

  it("handles mixed data with extra record fields", () => {
    const data = [
      { hour: "2026-02-16 09:00", input_tokens: 100, output_tokens: 50 },
      { hour: "2026-02-16 10:00", input_tokens: 200, output_tokens: 80 },
    ];
    const result = parseTimestamps(data);
    expect(result).toHaveLength(2);
    expect(result[1]! - result[0]!).toBe(3600);
  });

  it("returns consistent results for sequential hours", () => {
    const hours = Array.from({ length: 24 }, (_, i) => ({
      hour: `2026-02-16 ${String(i).padStart(2, "0")}:00`,
    }));
    const result = parseTimestamps(hours);
    expect(result).toHaveLength(24);

    for (let i = 1; i < result.length; i++) {
      expect(result[i]! - result[i - 1]!).toBe(3600);
    }
  });

  it("returns consistent results for sequential days", () => {
    const days = [
      { date: "2026-02-14" },
      { date: "2026-02-15" },
      { date: "2026-02-16" },
    ];
    const result = parseTimestamps(days);
    expect(result).toHaveLength(3);

    for (let i = 1; i < result.length; i++) {
      expect(result[i]! - result[i - 1]!).toBe(86400);
    }
  });
});
