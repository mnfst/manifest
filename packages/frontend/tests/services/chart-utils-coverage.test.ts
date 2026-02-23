import { describe, it, expect, vi } from "vitest";
import {
  makeGradientFill,
  makeGradientFillFromVar,
  createCursorSnap,
  createBaseAxes,
  rangeToSeconds,
  formatAxisTimestamp,
} from "../../src/services/chart-utils";

vi.mock("../../src/services/theme.js", () => ({
  getHslA: (cssVar: string, alpha: number) => `hsla(var(${cssVar}), ${alpha})`,
}));

describe("makeGradientFill", () => {
  it("returns a function", () => {
    const fill = makeGradientFill("red", "blue");
    expect(typeof fill).toBe("function");
  });

  it("returns topColor when bbox is not finite", () => {
    const fill = makeGradientFill("red", "blue") as Function;
    const mockU = { bbox: { top: NaN, height: 100 }, ctx: {} };
    const result = fill(mockU);
    expect(result).toBe("red");
  });

  it("returns topColor when bbox height is 0", () => {
    const fill = makeGradientFill("red", "blue") as Function;
    const mockU = { bbox: { top: 0, height: 0 }, ctx: {} };
    const result = fill(mockU);
    expect(result).toBe("red");
  });

  it("creates gradient when bbox is valid", () => {
    const fill = makeGradientFill("red", "blue") as Function;
    const mockGradient = { addColorStop: vi.fn() };
    const mockU = {
      bbox: { top: 10, height: 200 },
      ctx: { createLinearGradient: vi.fn().mockReturnValue(mockGradient) },
    };
    const result = fill(mockU);
    expect(mockU.ctx.createLinearGradient).toHaveBeenCalledWith(0, 10, 0, 210);
    expect(mockGradient.addColorStop).toHaveBeenCalledWith(0, "red");
    expect(mockGradient.addColorStop).toHaveBeenCalledWith(1, "blue");
    expect(result).toBe(mockGradient);
  });
});

describe("makeGradientFillFromVar", () => {
  it("returns a function using css var", () => {
    const fill = makeGradientFillFromVar("--chart-1", 0.3);
    expect(typeof fill).toBe("function");
  });
});

describe("createCursorSnap", () => {
  it("returns cursor config object", () => {
    const cursor = createCursorSnap("#fff", "#0f0");
    expect(cursor.show).toBe(true);
    expect(cursor.x).toBe(true);
    expect(cursor.y).toBe(false);
    expect(cursor.points?.show).toBe(true);
    expect(cursor.points?.size).toBe(8);
    expect(cursor.points?.fill).toBe("#0f0");
    expect(cursor.points?.stroke).toBe("#fff");
  });

  it("has move function that snaps to data points", () => {
    const cursor = createCursorSnap("#fff", "#0f0");
    expect(typeof cursor.move).toBe("function");

    // Test move function with mock uPlot
    const mockU = {
      posToIdx: vi.fn().mockReturnValue(2),
      data: [[100, 200, 300]],
      valToPos: vi.fn().mockReturnValue(150),
    };
    const result = (cursor.move as Function)(mockU, 100, 50);
    expect(result[0]).toBe(150);
    expect(result[1]).toBe(50);
  });

  it("move returns original left when no data at index", () => {
    const cursor = createCursorSnap("#fff", "#0f0");
    const mockU = {
      posToIdx: vi.fn().mockReturnValue(null),
      data: [[]],
      valToPos: vi.fn(),
    };
    const result = (cursor.move as Function)(mockU, 100, 50);
    expect(result[0]).toBe(100);
  });
});

describe("createBaseAxes", () => {
  it("returns array of 2 axes", () => {
    const axes = createBaseAxes("#aaa", "#eee");
    expect(axes).toHaveLength(2);
  });

  it("x-axis has correct stroke and grid", () => {
    const axes = createBaseAxes("#aaa", "#eee");
    expect(axes[0].stroke).toBe("#aaa");
    expect(axes[0].grid?.stroke).toBe("#eee");
  });

  it("y-axis has ticks hidden", () => {
    const axes = createBaseAxes("#aaa", "#eee");
    expect(axes[1].ticks?.show).toBe(false);
  });

  it("x-axis values formatter uses range when provided", () => {
    const axes = createBaseAxes("#aaa", "#eee", "24h");
    const mockU = { scales: { x: {} } } as any;
    const epoch = Date.UTC(2024, 0, 15, 10, 30) / 1000;
    const formatted = (axes[0].values as Function)(mockU, [epoch]);
    expect(formatted[0]).toBe("10:30");
  });

  it("x-axis values formatter calculates span from u.scales when no range", () => {
    const axes = createBaseAxes("#aaa", "#eee");
    const epoch = Date.UTC(2024, 0, 15, 10, 30) / 1000;
    const mockU = { scales: { x: { min: epoch - 3600, max: epoch } } } as any;
    const formatted = (axes[0].values as Function)(mockU, [epoch]);
    expect(formatted[0]).toBe("10:30"); // short range = HH:MM
  });
});

describe("formatAxisTimestamp edge cases", () => {
  it("shows date for exactly 86400s boundary", () => {
    const epoch = Date.UTC(2024, 5, 15, 0, 0) / 1000;
    const result = formatAxisTimestamp(epoch, 86400);
    expect(result).toBe("00:00");
  });

  it("shows just date for range just over 86400", () => {
    const epoch = Date.UTC(2024, 5, 15, 14, 30) / 1000;
    const result = formatAxisTimestamp(epoch, 86401);
    expect(result).toBe("Jun 15");
  });

  it("shows just date for range over 7d", () => {
    const epoch = Date.UTC(2024, 11, 25, 8, 0) / 1000;
    const result = formatAxisTimestamp(epoch, 30 * 86400);
    expect(result).toBe("Dec 25");
  });
});

describe("rangeToSeconds edge cases", () => {
  it("returns 86400 for empty string", () => {
    expect(rangeToSeconds("")).toBe(86400);
  });
});

// Import additional functions for testing
import { parseTimestamps, timeScaleRange } from "../../src/services/chart-utils";

describe("parseTimestamps", () => {
  it("parses hour-based timestamps", () => {
    const data = [{ hour: "2024-01-15 10:00" }, { hour: "2024-01-15 11:00" }];
    const result = parseTimestamps(data);
    expect(result).toHaveLength(2);
    expect(typeof result[0]).toBe("number");
    expect(result[0]).toBeGreaterThan(0);
  });

  it("parses date-based timestamps", () => {
    const data = [{ date: "2024-01-15" }, { date: "2024-01-16" }];
    const result = parseTimestamps(data);
    expect(result).toHaveLength(2);
    expect(result[1]).toBeGreaterThan(result[0]);
  });

  it("returns empty array for empty input", () => {
    const result = parseTimestamps([]);
    expect(result).toHaveLength(0);
  });
});

describe("timeScaleRange", () => {
  it("returns padded range when span is less than MIN_SPAN", () => {
    const [min, max] = timeScaleRange(null as any, 1000, 2000);
    // MIN_SPAN is 6h = 21600s, so span 1000 < 21600
    const mid = (1000 + 2000) / 2;
    expect(min).toBe(mid - 10800);
    expect(max).toBe(mid + 10800);
  });

  it("returns original range when span is >= MIN_SPAN", () => {
    const start = 1000;
    const end = start + 30000; // 30000 > 21600
    const [min, max] = timeScaleRange(null as any, start, end);
    expect(min).toBe(start);
    expect(max).toBe(end);
  });

  it("handles exact MIN_SPAN boundary", () => {
    const start = 0;
    const end = 21600; // exactly MIN_SPAN
    const [min, max] = timeScaleRange(null as any, start, end);
    expect(min).toBe(start);
    expect(max).toBe(end);
  });
});
