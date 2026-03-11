import { onMount, onCleanup, createEffect, on } from 'solid-js';
import type { Accessor } from 'solid-js';
import uPlot from 'uplot';
import { getHslA } from './theme.js';

export function makeGradientFill(topColor: string, bottomColor: string): uPlot.Series.Fill {
  return ((u: uPlot) => {
    if (!isFinite(u.bbox.top) || !isFinite(u.bbox.height) || u.bbox.height === 0) return topColor;
    const grad = u.ctx.createLinearGradient(0, u.bbox.top, 0, u.bbox.top + u.bbox.height);
    grad.addColorStop(0, topColor);
    grad.addColorStop(1, bottomColor);
    return grad;
  }) as uPlot.Series.Fill;
}

export function makeGradientFillFromVar(cssVar: string, alpha: number): uPlot.Series.Fill {
  return makeGradientFill(getHslA(cssVar, alpha), 'transparent');
}

interface UseChartLifecycleOptions<T> {
  el: () => HTMLDivElement;
  data: Accessor<T[] | undefined>;
  buildChart: () => uPlot | null;
}

export function useChartLifecycle<T>(opts: UseChartLifecycleOptions<T>): void {
  let chart: uPlot | null = null;
  let ro: ResizeObserver | null = null;

  const CHART_HEIGHT = 260;

  function tryCreate() {
    if (chart) return;
    const built = opts.buildChart();
    if (built) {
      chart = built;
      chart.setCursor({ left: -1, top: -1 });
    }
  }

  onMount(() => {
    if (!opts.data()?.length) return;

    ro = new ResizeObserver(() => {
      if (!chart) {
        tryCreate();
      } else {
        chart.setSize({ width: opts.el().clientWidth, height: CHART_HEIGHT });
      }
    });
    ro.observe(opts.el());

    setTimeout(tryCreate, 50);
  });

  createEffect(
    on(
      opts.data,
      () => {
        if (chart) {
          chart.destroy();
          chart = null;
        }
        if (opts.data()?.length) setTimeout(tryCreate, 0);
      },
      { defer: true },
    ),
  );

  onCleanup(() => {
    ro?.disconnect();
    chart?.destroy();
    chart = null;
  });
}

export function createCursorSnap(bgColor: string, pointColor: string): uPlot.Cursor {
  return {
    show: true,
    x: true,
    y: false,
    drag: { x: false, y: false },
    points: { show: true, size: 8, fill: pointColor, stroke: bgColor, width: 2 },
    move: (u: uPlot, left: number, top: number) => {
      const idx = u.posToIdx(left);
      const snappedLeft =
        idx != null && u.data[0]?.[idx] != null
          ? Math.round(u.valToPos(u.data[0][idx]!, 'x'))
          : left;
      return [snappedLeft, top];
    },
  };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatLegendTimestamp(_u: uPlot, epochSec: number): string {
  if (epochSec == null || isNaN(epochSec)) return '';
  const d = new Date(epochSec * 1000);
  const mon = MONTHS[d.getMonth()]!;
  const day = d.getDate();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${mon} ${day}, ${hh}:${mm}`;
}

export function createFormatLegendTimestamp(
  range?: string,
): (_u: uPlot, epochSec: number) => string {
  const multiDay = MULTI_DAY_RANGES.has(range ?? '');
  return (_u: uPlot, epochSec: number): string => {
    if (epochSec == null || isNaN(epochSec)) return '';
    const d = new Date(epochSec * 1000);
    const mon = MONTHS[d.getMonth()]!;
    const day = d.getDate();
    if (multiDay) return `${mon} ${day}`;
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${mon} ${day}, ${hh}:${mm}`;
  };
}

export function formatLegendCost(_u: uPlot, val: number): string {
  if (val == null || isNaN(val)) return '';
  if (val > 0 && val < 0.01) return '< $0.01';
  return `$${val.toFixed(2)}`;
}

export function formatLegendTokens(_u: uPlot, val: number): string {
  if (val == null || isNaN(val)) return '';
  val = Math.round(val);
  if (val >= 1_000_000) {
    const v = val / 1_000_000;
    return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}M`;
  }
  if (val >= 1_000) {
    const v = val / 1_000;
    return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}k`;
  }
  return val.toString();
}

const RANGE_MAP: Record<string, number> = {
  '1h': 3600,
  '24h': 86400,
  '7d': 604800,
  '30d': 2592000,
};

const MULTI_DAY_RANGES = new Set(['7d', '30d']);
const INTRADAY_RANGES = new Set(['1h', '24h']);

const RANGE_DAYS: Record<string, number> = { '7d': 7, '30d': 30 };

export function rangeToSeconds(range: string): number {
  return RANGE_MAP[range] ?? 86400;
}

/**
 * Fill missing days in sparse backend data so multi-day charts have
 * one data point per calendar day with even spacing.
 */
export function fillDailyGaps<T extends Record<string, unknown>>(
  data: T[],
  range: string,
  dateField: string,
  zeroEntry: (date: string) => T,
): T[] {
  const days = RANGE_DAYS[range];
  if (!days) return data;

  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);

  const dateMap = new Map<string, T>();
  for (let i = days; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000);
    const key = d.toISOString().slice(0, 10);
    dateMap.set(key, zeroEntry(key));
  }

  for (const row of data) {
    const key = String(row[dateField] ?? '');
    if (dateMap.has(key)) {
      dateMap.set(key, row);
    }
  }

  return Array.from(dateMap.values());
}

export function formatAxisTimestamp(epochSec: number, range: string): string {
  const d = new Date(epochSec * 1000);
  if (INTRADAY_RANGES.has(range)) {
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }
  const mon = MONTHS[d.getMonth()]!;
  const day = d.getDate();
  return `${mon} ${day}`;
}

export function isMultiDayRange(range?: string): boolean {
  return MULTI_DAY_RANGES.has(range ?? '');
}

export function createBaseAxes(axisColor: string, gridColor: string, range?: string): uPlot.Axis[] {
  const multiDay = MULTI_DAY_RANGES.has(range ?? '');
  // Resolve the effective range label for axis formatting: if an explicit range
  // is provided use it; otherwise fall back to a dynamic span-based label so
  // formatAxisTimestamp still receives a valid range string.
  const effectiveRange = range ?? '';
  const xAxis: uPlot.Axis = {
    stroke: axisColor,
    grid: { stroke: gridColor, width: 1 },
    ticks: { stroke: gridColor, width: 1 },
    font: '11px "DM Sans", sans-serif',
    gap: 8,
    // For multi-day ranges, place grid lines exactly at each data point
    ...(multiDay ? { splits: (u: uPlot) => Array.from(u.data[0]) } : {}),
    values: (u: uPlot, vals: number[]) => {
      // When no explicit range was provided, derive one from the visible span
      let labelRange = effectiveRange;
      if (!labelRange) {
        const span =
          (u.scales.x?.max ?? vals[vals.length - 1] ?? 0) - (u.scales.x?.min ?? vals[0] ?? 0);
        labelRange = span > 86400 ? '7d' : '24h';
      }
      const labels = vals.map((v) => formatAxisTimestamp(v, labelRange));
      // Dedup consecutive identical labels
      const deduped = labels.map((l, i) => (i > 0 && l === labels[i - 1] ? '' : l));
      // Thin labels for multi-day ranges so they don't overlap
      if (multiDay) {
        const uniqueLabels = deduped.filter((l) => l !== '');
        const step = uniqueLabels.length > 20 ? 5 : uniqueLabels.length > 14 ? 3 : 1;
        if (step > 1) {
          let count = 0;
          return deduped.map((l) => {
            if (l === '') return '';
            return count++ % step === 0 ? l : '';
          });
        }
      }
      return deduped;
    },
  };

  return [
    xAxis,
    {
      stroke: axisColor,
      grid: { stroke: gridColor, width: 1 },
      ticks: { show: false },
      font: '11px "DM Sans", sans-serif',
      size: 54,
      gap: 8,
    },
  ];
}

export function parseTimestamps(
  data: Array<{ hour?: string; date?: string } & Record<string, unknown>>,
): number[] {
  return data.map((d) => {
    if (d.hour) {
      return new Date(d.hour.replace(' ', 'T') + 'Z').getTime() / 1000;
    }
    const dateStr = (d.date as string) ?? '';
    const [y, m, day] = dateStr.split('-').map(Number);
    return new Date(y!, m! - 1, day!).getTime() / 1000;
  });
}

const MIN_SPAN = 6 * 3600; // 6 hours in seconds

export function timeScaleRange(_u: uPlot, min: number, max: number): [number, number] {
  const now = Date.now() / 1000;
  const clampedMax = Math.min(max, now);
  const span = clampedMax - min;
  if (span < MIN_SPAN) {
    return [clampedMax - MIN_SPAN, clampedMax];
  }
  return [min, clampedMax];
}

export function createTimeScaleRange(
  range?: string,
): (_u: uPlot, min: number, max: number) => [number, number] {
  const multiDay = MULTI_DAY_RANGES.has(range ?? '');
  const intraday = INTRADAY_RANGES.has(range ?? '');
  const rangeSec = range ? rangeToSeconds(range) : 0;
  return (_u: uPlot, min: number, max: number): [number, number] => {
    const now = Date.now() / 1000;
    if (multiDay) {
      // Use exact data extent — no padding — so first/last points
      // sit at chart edges and every day is equally spaced.
      return [min, max];
    }
    if (intraday) {
      return [now - rangeSec, now];
    }
    const clampedMax = Math.min(max, now);
    const span = clampedMax - min;
    if (span < MIN_SPAN) {
      return [clampedMax - MIN_SPAN, clampedMax];
    }
    return [min, clampedMax];
  };
}

export function sanitizeNumbers(values: number[]): (number | null)[] {
  return values.map((v) => (Number.isFinite(v) ? v : null));
}
