import type { Component } from 'solid-js';
import uPlot from 'uplot';
import { getHsl, getHslA } from '../services/theme.js';
import {
  makeGradientFillFromVar,
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

interface CostChartProps {
  data: Array<{ date?: string; hour?: string; cost: number }>;
  range?: string;
}

const CostChart: Component<CostChartProps> = (props) => {
  let el!: HTMLDivElement;

  useChartLifecycle({
    el: () => el,
    data: () => props.data,
    buildChart() {
      if (!el) return null;
      const w = el.clientWidth || el.getBoundingClientRect().width;
      if (w === 0) return null;

      const c1 = getHsl('--chart-1');
      const axisColor = getHslA('--foreground', 0.55);
      const gridColor = getHslA('--foreground', 0.05);
      const bgColor = getHsl('--card');

      const axes = createBaseAxes(axisColor, gridColor, props.range);
      axes[1] = {
        ...axes[1]!,
        values: (_u: uPlot, vals: number[]) =>
          vals.map((v) => (isNaN(v) ? '\u2013' : v % 1 === 0 ? `$${v}` : `$${v.toFixed(2)}`)),
      };

      return new uPlot(
        {
          width: w,
          height: 260,
          padding: [16, 16, 0, 0],
          cursor: createCursorSnap(bgColor, c1),
          scales: {
            x: { time: !isMultiDayRange(props.range), range: createTimeScaleRange(props.range) },
            y: { auto: true, range: (_u, _min, max) => [0, max > 0 ? max * 1.15 : 1] },
          },
          axes,
          series: [
            { value: createFormatLegendTimestamp(props.range) },
            {
              label: 'Cost',
              stroke: c1,
              width: 2.5,
              fill: makeGradientFillFromVar('--chart-1', 0.25),
              value: formatLegendCost,
            },
          ],
        },
        (() => {
          const filled = fillDailyGaps(props.data, props.range ?? '', 'date', (date) => ({
            date,
            cost: 0,
          }));
          return [parseTimestamps(filled), sanitizeNumbers(filled.map((d) => d.cost))];
        })(),
        el,
      );
    },
  });

  return <div ref={el} style="width: 100%; min-height: 260px;" />;
};

export default CostChart;
