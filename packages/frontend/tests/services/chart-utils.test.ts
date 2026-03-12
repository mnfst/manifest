import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// --- Capture SolidJS lifecycle callbacks ---
let mountCb: (() => void) | null = null;
let cleanupCb: (() => void) | null = null;
let effectCb: (() => void) | null = null;

vi.mock("solid-js", () => ({
  onMount: (cb: () => void) => { mountCb = cb; },
  onCleanup: (cb: () => void) => { cleanupCb = cb; },
  createEffect: (cb: () => void) => { effectCb = cb; },
  on: (_dep: unknown, cb: () => void) => cb,
}));

vi.mock("../../src/services/theme.js", () => ({
  getHslA: (cssVar: string, alpha: number) => `hsla(var(${cssVar}), ${alpha})`,
}));

import {
  makeGradientFill,
  makeGradientFillFromVar,
  createCursorSnap,
  createBaseAxes,
  rangeToSeconds,
  formatAxisTimestamp,
  formatLegendTimestamp,
  createFormatLegendTimestamp,
  formatLegendCost,
  formatLegendTokens,
  isMultiDayRange,
  parseTimestamps,
  timeScaleRange,
  createTimeScaleRange,
  useChartLifecycle,
  sanitizeNumbers,
  fillDailyGaps,
} from "../../src/services/chart-utils";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Build expected local-time string from epoch seconds */
function localHHMM(epochSec: number): string {
  const d = new Date(epochSec * 1000);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function localMonDay(epochSec: number): string {
  const d = new Date(epochSec * 1000);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

function localMonDayHHMM(epochSec: number): string {
  return `${localMonDay(epochSec)}, ${localHHMM(epochSec)}`;
}

beforeEach(() => {
  mountCb = null;
  cleanupCb = null;
  effectCb = null;
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ---------- rangeToSeconds ----------

describe("rangeToSeconds", () => {
  it("returns correct seconds for known ranges", () => {
    expect(rangeToSeconds("1h")).toBe(3600);
    expect(rangeToSeconds("24h")).toBe(86400);
    expect(rangeToSeconds("7d")).toBe(604800);
    expect(rangeToSeconds("30d")).toBe(2592000);
  });

  it("defaults to 86400 for unknown range", () => {
    expect(rangeToSeconds("unknown")).toBe(86400);
  });

  it("defaults to 86400 for empty string", () => {
    expect(rangeToSeconds("")).toBe(86400);
  });
});

// ---------- isMultiDayRange ----------

describe("isMultiDayRange", () => {
  it("returns true for 7d", () => {
    expect(isMultiDayRange("7d")).toBe(true);
  });

  it("returns true for 30d", () => {
    expect(isMultiDayRange("30d")).toBe(true);
  });

  it("returns false for 24h", () => {
    expect(isMultiDayRange("24h")).toBe(false);
  });

  it("returns false for 1h", () => {
    expect(isMultiDayRange("1h")).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isMultiDayRange(undefined)).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isMultiDayRange("")).toBe(false);
  });
});

// ---------- formatAxisTimestamp ----------

describe("formatAxisTimestamp", () => {
  it("shows HH:MM for 1h range", () => {
    const epoch = Date.UTC(2024, 0, 15, 10, 30) / 1000;
    expect(formatAxisTimestamp(epoch, "1h")).toBe(localHHMM(epoch));
  });

  it("shows HH:MM for 24h range", () => {
    const epoch = Date.UTC(2024, 5, 15, 0, 0) / 1000;
    expect(formatAxisTimestamp(epoch, "24h")).toBe(localHHMM(epoch));
  });

  it("shows Mon Day for 7d range", () => {
    const epoch = Date.UTC(2024, 0, 15, 10, 30) / 1000;
    expect(formatAxisTimestamp(epoch, "7d")).toBe(localMonDay(epoch));
  });

  it("shows Mon Day for 30d range", () => {
    const epoch = Date.UTC(2024, 11, 25, 8, 0) / 1000;
    expect(formatAxisTimestamp(epoch, "30d")).toBe(localMonDay(epoch));
  });

  it("pads single-digit hours and minutes", () => {
    const epoch = Date.UTC(2024, 0, 1, 5, 3) / 1000;
    expect(formatAxisTimestamp(epoch, "1h")).toBe(localHHMM(epoch));
  });

  it("handles midnight UTC correctly", () => {
    const epoch = Date.UTC(2024, 0, 1, 0, 0) / 1000;
    expect(formatAxisTimestamp(epoch, "1h")).toBe(localHHMM(epoch));
  });

  it("uses all months correctly in local time", () => {
    for (let m = 0; m < 12; m++) {
      const epoch = Date.UTC(2024, m, 10) / 1000;
      expect(formatAxisTimestamp(epoch, "7d")).toBe(localMonDay(epoch));
    }
  });

  it("shows Mon Day for unknown range string (non-intraday fallback)", () => {
    const epoch = Date.UTC(2024, 5, 15, 14, 30) / 1000;
    expect(formatAxisTimestamp(epoch, "unknown")).toBe(localMonDay(epoch));
  });
});

// ---------- formatLegendTimestamp ----------

describe("formatLegendTimestamp", () => {
  it("formats epoch seconds as 'Mon DD, HH:MM' in local time", () => {
    const epoch = Date.UTC(2026, 1, 27, 9, 13, 59) / 1000;
    expect(formatLegendTimestamp(null as any, epoch)).toBe(localMonDayHHMM(epoch));
  });

  it("pads single-digit hours and minutes", () => {
    const epoch = Date.UTC(2024, 0, 5, 3, 7, 2) / 1000;
    expect(formatLegendTimestamp(null as any, epoch)).toBe(localMonDayHHMM(epoch));
  });

  it("handles midnight UTC correctly", () => {
    const epoch = Date.UTC(2024, 11, 25, 0, 0, 0) / 1000;
    expect(formatLegendTimestamp(null as any, epoch)).toBe(localMonDayHHMM(epoch));
  });

  it("returns dash for null value", () => {
    expect(formatLegendTimestamp(null as any, null as any)).toBe("");
  });

  it("returns dash for undefined value", () => {
    expect(formatLegendTimestamp(null as any, undefined as any)).toBe("");
  });

  it("returns dash for NaN value", () => {
    expect(formatLegendTimestamp(null as any, NaN)).toBe("");
  });
});

// ---------- formatLegendCost ----------

describe("formatLegendCost", () => {
  it("formats cost with dollar sign and two decimals", () => {
    expect(formatLegendCost(null as any, 15.5)).toBe("$15.50");
  });

  it("formats zero cost", () => {
    expect(formatLegendCost(null as any, 0)).toBe("$0.00");
  });

  it("formats sub-cent cost as '< $0.01'", () => {
    expect(formatLegendCost(null as any, 0.005)).toBe("< $0.01");
  });

  it("returns dash for null value", () => {
    expect(formatLegendCost(null as any, null as any)).toBe("");
  });

  it("returns dash for undefined value", () => {
    expect(formatLegendCost(null as any, undefined as any)).toBe("");
  });

  it("returns dash for NaN value", () => {
    expect(formatLegendCost(null as any, NaN)).toBe("");
  });
});

// ---------- formatLegendTokens ----------

describe("formatLegendTokens", () => {
  it("formats thousands with k suffix", () => {
    expect(formatLegendTokens(null as any, 20000)).toBe("20k");
  });

  it("formats millions with M suffix", () => {
    expect(formatLegendTokens(null as any, 1500000)).toBe("1.5M");
  });

  it("keeps small numbers as-is", () => {
    expect(formatLegendTokens(null as any, 500)).toBe("500");
  });

  it("formats zero", () => {
    expect(formatLegendTokens(null as any, 0)).toBe("0");
  });

  it("returns dash for null value", () => {
    expect(formatLegendTokens(null as any, null as any)).toBe("");
  });

  it("returns dash for undefined value", () => {
    expect(formatLegendTokens(null as any, undefined as any)).toBe("");
  });

  it("returns dash for NaN value", () => {
    expect(formatLegendTokens(null as any, NaN)).toBe("");
  });

  it("rounds near-integer thousands to avoid '.0' suffix", () => {
    expect(formatLegendTokens(null as any, 799999.9999)).toBe("800k");
  });

  it("rounds near-integer millions to avoid '.0' suffix", () => {
    expect(formatLegendTokens(null as any, 1999999.9999)).toBe("2M");
  });

  it("rounds small floating-point values", () => {
    expect(formatLegendTokens(null as any, 499.7)).toBe("500");
  });
});

// ---------- parseTimestamps ----------

describe("parseTimestamps", () => {
  it("parses hour-based timestamps", () => {
    const data = [{ hour: "2024-01-15 10:00:00" }];
    const result = parseTimestamps(data);
    expect(result).toHaveLength(1);
    expect(typeof result[0]).toBe("number");
    expect(result[0]).toBeGreaterThan(0);
  });

  it("parses date-based timestamps", () => {
    const data = [{ date: "2024-01-15" }];
    const result = parseTimestamps(data);
    expect(result).toHaveLength(1);
    expect(typeof result[0]).toBe("number");
  });

  it("returns empty array for empty input", () => {
    expect(parseTimestamps([])).toHaveLength(0);
  });

  it("produces epoch seconds, not milliseconds", () => {
    const data = [{ hour: "2026-02-16T00:00:00" }];
    const result = parseTimestamps(data);
    expect(result[0]).toBeLessThan(2_000_000_000);
    expect(result[0]).toBeGreaterThan(1_000_000_000);
  });

  it("produces correct sequential hour differences", () => {
    const data = [
      { hour: "2024-01-15 10:00" },
      { hour: "2024-01-15 11:00" },
    ];
    const result = parseTimestamps(data);
    expect(result[1]! - result[0]!).toBe(3600);
  });

  it("produces correct sequential day differences", () => {
    const data = [{ date: "2024-01-15" }, { date: "2024-01-16" }];
    const result = parseTimestamps(data);
    expect(result[1]! - result[0]!).toBe(86400);
  });

  it("prefers hour over date when both present", () => {
    const data = [{ hour: "2024-01-15 10:00", date: "2024-01-20" }];
    const result = parseTimestamps(data);
    // hour is checked first; parsed as local time (no 'Z')
    const expected = new Date(2024, 0, 15, 10, 0).getTime() / 1000;
    expect(result[0]).toBe(expected);
  });

  it("handles entries with extra record fields", () => {
    const data = [
      { hour: "2024-01-15 09:00", input_tokens: 100, output_tokens: 50 },
    ];
    const result = parseTimestamps(data);
    expect(result).toHaveLength(1);
    expect(result[0]).toBeGreaterThan(0);
  });

  it("falls back to empty string when neither hour nor date is present", () => {
    const data = [{ someOtherField: "value" } as any];
    const result = parseTimestamps(data);
    expect(result).toHaveLength(1);
    // Neither hour nor date → falls to date branch with '' → NaN
    expect(Number.isNaN(result[0])).toBe(true);
  });
});

// ---------- timeScaleRange ----------

describe("timeScaleRange", () => {
  it("expands small ranges to minimum 6 hours backward from max", () => {
    const now = Date.now() / 1000;
    const [min, max] = timeScaleRange(null as any, 100, 200);
    // max is clamped to min(200, now) = 200 (past timestamp), expand backward
    expect(max).toBe(200);
    expect(min).toBe(200 - 6 * 3600);
  });

  it("expands backward from clampedMax when span is small", () => {
    const [min, max] = timeScaleRange(null as any, 1000, 2000);
    expect(max).toBe(2000);
    expect(min).toBe(2000 - 6 * 3600);
    expect(max - min).toBe(6 * 3600);
  });

  it("keeps range when span equals MIN_SPAN exactly", () => {
    const end = 21600;
    const [min, max] = timeScaleRange(null as any, 0, end);
    expect(min).toBe(0);
    expect(max).toBe(end);
  });

  it("keeps range when span is larger than MIN_SPAN", () => {
    const [min, max] = timeScaleRange(null as any, 0, 100000);
    expect(min).toBe(0);
    expect(max).toBe(100000);
  });

  it("handles zero-width range by expanding backward", () => {
    const [min, max] = timeScaleRange(null as any, 5000, 5000);
    expect(max - min).toBe(6 * 3600);
    expect(max).toBe(5000);
    expect(min).toBe(5000 - 6 * 3600);
  });

  it("clamps max to current time when max is in the future", () => {
    const futureMax = Date.now() / 1000 + 100000;
    const pastMin = Date.now() / 1000 - 50000;
    const [min, max] = timeScaleRange(null as any, pastMin, futureMax);
    expect(max).toBeLessThanOrEqual(Date.now() / 1000);
    expect(min).toBe(pastMin);
  });
});

// ---------- createTimeScaleRange ----------

describe("createTimeScaleRange", () => {
  it("returns a function", () => {
    const fn = createTimeScaleRange("30d");
    expect(typeof fn).toBe("function");
  });

  it("returns exact data extent for 30d range (no padding)", () => {
    const fn = createTimeScaleRange("30d");
    const dataMin = 1000000;
    const dataMax = 1000000 + 30 * 86400;
    const [min, max] = fn(null as any, dataMin, dataMax);
    expect(min).toBe(dataMin);
    expect(max).toBe(dataMax);
  });

  it("returns exact data extent for 7d range (no padding)", () => {
    const fn = createTimeScaleRange("7d");
    const dataMin = 1000000;
    const dataMax = 1000000 + 7 * 86400;
    const [min, max] = fn(null as any, dataMin, dataMax);
    expect(min).toBe(dataMin);
    expect(max).toBe(dataMax);
  });

  it("forces full 24h span from now when range is 24h", () => {
    const fn = createTimeScaleRange("24h");
    const now = Date.now() / 1000;
    const [min, max] = fn(null as any, now - 1000, now);
    expect(max).toBeCloseTo(now, 0);
    expect(min).toBeCloseTo(now - 86400, 0);
  });

  it("forces full 1h span from now when range is 1h", () => {
    const fn = createTimeScaleRange("1h");
    const now = Date.now() / 1000;
    const [min, max] = fn(null as any, now - 100, now);
    expect(max).toBeCloseTo(now, 0);
    expect(min).toBeCloseTo(now - 3600, 0);
  });

  it("falls back to timeScaleRange logic when no range given (small span)", () => {
    const fn = createTimeScaleRange();
    const [min, max] = fn(null as any, 1000, 2000);
    // Small span, expands backward from clampedMax
    expect(max).toBe(2000);
    expect(min).toBe(2000 - 6 * 3600);
  });

  it("falls back to timeScaleRange logic when no range given (large span)", () => {
    const fn = createTimeScaleRange();
    const [min, max] = fn(null as any, 0, 100000);
    expect(min).toBe(0);
    expect(max).toBe(100000);
  });

  it("uses data min/max directly for multi-day range", () => {
    const fn = createTimeScaleRange("7d");
    const now = Date.now() / 1000;
    const dataMin = now - 3600;
    const [min, max] = fn(null as any, dataMin, now);
    expect(min).toBe(dataMin);
    expect(max).toBe(now);
  });
});

// ---------- makeGradientFill ----------

describe("makeGradientFill", () => {
  it("returns a function", () => {
    const fill = makeGradientFill("red", "blue");
    expect(typeof fill).toBe("function");
  });

  it("returns topColor when bbox.top is NaN", () => {
    const fill = makeGradientFill("red", "blue") as Function;
    const result = fill({ bbox: { top: NaN, height: 100 }, ctx: {} });
    expect(result).toBe("red");
  });

  it("returns topColor when bbox.height is NaN", () => {
    const fill = makeGradientFill("red", "blue") as Function;
    const result = fill({ bbox: { top: 10, height: NaN }, ctx: {} });
    expect(result).toBe("red");
  });

  it("returns topColor when bbox.height is 0", () => {
    const fill = makeGradientFill("red", "blue") as Function;
    const result = fill({ bbox: { top: 0, height: 0 }, ctx: {} });
    expect(result).toBe("red");
  });

  it("returns topColor when bbox.top is Infinity", () => {
    const fill = makeGradientFill("red", "blue") as Function;
    const result = fill({ bbox: { top: Infinity, height: 100 }, ctx: {} });
    expect(result).toBe("red");
  });

  it("returns topColor when bbox.height is -Infinity", () => {
    const fill = makeGradientFill("red", "blue") as Function;
    const result = fill({ bbox: { top: 10, height: -Infinity }, ctx: {} });
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

// ---------- makeGradientFillFromVar ----------

describe("makeGradientFillFromVar", () => {
  it("returns a function that delegates to makeGradientFill with theme colors", () => {
    const fill = makeGradientFillFromVar("--chart-1", 0.3);
    expect(typeof fill).toBe("function");
  });

  it("creates gradient using getHslA-derived top color and transparent bottom", () => {
    const fill = makeGradientFillFromVar("--chart-1", 0.5) as Function;
    const mockGradient = { addColorStop: vi.fn() };
    const mockU = {
      bbox: { top: 0, height: 100 },
      ctx: { createLinearGradient: vi.fn().mockReturnValue(mockGradient) },
    };
    fill(mockU);
    expect(mockGradient.addColorStop).toHaveBeenCalledWith(
      0,
      "hsla(var(--chart-1), 0.5)",
    );
    expect(mockGradient.addColorStop).toHaveBeenCalledWith(1, "transparent");
  });
});

// ---------- createCursorSnap ----------

describe("createCursorSnap", () => {
  it("returns cursor config with correct properties", () => {
    const cursor = createCursorSnap("#fff", "#0f0");
    expect(cursor.show).toBe(true);
    expect(cursor.x).toBe(true);
    expect(cursor.y).toBe(false);
    expect(cursor.drag).toEqual({ x: false, y: false });
    expect(cursor.points?.show).toBe(true);
    expect(cursor.points?.size).toBe(8);
    expect(cursor.points?.fill).toBe("#0f0");
    expect(cursor.points?.stroke).toBe("#fff");
    expect(cursor.points?.width).toBe(2);
    // idx is not set — setCursor({ left: -1 }) hides legend on load instead
    expect((cursor as any).idx).toBeUndefined();
  });

  it("move snaps to nearest data point when idx is valid", () => {
    const cursor = createCursorSnap("#fff", "#0f0");
    const mockU = {
      posToIdx: vi.fn().mockReturnValue(2),
      data: [[100, 200, 300]],
      valToPos: vi.fn().mockReturnValue(150),
    };
    const result = (cursor.move as Function)(mockU, 100, 50);
    expect(mockU.posToIdx).toHaveBeenCalledWith(100);
    expect(mockU.valToPos).toHaveBeenCalledWith(300, "x");
    expect(result).toEqual([150, 50]);
  });

  it("move returns original left when posToIdx returns null", () => {
    const cursor = createCursorSnap("#fff", "#0f0");
    const mockU = {
      posToIdx: vi.fn().mockReturnValue(null),
      data: [[]],
      valToPos: vi.fn(),
    };
    const result = (cursor.move as Function)(mockU, 100, 50);
    expect(result[0]).toBe(100);
    expect(result[1]).toBe(50);
  });

  it("move returns original left when data at idx is null", () => {
    const cursor = createCursorSnap("#fff", "#0f0");
    const mockU = {
      posToIdx: vi.fn().mockReturnValue(5),
      data: [[100, 200, 300]], // idx 5 is out of bounds => undefined
      valToPos: vi.fn(),
    };
    const result = (cursor.move as Function)(mockU, 77, 33);
    expect(result[0]).toBe(77);
    expect(result[1]).toBe(33);
  });

  it("move returns original left when data[0] is undefined", () => {
    const cursor = createCursorSnap("#fff", "#0f0");
    const mockU = {
      posToIdx: vi.fn().mockReturnValue(0),
      data: [],
      valToPos: vi.fn(),
    };
    const result = (cursor.move as Function)(mockU, 42, 10);
    expect(result[0]).toBe(42);
    expect(result[1]).toBe(10);
  });
});

// ---------- createBaseAxes ----------

describe("createBaseAxes", () => {
  it("returns array of 2 axes", () => {
    const axes = createBaseAxes("#aaa", "#eee");
    expect(axes).toHaveLength(2);
  });

  it("x-axis has correct stroke and grid", () => {
    const axes = createBaseAxes("#aaa", "#eee");
    expect(axes[0].stroke).toBe("#aaa");
    expect(axes[0].grid?.stroke).toBe("#eee");
    expect(axes[0].grid?.width).toBe(1);
    expect(axes[0].ticks?.stroke).toBe("#eee");
    expect(axes[0].font).toBe('11px "DM Sans", sans-serif');
    expect(axes[0].gap).toBe(8);
  });

  it("y-axis has ticks hidden and correct sizing", () => {
    const axes = createBaseAxes("#aaa", "#eee");
    expect(axes[1].stroke).toBe("#aaa");
    expect(axes[1].ticks?.show).toBe(false);
    expect(axes[1].font).toBe('11px "DM Sans", sans-serif');
    expect(axes[1].size).toBe(54);
    expect(axes[1].gap).toBe(8);
  });

  it("x-axis values formatter uses provided range", () => {
    const axes = createBaseAxes("#aaa", "#eee", "24h");
    const mockU = { scales: { x: {} } } as any;
    const epoch = Date.UTC(2024, 0, 15, 10, 30) / 1000;
    const formatted = (axes[0].values as Function)(mockU, [epoch]);
    expect(formatted[0]).toBe(localHHMM(epoch));
  });

  it("x-axis values formatter uses u.scales.x when no range provided", () => {
    const axes = createBaseAxes("#aaa", "#eee");
    const epoch = Date.UTC(2024, 0, 15, 10, 30) / 1000;
    const mockU = { scales: { x: { min: epoch - 3600, max: epoch } } } as any;
    const formatted = (axes[0].values as Function)(mockU, [epoch]);
    expect(formatted[0]).toBe(localHHMM(epoch));
  });

  it("x-axis values formatter falls back to vals array when scales.x has no min/max", () => {
    const axes = createBaseAxes("#aaa", "#eee");
    const epoch1 = Date.UTC(2024, 0, 15, 10, 0) / 1000;
    const epoch2 = Date.UTC(2024, 0, 15, 11, 0) / 1000;
    const mockU = { scales: { x: {} } } as any;
    const formatted = (axes[0].values as Function)(mockU, [epoch1, epoch2]);
    // span = epoch2 - epoch1 = 3600 (short range), so HH:MM format
    expect(formatted[0]).toBe(localHHMM(epoch1));
    expect(formatted[1]).toBe(localHHMM(epoch2));
  });

  it("x-axis values formatter handles missing scales.x entirely", () => {
    const axes = createBaseAxes("#aaa", "#eee");
    const epoch1 = Date.UTC(2024, 0, 15, 10, 0) / 1000;
    const epoch2 = Date.UTC(2024, 0, 15, 11, 0) / 1000;
    const mockU = { scales: {} } as any;
    const formatted = (axes[0].values as Function)(mockU, [epoch1, epoch2]);
    expect(formatted[0]).toBe(localHHMM(epoch1));
    expect(formatted[1]).toBe(localHHMM(epoch2));
  });

  it("x-axis values formatter handles empty vals array", () => {
    const axes = createBaseAxes("#aaa", "#eee");
    const mockU = { scales: { x: {} } } as any;
    const formatted = (axes[0].values as Function)(mockU, []);
    expect(formatted).toEqual([]);
  });

  it("x-axis values formatter with 7d range shows date format", () => {
    const axes = createBaseAxes("#aaa", "#eee", "7d");
    const epoch = Date.UTC(2024, 0, 15, 10, 30) / 1000;
    const mockU = { scales: {} } as any;
    const formatted = (axes[0].values as Function)(mockU, [epoch]);
    expect(formatted[0]).toBe(localMonDay(epoch));
  });

  it("x-axis values formatter deduplicates consecutive identical labels", () => {
    const axes = createBaseAxes("#aaa", "#eee", "7d");
    // Two epochs on the same local day should produce one label + one empty
    const d = new Date(2024, 0, 15, 0, 0);
    const ep1 = d.getTime() / 1000;
    const ep2 = ep1 + 3600; // 1 hour later, same day
    const mockU = { scales: {} } as any;
    const formatted = (axes[0].values as Function)(mockU, [ep1, ep2]);
    expect(formatted[0]).toBe(localMonDay(ep1));
    expect(formatted[1]).toBe("");
  });

  it("adds splits function for multi-day ranges (7d, 30d)", () => {
    expect(typeof (createBaseAxes("#aaa", "#eee", "7d")[0] as any).splits).toBe("function");
    expect(typeof (createBaseAxes("#aaa", "#eee", "30d")[0] as any).splits).toBe("function");
  });

  it("does not add splits function for intraday or undefined ranges", () => {
    expect((createBaseAxes("#aaa", "#eee", "24h")[0] as any).splits).toBeUndefined();
    expect((createBaseAxes("#aaa", "#eee", "1h")[0] as any).splits).toBeUndefined();
    expect((createBaseAxes("#aaa", "#eee")[0] as any).splits).toBeUndefined();
  });

  it("splits function returns u.data[0] array", () => {
    const axes = createBaseAxes("#aaa", "#eee", "7d");
    const splitsFn = (axes[0] as any).splits as Function;
    const mockData = [100, 200, 300];
    const mockU = { data: [mockData] };
    const result = splitsFn(mockU);
    expect(result).toEqual([100, 200, 300]);
  });

  it("values callback thins labels to every 5th for 30d range with 31 unique days", () => {
    const axes = createBaseAxes("#aaa", "#eee", "30d");
    const mockU = { scales: {} } as any;
    // Generate 31 unique day epochs (one per day)
    const vals: number[] = [];
    for (let i = 0; i < 31; i++) {
      vals.push(new Date(2024, 0, 1 + i, 0, 0).getTime() / 1000);
    }
    const result = (axes[0].values as Function)(mockU, vals);
    const nonEmpty = result.filter((l: string) => l !== "");
    // 31 unique labels, step=5 → labels at index 0,5,10,15,20,25,30 = 7 labels
    expect(nonEmpty).toHaveLength(7);
    // First label should be Jan 1
    expect(nonEmpty[0]).toBe(localMonDay(vals[0]));
  });

  it("values callback thins labels to every 3rd for 30d range with 16 unique days", () => {
    const axes = createBaseAxes("#aaa", "#eee", "30d");
    const mockU = { scales: {} } as any;
    // Generate 16 unique day epochs
    const vals: number[] = [];
    for (let i = 0; i < 16; i++) {
      vals.push(new Date(2024, 0, 1 + i, 0, 0).getTime() / 1000);
    }
    const result = (axes[0].values as Function)(mockU, vals);
    const nonEmpty = result.filter((l: string) => l !== "");
    // 16 unique labels, step=3 → labels at index 0,3,6,9,12,15 = 6 labels
    expect(nonEmpty).toHaveLength(6);
  });

  it("values callback does not thin labels for 7d range with 8 unique days", () => {
    const axes = createBaseAxes("#aaa", "#eee", "7d");
    const mockU = { scales: {} } as any;
    const vals: number[] = [];
    for (let i = 0; i < 8; i++) {
      vals.push(new Date(2024, 0, 1 + i, 0, 0).getTime() / 1000);
    }
    const result = (axes[0].values as Function)(mockU, vals);
    const nonEmpty = result.filter((l: string) => l !== "");
    // 8 unique labels, step=1 → all labels shown
    expect(nonEmpty).toHaveLength(8);
  });

  it("values callback preserves empty strings from dedup when thinning", () => {
    const axes = createBaseAxes("#aaa", "#eee", "30d");
    const mockU = { scales: {} } as any;
    // 31 unique days with a duplicate in the middle (same-day pair)
    const vals: number[] = [];
    for (let i = 0; i < 31; i++) {
      vals.push(new Date(2024, 0, 1 + i, 0, 0).getTime() / 1000);
    }
    // Add a duplicate of the last day (same local date)
    vals.push(new Date(2024, 0, 31, 12, 0).getTime() / 1000);
    const result = (axes[0].values as Function)(mockU, vals);
    // Last entry is a dedup empty string, should stay empty
    expect(result[result.length - 1]).toBe("");
  });
});

// ---------- useChartLifecycle ----------

describe("useChartLifecycle", () => {
  let mockEl: HTMLDivElement;
  let mockObserve: ReturnType<typeof vi.fn>;
  let mockDisconnect: ReturnType<typeof vi.fn>;
  let resizeCallback: ((entries: unknown[]) => void) | null;

  beforeEach(() => {
    mockEl = { clientWidth: 800 } as HTMLDivElement;
    mockObserve = vi.fn();
    mockDisconnect = vi.fn();
    resizeCallback = null;

    vi.stubGlobal("ResizeObserver", class {
      constructor(cb: (entries: unknown[]) => void) {
        resizeCallback = cb;
      }
      observe = mockObserve;
      disconnect = mockDisconnect;
      unobserve = vi.fn();
    });
  });

  function setupLifecycle(dataValues: unknown[] | undefined, buildChart: () => any) {
    useChartLifecycle({
      el: () => mockEl,
      data: () => dataValues,
      buildChart,
    });
  }

  it("registers onMount, onCleanup, and createEffect callbacks", () => {
    setupLifecycle([1, 2, 3], () => null);
    expect(mountCb).toBeTruthy();
    expect(cleanupCb).toBeTruthy();
    expect(effectCb).toBeTruthy();
  });

  it("onMount does nothing when data is empty", () => {
    setupLifecycle([], () => null);
    mountCb!();
    expect(mockObserve).not.toHaveBeenCalled();
  });

  it("onMount does nothing when data is undefined", () => {
    setupLifecycle(undefined, () => null);
    mountCb!();
    expect(mockObserve).not.toHaveBeenCalled();
  });

  it("onMount creates ResizeObserver and observes element when data has items", () => {
    setupLifecycle([1, 2], () => null);
    mountCb!();
    expect(mockObserve).toHaveBeenCalledWith(mockEl);
  });

  it("onMount schedules tryCreate via setTimeout(50)", () => {
    const buildChart = vi.fn().mockReturnValue({ destroy: vi.fn(), setCursor: vi.fn() });
    setupLifecycle([1, 2], buildChart);
    mountCb!();
    expect(buildChart).not.toHaveBeenCalled();
    vi.advanceTimersByTime(50);
    expect(buildChart).toHaveBeenCalledTimes(1);
  });

  it("tryCreate does not call buildChart if chart already exists", () => {
    const mockChart = { destroy: vi.fn(), setSize: vi.fn(), setCursor: vi.fn() };
    const buildChart = vi.fn().mockReturnValue(mockChart);
    setupLifecycle([1, 2], buildChart);
    mountCb!();

    // First call via setTimeout creates the chart
    vi.advanceTimersByTime(50);
    expect(buildChart).toHaveBeenCalledTimes(1);

    // Trigger ResizeObserver -- chart already exists, should call setSize
    resizeCallback!([]);
    expect(buildChart).toHaveBeenCalledTimes(1); // not called again
    expect(mockChart.setSize).toHaveBeenCalledWith({
      width: 800,
      height: 260,
    });
  });

  it("ResizeObserver callback calls tryCreate when chart is null", () => {
    const buildChart = vi.fn().mockReturnValue(null);
    setupLifecycle([1, 2], buildChart);
    mountCb!();

    // Trigger resize before setTimeout fires; chart is null
    resizeCallback!([]);
    expect(buildChart).toHaveBeenCalledTimes(1);
  });

  it("ResizeObserver callback resizes existing chart", () => {
    const mockChart = { destroy: vi.fn(), setSize: vi.fn(), setCursor: vi.fn() };
    const buildChart = vi.fn().mockReturnValue(mockChart);
    setupLifecycle([1, 2], buildChart);
    mountCb!();
    vi.advanceTimersByTime(50);

    (mockEl as any).clientWidth = 1200;
    resizeCallback!([]);
    expect(mockChart.setSize).toHaveBeenCalledWith({
      width: 1200,
      height: 260,
    });
  });

  it("tryCreate does not assign chart when buildChart returns null", () => {
    const buildChart = vi.fn().mockReturnValue(null);
    setupLifecycle([1, 2], buildChart);
    mountCb!();
    vi.advanceTimersByTime(50);

    // Chart is still null, so resize should try to create again
    resizeCallback!([]);
    expect(buildChart).toHaveBeenCalledTimes(2);
  });

  it("effect destroys existing chart and schedules tryCreate when data changes with items", () => {
    const mockChart = { destroy: vi.fn(), setSize: vi.fn(), setCursor: vi.fn() };
    const buildChart = vi.fn().mockReturnValue(mockChart);
    let currentData: unknown[] | undefined = [1, 2];
    useChartLifecycle({
      el: () => mockEl,
      data: () => currentData,
      buildChart,
    });

    // Mount and create the chart
    mountCb!();
    vi.advanceTimersByTime(50);
    expect(buildChart).toHaveBeenCalledTimes(1);

    // Simulate data change via effect
    currentData = [3, 4, 5];
    effectCb!();
    expect(mockChart.destroy).toHaveBeenCalledTimes(1);

    // New chart should be scheduled via setTimeout(0)
    vi.advanceTimersByTime(0);
    expect(buildChart).toHaveBeenCalledTimes(2);
  });

  it("effect does not schedule tryCreate when data becomes empty", () => {
    const mockChart = { destroy: vi.fn(), setSize: vi.fn(), setCursor: vi.fn() };
    const buildChart = vi.fn().mockReturnValue(mockChart);
    let currentData: unknown[] | undefined = [1, 2];
    useChartLifecycle({
      el: () => mockEl,
      data: () => currentData,
      buildChart,
    });

    mountCb!();
    vi.advanceTimersByTime(50);

    currentData = [];
    effectCb!();
    expect(mockChart.destroy).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(100);
    // buildChart should not be called again for empty data
    expect(buildChart).toHaveBeenCalledTimes(1);
  });

  it("effect handles case when chart is already null", () => {
    const buildChart = vi.fn().mockReturnValue(null);
    let currentData: unknown[] | undefined = [1, 2];
    useChartLifecycle({
      el: () => mockEl,
      data: () => currentData,
      buildChart,
    });

    mountCb!();
    vi.advanceTimersByTime(50);
    // buildChart returned null, so chart is null

    currentData = [3, 4];
    effectCb!();
    // Should not throw; just schedules tryCreate
    vi.advanceTimersByTime(0);
    expect(buildChart).toHaveBeenCalledTimes(2);
  });

  it("effect does not schedule tryCreate when data becomes undefined", () => {
    const buildChart = vi.fn().mockReturnValue(null);
    let currentData: unknown[] | undefined = [1];
    useChartLifecycle({
      el: () => mockEl,
      data: () => currentData,
      buildChart,
    });

    mountCb!();
    vi.advanceTimersByTime(50);

    currentData = undefined;
    effectCb!();
    vi.advanceTimersByTime(100);
    expect(buildChart).toHaveBeenCalledTimes(1);
  });

  it("onCleanup disconnects ResizeObserver and destroys chart", () => {
    const mockChart = { destroy: vi.fn(), setSize: vi.fn(), setCursor: vi.fn() };
    const buildChart = vi.fn().mockReturnValue(mockChart);
    setupLifecycle([1, 2], buildChart);
    mountCb!();
    vi.advanceTimersByTime(50);

    cleanupCb!();
    expect(mockDisconnect).toHaveBeenCalledTimes(1);
    expect(mockChart.destroy).toHaveBeenCalledTimes(1);
  });

  it("onCleanup works safely when no chart or observer exists", () => {
    setupLifecycle([], () => null);
    // No mount was called effectively (data empty), so ro is null
    expect(() => cleanupCb!()).not.toThrow();
  });

  it("onCleanup works when chart was never built", () => {
    const buildChart = vi.fn().mockReturnValue(null);
    setupLifecycle([1, 2], buildChart);
    mountCb!();
    vi.advanceTimersByTime(50);
    // chart is null (buildChart returned null)

    cleanupCb!();
    expect(mockDisconnect).toHaveBeenCalledTimes(1);
    // No error thrown
  });

  it("tryCreate calls setCursor after building chart", () => {
    const mockChart = { destroy: vi.fn(), setSize: vi.fn(), setCursor: vi.fn() };
    const buildChart = vi.fn().mockReturnValue(mockChart);
    setupLifecycle([1, 2], buildChart);
    mountCb!();
    vi.advanceTimersByTime(50);
    expect(mockChart.setCursor).toHaveBeenCalledWith({ left: -1, top: -1 });
  });
});

// ---------- createFormatLegendTimestamp ----------

describe("createFormatLegendTimestamp", () => {
  it("returns a formatter function", () => {
    const fmt = createFormatLegendTimestamp("7d");
    expect(typeof fmt).toBe("function");
  });

  it("omits time for 7d range", () => {
    const fmt = createFormatLegendTimestamp("7d");
    const epoch = Date.UTC(2024, 0, 15, 10, 30) / 1000;
    expect(fmt(null as any, epoch)).toBe(localMonDay(epoch));
  });

  it("omits time for 30d range", () => {
    const fmt = createFormatLegendTimestamp("30d");
    const epoch = Date.UTC(2024, 5, 15, 14, 0) / 1000;
    expect(fmt(null as any, epoch)).toBe(localMonDay(epoch));
  });

  it("shows time for 24h range", () => {
    const fmt = createFormatLegendTimestamp("24h");
    const epoch = Date.UTC(2024, 0, 15, 10, 30) / 1000;
    expect(fmt(null as any, epoch)).toBe(localMonDayHHMM(epoch));
  });

  it("shows time for 1h range", () => {
    const fmt = createFormatLegendTimestamp("1h");
    const epoch = Date.UTC(2024, 0, 15, 10, 30) / 1000;
    expect(fmt(null as any, epoch)).toBe(localMonDayHHMM(epoch));
  });

  it("shows time when no range provided", () => {
    const fmt = createFormatLegendTimestamp();
    const epoch = Date.UTC(2024, 0, 15, 10, 30) / 1000;
    expect(fmt(null as any, epoch)).toBe(localMonDayHHMM(epoch));
  });

  it("returns dash for null value", () => {
    const fmt = createFormatLegendTimestamp("7d");
    expect(fmt(null as any, null as any)).toBe("");
  });

  it("returns dash for NaN value", () => {
    const fmt = createFormatLegendTimestamp("24h");
    expect(fmt(null as any, NaN)).toBe("");
  });
});

// ---------- sanitizeNumbers ----------

describe("sanitizeNumbers", () => {
  it("passes through finite numbers", () => {
    expect(sanitizeNumbers([1, 2, 3])).toEqual([1, 2, 3]);
  });

  it("replaces NaN with null", () => {
    expect(sanitizeNumbers([1, NaN, 3])).toEqual([1, null, 3]);
  });

  it("replaces Infinity with null", () => {
    expect(sanitizeNumbers([Infinity, -Infinity])).toEqual([null, null]);
  });

  it("handles empty array", () => {
    expect(sanitizeNumbers([])).toEqual([]);
  });

  it("preserves zero", () => {
    expect(sanitizeNumbers([0])).toEqual([0]);
  });

  it("preserves negative numbers", () => {
    expect(sanitizeNumbers([-5])).toEqual([-5]);
  });
});

// ---------- fillDailyGaps ----------

describe("fillDailyGaps", () => {
  const zeroToken = (date: string) => ({ date, input_tokens: 0, output_tokens: 0 });
  const zeroCost = (date: string) => ({ date, cost: 0 });

  it("returns data unchanged for 1h range", () => {
    const data = [{ date: "2026-03-10", cost: 5 }];
    expect(fillDailyGaps(data, "1h", "date", zeroCost)).toBe(data);
  });

  it("fills 25 hourly slots for 24h range", () => {
    const zeroHour = (hour: string) => ({ hour, cost: 0 });
    const result = fillDailyGaps([], "24h", "hour", zeroHour);
    expect(result).toHaveLength(25);
  });

  it("preserves existing hourly data for 24h range", () => {
    const now = new Date();
    now.setMinutes(0, 0, 0);
    const y = now.getFullYear();
    const mo = String(now.getMonth() + 1).padStart(2, "0");
    const da = String(now.getDate()).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    const key = `${y}-${mo}-${da}T${hh}:00:00`;
    const zeroHour = (hour: string) => ({ hour, cost: 0 });
    const data = [{ hour: key, cost: 42 }];
    const result = fillDailyGaps(data, "24h", "hour", zeroHour);
    expect(result).toHaveLength(25);
    const match = result.find((r) => r.hour === key);
    expect(match?.cost).toBe(42);
  });

  it("generates valid YYYY-MM-DDTHH:00:00 keys for 24h range", () => {
    const zeroHour = (hour: string) => ({ hour, cost: 0 });
    const result = fillDailyGaps([], "24h", "hour", zeroHour);
    for (const row of result) {
      expect(row.hour).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:00:00$/);
    }
  });

  it("hourly results are sorted chronologically for 24h", () => {
    const zeroHour = (hour: string) => ({ hour, cost: 0 });
    const result = fillDailyGaps([], "24h", "hour", zeroHour);
    for (let i = 1; i < result.length; i++) {
      expect(result[i].hour > result[i - 1].hour).toBe(true);
    }
  });

  it("returns data unchanged for unknown range", () => {
    const data = [{ date: "2026-03-10", cost: 5 }];
    expect(fillDailyGaps(data, "unknown", "date", zeroCost)).toBe(data);
  });

  it("fills 31 days for 30d range", () => {
    const result = fillDailyGaps([], "30d", "date", zeroCost);
    expect(result).toHaveLength(31);
  });

  it("fills 8 days for 7d range", () => {
    const result = fillDailyGaps([], "7d", "date", zeroToken);
    expect(result).toHaveLength(8);
  });

  it("preserves existing data and fills gaps with zeros", () => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const y = now.getFullYear();
    const mo = String(now.getMonth() + 1).padStart(2, "0");
    const da = String(now.getDate()).padStart(2, "0");
    const todayStr = `${y}-${mo}-${da}`;
    const data = [{ date: todayStr, cost: 42 }];
    const result = fillDailyGaps(data, "7d", "date", zeroCost);
    expect(result).toHaveLength(8);
    const todayEntry = result.find((r) => r.date === todayStr);
    expect(todayEntry?.cost).toBe(42);
    // All other entries should have zero cost
    const zeros = result.filter((r) => r.date !== todayStr);
    expect(zeros.every((r) => r.cost === 0)).toBe(true);
  });

  it("results are sorted chronologically", () => {
    const result = fillDailyGaps([], "7d", "date", zeroCost);
    for (let i = 1; i < result.length; i++) {
      expect(result[i].date > result[i - 1].date).toBe(true);
    }
  });

  it("ignores data outside the range window", () => {
    const data = [{ date: "2000-01-01", cost: 99 }];
    const result = fillDailyGaps(data, "7d", "date", zeroCost);
    expect(result).toHaveLength(8);
    expect(result.every((r) => r.cost === 0)).toBe(true);
  });

  it("works with custom date field name", () => {
    const data = [{ time: "2000-01-01", value: 10 }];
    const result = fillDailyGaps(data, "7d", "time", (d) => ({ time: d, value: 0 }));
    expect(result).toHaveLength(8);
    expect(result.every((r) => typeof r.time === "string")).toBe(true);
  });

  it("generates valid YYYY-MM-DD date strings", () => {
    const result = fillDailyGaps([], "30d", "date", zeroCost);
    for (const row of result) {
      expect(row.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});
