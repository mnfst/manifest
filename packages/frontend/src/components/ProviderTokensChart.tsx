import type { Component } from 'solid-js';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { getHsl, getHslA } from '../services/theme.js';
import {
  makeGradientFillFromVar,
  useChartLifecycle,
  createCursorSnap,
  createBaseAxes,
  createFormatLegendTimestamp,
  formatLegendTokens,
  sanitizeNumbers,
} from '../services/chart-utils.js';
import type { DailyTokenEntry } from '../services/api/public-stats.js';

export interface ProviderTokensSeries {
  label: string;
  daily: DailyTokenEntry[];
}

interface ProviderTokensChartProps {
  series: ProviderTokensSeries[];
}

const CHART_COLORS = ['--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5'];

function buildUnionDates(): string[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dates: string[] = [];
  for (let i = 30; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    dates.push(`${y}-${mo}-${da}`);
  }
  return dates;
}

function datesToEpochs(dates: string[]): number[] {
  return dates.map((dateStr) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return Date.UTC(y!, m! - 1, d!) / 1000;
  });
}

const ProviderTokensChart: Component<ProviderTokensChartProps> = (props) => {
  let el!: HTMLDivElement;

  useChartLifecycle({
    el: () => el,
    data: () => props.series,
    buildChart() {
      if (!el) return null;
      const w = el.clientWidth || el.getBoundingClientRect().width;
      if (w === 0) return null;
      if (!props.series.length) return null;

      const axisColor = getHslA('--foreground', 0.55);
      const gridColor = getHslA('--foreground', 0.05);
      const bgColor = getHsl('--card');

      const dates = buildUnionDates();
      const timestamps = datesToEpochs(dates);

      const axes = createBaseAxes(axisColor, gridColor, '30d');
      axes[1] = {
        ...axes[1]!,
        values: (_u: uPlot, vals: number[]) => vals.map((v) => formatLegendTokens(_u, v)),
      };

      const series: uPlot.Series[] = [{ value: createFormatLegendTimestamp('30d') }];
      const dataArrays: (number | null)[][] = [timestamps as (number | null)[]];

      for (let i = 0; i < props.series.length; i++) {
        const s = props.series[i]!;
        const colorVar = CHART_COLORS[i % CHART_COLORS.length]!;
        const color = getHsl(colorVar);

        series.push({
          label: s.label,
          stroke: color,
          width: 2,
          fill: makeGradientFillFromVar(colorVar, 0.15),
          value: formatLegendTokens,
        });

        const dailyMap = new Map<string, number>();
        for (const d of s.daily) {
          dailyMap.set(d.date, d.tokens);
        }
        dataArrays.push(sanitizeNumbers(dates.map((date) => dailyMap.get(date) ?? 0)));
      }

      return new uPlot(
        {
          width: w,
          height: 260,
          padding: [16, 16, 0, 0],
          cursor: createCursorSnap(bgColor, getHsl(CHART_COLORS[0]!)),
          scales: {
            x: { time: false, range: (_u, min, max) => [min, max] },
            y: { auto: true, range: (_u, _min, max) => [0, max > 0 ? max * 1.15 : 100] },
          },
          axes,
          series,
        },
        dataArrays as uPlot.AlignedData,
        el,
      );
    },
  });

  return <div ref={el} style="width: 100%; min-height: 260px;" />;
};

export default ProviderTokensChart;
export { buildUnionDates, datesToEpochs, CHART_COLORS };
