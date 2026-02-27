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
  parseTimestamps,
  timeScaleRange,
  useChartLifecycle,
  costYRange,
  tokenYRange,
  messageYRange,
} from "../../src/services/chart-utils";

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
    expect(rangeToSeconds("6h")).toBe(21600);
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

// ---------- formatAxisTimestamp ----------

describe("formatAxisTimestamp", () => {
  it("shows HH:MM for range <= 86400 (1h range)", () => {
    const epoch = Date.UTC(2024, 0, 15, 10, 30) / 1000;
    expect(formatAxisTimestamp(epoch, 3600)).toBe("10:30");
  });

  it("shows HH:MM for range exactly 86400", () => {
    const epoch = Date.UTC(2024, 5, 15, 0, 0) / 1000;
    expect(formatAxisTimestamp(epoch, 86400)).toBe("00:00");
  });

  it("shows Mon Day for range > 86400 and <= 7*86400 (weekly)", () => {
    const epoch = Date.UTC(2024, 0, 15, 10, 30) / 1000;
    expect(formatAxisTimestamp(epoch, 604800)).toBe("Jan 15");
  });

  it("shows Mon Day for range just over 86400", () => {
    const epoch = Date.UTC(2024, 5, 15, 14, 30) / 1000;
    expect(formatAxisTimestamp(epoch, 86401)).toBe("Jun 15");
  });

  it("shows Mon Day for range > 7*86400 (monthly)", () => {
    const epoch = Date.UTC(2024, 0, 15, 10, 30) / 1000;
    expect(formatAxisTimestamp(epoch, 2592000)).toBe("Jan 15");
  });

  it("shows Mon Day for 30-day range", () => {
    const epoch = Date.UTC(2024, 11, 25, 8, 0) / 1000;
    expect(formatAxisTimestamp(epoch, 30 * 86400)).toBe("Dec 25");
  });

  it("pads single-digit hours and minutes", () => {
    const epoch = Date.UTC(2024, 0, 1, 5, 3) / 1000;
    expect(formatAxisTimestamp(epoch, 3600)).toBe("05:03");
  });

  it("handles midnight correctly", () => {
    const epoch = Date.UTC(2024, 0, 1, 0, 0) / 1000;
    expect(formatAxisTimestamp(epoch, 3600)).toBe("00:00");
  });

  it("uses all months correctly", () => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    for (let m = 0; m < 12; m++) {
      const epoch = Date.UTC(2024, m, 10) / 1000;
      expect(formatAxisTimestamp(epoch, 604800)).toBe(`${months[m]} 10`);
    }
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
    // hour is checked first via (d.hour ?? d.date)
    const expected = Date.UTC(2024, 0, 15, 10, 0) / 1000;
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
    // new Date("Z") is Invalid Date, getTime() returns NaN, NaN/1000 = NaN
    expect(Number.isNaN(result[0])).toBe(true);
  });
});

// ---------- timeScaleRange ----------

describe("timeScaleRange", () => {
  it("expands small ranges to minimum 6 hours", () => {
    const [min, max] = timeScaleRange(null as any, 100, 200);
    expect(max - min).toBe(6 * 3600);
  });

  it("centers the expanded range around the midpoint", () => {
    const [min, max] = timeScaleRange(null as any, 1000, 2000);
    const mid = (1000 + 2000) / 2;
    expect(min).toBe(mid - 10800);
    expect(max).toBe(mid + 10800);
  });

  it("keeps range when span equals MIN_SPAN exactly", () => {
    const [min, max] = timeScaleRange(null as any, 0, 21600);
    expect(min).toBe(0);
    expect(max).toBe(21600);
  });

  it("keeps range when span is larger than MIN_SPAN", () => {
    const [min, max] = timeScaleRange(null as any, 0, 100000);
    expect(min).toBe(0);
    expect(max).toBe(100000);
  });

  it("handles zero-width range", () => {
    const [min, max] = timeScaleRange(null as any, 5000, 5000);
    expect(max - min).toBe(6 * 3600);
    expect((min + max) / 2).toBe(5000);
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
    expect(axes[0].font).toBe('11px "Inter"');
    expect(axes[0].gap).toBe(8);
  });

  it("y-axis has ticks hidden and correct sizing", () => {
    const axes = createBaseAxes("#aaa", "#eee");
    expect(axes[1].stroke).toBe("#aaa");
    expect(axes[1].ticks?.show).toBe(false);
    expect(axes[1].font).toBe('11px "Inter"');
    expect(axes[1].size).toBe(54);
    expect(axes[1].gap).toBe(8);
  });

  it("x-axis values formatter uses provided range", () => {
    const axes = createBaseAxes("#aaa", "#eee", "24h");
    const mockU = { scales: { x: {} } } as any;
    const epoch = Date.UTC(2024, 0, 15, 10, 30) / 1000;
    const formatted = (axes[0].values as Function)(mockU, [epoch]);
    expect(formatted[0]).toBe("10:30");
  });

  it("x-axis values formatter uses u.scales.x when no range provided", () => {
    const axes = createBaseAxes("#aaa", "#eee");
    const epoch = Date.UTC(2024, 0, 15, 10, 30) / 1000;
    const mockU = { scales: { x: { min: epoch - 3600, max: epoch } } } as any;
    const formatted = (axes[0].values as Function)(mockU, [epoch]);
    expect(formatted[0]).toBe("10:30");
  });

  it("x-axis values formatter falls back to vals array when scales.x has no min/max", () => {
    const axes = createBaseAxes("#aaa", "#eee");
    const epoch1 = Date.UTC(2024, 0, 15, 10, 0) / 1000;
    const epoch2 = Date.UTC(2024, 0, 15, 11, 0) / 1000;
    const mockU = { scales: { x: {} } } as any;
    const formatted = (axes[0].values as Function)(mockU, [epoch1, epoch2]);
    // span = epoch2 - epoch1 = 3600 (short range), so HH:MM format
    expect(formatted[0]).toBe("10:00");
    expect(formatted[1]).toBe("11:00");
  });

  it("x-axis values formatter handles missing scales.x entirely", () => {
    const axes = createBaseAxes("#aaa", "#eee");
    const epoch1 = Date.UTC(2024, 0, 15, 10, 0) / 1000;
    const epoch2 = Date.UTC(2024, 0, 15, 11, 0) / 1000;
    const mockU = { scales: {} } as any;
    const formatted = (axes[0].values as Function)(mockU, [epoch1, epoch2]);
    // scales.x is undefined, so uses nullish coalescing chain to vals
    expect(formatted[0]).toBe("10:00");
    expect(formatted[1]).toBe("11:00");
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
    expect(formatted[0]).toBe("Jan 15");
  });
});

// ---------- costYRange ----------

describe("costYRange", () => {
  it("scales positive max by 1.15", () => {
    expect(costYRange(null, 0, 10)).toEqual([0, 11.5]);
  });

  it("returns [0, 1] when max is zero", () => {
    expect(costYRange(null, 0, 0)).toEqual([0, 1]);
  });

  it("returns [0, 1] when max is negative", () => {
    expect(costYRange(null, 0, -5)).toEqual([0, 1]);
  });

  it("handles very small positive max", () => {
    const [min, max] = costYRange(null, 0, 0.001);
    expect(min).toBe(0);
    expect(max).toBeCloseTo(0.00115);
  });

  it("handles large max values", () => {
    expect(costYRange(null, 0, 1000)).toEqual([0, 1150]);
  });
});

// ---------- tokenYRange ----------

describe("tokenYRange", () => {
  it("scales positive max by 1.1", () => {
    expect(tokenYRange(null, 0, 1000)).toEqual([0, 1100]);
  });

  it("returns [0, 100] when max is zero", () => {
    expect(tokenYRange(null, 0, 0)).toEqual([0, 100]);
  });

  it("returns [0, 100] when max is negative", () => {
    expect(tokenYRange(null, 0, -10)).toEqual([0, 100]);
  });

  it("handles small positive max", () => {
    const [min, max] = tokenYRange(null, 0, 5);
    expect(min).toBe(0);
    expect(max).toBeCloseTo(5.5);
  });
});

// ---------- messageYRange ----------

describe("messageYRange", () => {
  it("scales positive max by 1.1", () => {
    const [min, max] = messageYRange(null, 0, 50);
    expect(min).toBe(0);
    expect(max).toBeCloseTo(55);
  });

  it("returns [0, 10] when max is zero", () => {
    expect(messageYRange(null, 0, 0)).toEqual([0, 10]);
  });

  it("returns [0, 10] when max is negative", () => {
    expect(messageYRange(null, 0, -1)).toEqual([0, 10]);
  });

  it("handles small positive max", () => {
    const [min, max] = messageYRange(null, 0, 3);
    expect(min).toBe(0);
    expect(max).toBeCloseTo(3.3);
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
    const buildChart = vi.fn().mockReturnValue({ destroy: vi.fn() });
    setupLifecycle([1, 2], buildChart);
    mountCb!();
    expect(buildChart).not.toHaveBeenCalled();
    vi.advanceTimersByTime(50);
    expect(buildChart).toHaveBeenCalledTimes(1);
  });

  it("tryCreate does not call buildChart if chart already exists", () => {
    const mockChart = { destroy: vi.fn(), setSize: vi.fn() };
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
    const mockChart = { destroy: vi.fn(), setSize: vi.fn() };
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
    const mockChart = { destroy: vi.fn(), setSize: vi.fn() };
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
    const mockChart = { destroy: vi.fn(), setSize: vi.fn() };
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
    const mockChart = { destroy: vi.fn(), setSize: vi.fn() };
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
});
