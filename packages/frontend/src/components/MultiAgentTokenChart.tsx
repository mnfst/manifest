import type { Component } from 'solid-js';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { getHslA, getHsl } from '../services/theme.js';
import {
  useChartLifecycle,
  createCursorSnap,
  createBaseAxes,
  parseTimestamps,
  createTimeScaleRange,
  createFormatLegendTimestamp,
  formatLegendTokens,
  isMultiDayRange,
  sanitizeNumbers,
  fillDailyGaps,
} from '../services/chart-utils.js';

const AGENT_COLORS = [
  '#1cc4bf', // teal
  '#2430F0', // blue
  '#FE076E', // pink
  '#9531F9', // purple
  '#FDCF3B', // yellow
  '#0F1683', // dark blue
  '#26d9d3', // light teal
  '#F97316', // orange
  '#10B981', // emerald
  '#EC4899', // rose
  '#8B5CF6', // violet
  '#06B6D4', // cyan
  '#F59E0B', // amber
  '#6366F1', // indigo
  '#14B8A6', // teal variant
  '#E11D48', // red
  '#7C3AED', // purple variant
  '#0EA5E9', // sky
  '#84CC16', // lime
  '#D946EF', // fuchsia
];

interface MultiAgentTokenChartProps {
  agents: string[];
  timeseries: Array<Record<string, number | string>>;
  range: string;
}

const MultiAgentTokenChart: Component<MultiAgentTokenChartProps> = (props) => {
  let el!: HTMLDivElement;

  const bucketKey = () => (props.range === '24h' ? 'hour' : 'date');

  const buildData = (): uPlot.AlignedData => {
    const key = bucketKey();
    const filled = fillDailyGaps(props.timeseries as any[], props.range, key, (k) => {
      const row: Record<string, number | string> = { [key]: k };
      for (const agent of props.agents) row[agent] = 0;
      return row;
    });

    const timestamps = parseTimestamps(filled as any[]);
    const series: number[][] = props.agents.map((agent) =>
      sanitizeNumbers(filled.map((d: any) => Number(d[agent] ?? 0))),
    );

    return [timestamps, ...series];
  };

  useChartLifecycle({
    el: () => el,
    data: () => props.timeseries,
    buildData,
    structureKey: () => `${props.range}::${props.agents.join(',')}`,
    buildChart() {
      if (!el) return null;
      const w = el.clientWidth || el.getBoundingClientRect().width;
      if (w === 0) return null;

      const axisColor = getHslA('--foreground', 0.55);
      const gridColor = getHslA('--foreground', 0.05);
      const bgColor = getHsl('--card');

      const yRange = (_u: uPlot, _min: number, max: number): [number, number] => [
        0,
        max > 0 ? max * 1.1 : 100,
      ];

      const series: uPlot.Series[] = [
        { value: createFormatLegendTimestamp(props.range) },
        ...props.agents.map((agent, i) => ({
          label: agent,
          scale: 'y' as const,
          stroke: AGENT_COLORS[i % AGENT_COLORS.length],
          width: 2,
          value: formatLegendTokens,
        })),
      ];

      return new uPlot(
        {
          width: w,
          height: 260,
          padding: [16, 0, 0, 0],
          cursor: createCursorSnap(bgColor, AGENT_COLORS[0]),
          scales: {
            x: { time: !isMultiDayRange(props.range), range: createTimeScaleRange(props.range) },
            y: { auto: true, range: yRange },
          },
          axes: (() => {
            const a = createBaseAxes(axisColor, gridColor, props.range);
            a[1] = {
              ...a[1]!,
              values: (u: uPlot, vals: number[]) => vals.map((v) => formatLegendTokens(u, v)),
            };
            return a;
          })(),
          series,
        },
        buildData(),
        el,
      );
    },
  });

  return <div ref={el} style="width: 100%; min-height: 260px;" />;
};

export default MultiAgentTokenChart;
