import type { Component } from 'solid-js';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { getHsl, getHslA } from '../services/theme.js';
import {
  useChartLifecycle,
  createCursorSnap,
  createBaseAxes,
  parseTimestamps,
  createTimeScaleRange,
  createFormatLegendTimestamp,
  formatLegendCost,
  isMultiDayRange,
  sanitizeNumbers,
  fillDailyGaps,
} from '../services/chart-utils.js';

interface SavingsChartProps {
  data: Array<{ date?: string; hour?: string; actual_cost: number; baseline_cost: number }>;
  range?: string;
}

const SavingsChart: Component<SavingsChartProps> = (props) => {
  let el!: HTMLDivElement;

  useChartLifecycle({
    el: () => el,
    data: () => props.data,
    buildChart() {
      if (!el) return null;
      const w = el.clientWidth || el.getBoundingClientRect().width;
      if (w === 0) return null;

      const actualColor = getHsl('--chart-3');
      const baselineColor = getHslA('--foreground', 0.7);
      const axisColor = getHslA('--foreground', 0.55);
      const gridColor = getHslA('--foreground', 0.05);
      const bgColor = getHsl('--card');

      const axes = createBaseAxes(axisColor, gridColor, props.range);
      axes[1] = {
        ...axes[1]!,
        values: (_u: uPlot, vals: number[]) =>
          vals.map((v) => (isNaN(v) ? '\u2013' : v % 1 === 0 ? `$${v}` : `$${v.toFixed(2)}`)),
      };

      const barLeft = uPlot.paths.bars!({ size: [0.35, 64], align: -1, gap: 2 });
      const barRight = uPlot.paths.bars!({ size: [0.35, 64], align: 1, gap: 2 });

      return new uPlot(
        {
          width: w,
          height: 260,
          padding: [16, 40, 0, 0],
          cursor: createCursorSnap(bgColor, actualColor),
          scales: {
            x: { time: !isMultiDayRange(props.range), range: createTimeScaleRange(props.range) },
            y: { auto: true, range: (_u, _min, max) => [0, max > 0 ? max * 1.15 : 1] },
          },
          axes,
          series: [
            { value: createFormatLegendTimestamp(props.range) },
            {
              label: 'Actual cost',
              stroke: actualColor,
              fill: actualColor,
              width: 0,
              paths: barLeft,
              value: formatLegendCost,
              points: { show: false },
            },
            {
              label: 'Baseline cost',
              stroke: baselineColor,
              fill: baselineColor,
              width: 0,
              paths: barRight,
              value: formatLegendCost,
              points: { show: false },
            },
          ],
        },
        (() => {
          const isHourly = props.range === '24h';
          const filled = fillDailyGaps(
            props.data,
            props.range ?? '',
            isHourly ? 'hour' : 'date',
            (key) =>
              isHourly
                ? { hour: key, actual_cost: 0, baseline_cost: 0 }
                : { date: key, actual_cost: 0, baseline_cost: 0 },
          );
          return [
            parseTimestamps(filled),
            sanitizeNumbers(filled.map((d) => d.actual_cost)),
            sanitizeNumbers(filled.map((d) => d.baseline_cost)),
          ];
        })(),
        el,
      );
    },
  });

  return <div ref={el} style="width: 100%; min-height: 260px;" />;
};

export default SavingsChart;
