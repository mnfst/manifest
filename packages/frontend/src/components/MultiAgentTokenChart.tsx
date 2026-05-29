import type { Component } from 'solid-js';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { getHslA, getHsl } from '../services/theme.js';
import {
  useChartLifecycle,
  createBaseAxes,
  parseTimestamps,
  createTimeScaleRange,
  createFormatLegendTimestamp,
  formatLegendTokens,
  isMultiDayRange,
  fillDailyGaps,
} from '../services/chart-utils.js';

export const AGENT_COLORS = [
  '#1cc4bf',
  '#2430F0',
  '#FE076E',
  '#9531F9',
  '#FDCF3B',
  '#0F1683',
  '#26d9d3',
  '#F97316',
  '#10B981',
  '#EC4899',
  '#8B5CF6',
  '#06B6D4',
  '#F59E0B',
  '#6366F1',
  '#14B8A6',
  '#E11D48',
  '#7C3AED',
  '#0EA5E9',
  '#84CC16',
  '#D946EF',
];

interface MultiAgentTokenChartProps {
  agents: string[];
  timeseries: Array<Record<string, number | string>>;
  range: string;
  colorMap?: Record<string, string>;
  onHoverValues?: (values: Record<string, number> | null) => void;
}

const MultiAgentTokenChart: Component<MultiAgentTokenChartProps> = (props) => {
  let el!: HTMLDivElement;
  // Store raw (non-cumulative) data for hover un-stacking
  let rawData: number[][] = [];

  const bucketKey = () => (props.range === '24h' ? 'hour' : 'date');

  const buildData = (): uPlot.AlignedData => {
    const key = bucketKey();
    const filled = fillDailyGaps(props.timeseries as any[], props.range, key, (k) => {
      const row: Record<string, number | string> = { [key]: k };
      for (const agent of props.agents) row[agent] = 0;
      return row;
    });

    const timestamps = parseTimestamps(filled as any[]);

    // Raw values per agent
    rawData = props.agents.map((agent) =>
      filled.map((d: any) => Math.max(0, Number(d[agent] ?? 0))),
    );

    // Build cumulative (stacked) arrays — agent 0 at bottom, agent N at top
    const cumulative: number[][] = [];
    for (let i = 0; i < props.agents.length; i++) {
      const prev = i > 0 ? cumulative[i - 1] : timestamps.map(() => 0);
      cumulative.push(rawData[i].map((v, j) => v + (prev[j] ?? 0)));
    }

    // Return in reverse order: last cumulative (tallest) = series 1 (drawn first = behind)
    // First cumulative (shortest) = last series (drawn last = in front)
    const reversed = [...cumulative].reverse();
    return [timestamps, ...reversed];
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

      const bars = uPlot.paths.bars!({ size: [1, 20], gap: 2 });

      // Agents reversed: series[1] = tallest cumulative (all agents), drawn behind
      // series[N] = shortest cumulative (agent 0 only), drawn in front
      const reversedAgents = [...props.agents].reverse();

      const series: uPlot.Series[] = [
        { value: createFormatLegendTimestamp(props.range) },
        ...reversedAgents.map((agent) => ({
          label: agent,
          scale: 'y' as const,
          stroke: props.colorMap?.[agent] ?? AGENT_COLORS[0],
          fill: props.colorMap?.[agent] ?? AGENT_COLORS[0],
          width: 0,
          paths: bars,
          points: { show: false },
          value: formatLegendTokens,
        })),
      ];

      return new uPlot(
        {
          width: w,
          height: 260,
          padding: [16, 0, 0, 0],
          legend: { show: false },
          cursor: {
            points: { show: false },
            drag: { x: false, y: false },
          },
          hooks: {
            setCursor: [
              (u) => {
                if (!props.onHoverValues) return;
                const idx = u.cursor.idx;
                if (idx == null || idx < 0) {
                  props.onHoverValues(null);
                  return;
                }
                // Report raw (un-stacked) values
                const vals: Record<string, number> = {};
                for (let i = 0; i < props.agents.length; i++) {
                  vals[props.agents[i]] = rawData[i]?.[idx] ?? 0;
                }
                props.onHoverValues(vals);
              },
            ],
          },
          scales: {
            x: {
              time: !isMultiDayRange(props.range),
              range: createTimeScaleRange(props.range, true),
            },
            y: {
              auto: true,
              range: (_u, _min, max) => [0, max > 0 ? max * 1.1 : 100] as [number, number],
            },
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
