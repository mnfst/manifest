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
    idx: null as unknown as undefined,
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
  if (epochSec == null || isNaN(epochSec)) return '\u2013';
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
  const rangeSec = range ? rangeToSeconds(range) : 0;
  return (_u: uPlot, epochSec: number): string => {
    if (epochSec == null || isNaN(epochSec)) return '\u2013';
    const d = new Date(epochSec * 1000);
    const mon = MONTHS[d.getMonth()]!;
    const day = d.getDate();
    if (rangeSec > 86400) return `${mon} ${day}`;
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${mon} ${day}, ${hh}:${mm}`;
  };
}

export function formatLegendCost(_u: uPlot, val: number): string {
  if (val == null || isNaN(val)) return '\u2013';
  if (val > 0 && val < 0.01) return '< $0.01';
  return `$${val.toFixed(2)}`;
}

export function formatLegendTokens(_u: uPlot, val: number): string {
  if (val == null || isNaN(val)) return '\u2013';
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)}k`;
  return val.toString();
}

const RANGE_MAP: Record<string, number> = {
  '1h': 3600,
  '6h': 21600,
  '24h': 86400,
  '7d': 604800,
  '30d': 2592000,
};

export function rangeToSeconds(range: string): number {
  return RANGE_MAP[range] ?? 86400;
}

export function formatAxisTimestamp(epochSec: number, rangeSeconds: number): string {
  const d = new Date(epochSec * 1000);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  if (rangeSeconds <= 86400) return `${hh}:${mm}`;
  const mon = MONTHS[d.getMonth()]!;
  const day = d.getDate();
  if (rangeSeconds <= 7 * 86400) return `${mon} ${day}`;
  return `${mon} ${day}`;
}

export function createBaseAxes(axisColor: string, gridColor: string, range?: string): uPlot.Axis[] {
  return [
    {
      stroke: axisColor,
      grid: { stroke: gridColor, width: 1 },
      ticks: { stroke: gridColor, width: 1 },
      font: '11px "Inter"',
      gap: 8,
      values: (u: uPlot, vals: number[]) => {
        const span = range
          ? rangeToSeconds(range)
          : (u.scales.x?.max ?? vals[vals.length - 1] ?? 0) - (u.scales.x?.min ?? vals[0] ?? 0);
        return vals.map((v) => formatAxisTimestamp(v, span));
      },
    },
    {
      stroke: axisColor,
      grid: { stroke: gridColor, width: 1 },
      ticks: { show: false },
      font: '11px "Inter"',
      size: 54,
      gap: 8,
    },
  ];
}

export function parseTimestamps(
  data: Array<{ hour?: string; date?: string } & Record<string, unknown>>,
): number[] {
  return data.map(
    (d) =>
      new Date((((d.hour ?? d.date) as string) ?? '').replace(' ', 'T') + 'Z').getTime() / 1000,
  );
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
  const rangeSec = range ? rangeToSeconds(range) : 0;
  return (_u: uPlot, min: number, max: number): [number, number] => {
    const now = Date.now() / 1000;
    if (rangeSec > 0) {
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
