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
  formatLegendTokens,
  isMultiDayRange,
  sanitizeNumbers,
  fillDailyGaps,
} from '../services/chart-utils.js';

interface TokenChartProps {
  data: Array<{ hour?: string; date?: string; input_tokens: number; output_tokens: number }>;
  range?: string;
}

const TokenChart: Component<TokenChartProps> = (props) => {
  let el!: HTMLDivElement;

  useChartLifecycle({
    el: () => el,
    data: () => props.data,
    buildChart() {
      if (!el) return null;
      const w = el.clientWidth || el.getBoundingClientRect().width;
      if (w === 0) return null;

      const inputColor = getHsl('--bar-input');
      const outputColor = getHsl('--bar-output');
      const outputAxisColor = getHsl('--bar-output-axis');
      const axisColor = getHslA('--foreground', 0.55);
      const gridColor = getHslA('--foreground', 0.05);
      const bgColor = getHsl('--card');

      const yRange = (_u: uPlot, _min: number, max: number): [number, number] => [
        0,
        max > 0 ? max * 1.1 : 100,
      ];

      return new uPlot(
        {
          width: w,
          height: 260,
          padding: [16, 0, 0, 0],
          cursor: createCursorSnap(bgColor, inputColor),
          scales: {
            x: { time: !isMultiDayRange(props.range), range: createTimeScaleRange(props.range) },
            y: { auto: true, range: yRange },
            y2: { auto: true, range: yRange },
          },
          axes: (() => {
            const a = createBaseAxes(axisColor, gridColor, props.range);
            a[1] = {
              ...a[1]!,
              stroke: inputColor,
              values: (u: uPlot, vals: number[]) => vals.map((v) => formatLegendTokens(u, v)),
            };
            a.push({
              scale: 'y2',
              side: 1,
              stroke: outputAxisColor,
              grid: { show: false },
              ticks: { show: false },
              font: '11px "DM Sans", sans-serif',
              size: 54,
              gap: 8,
              values: (u: uPlot, vals: number[]) => vals.map((v) => formatLegendTokens(u, v)),
            });
            return a;
          })(),
          series: [
            { value: createFormatLegendTimestamp(props.range) },
            {
              label: 'Sent to AI',
              scale: 'y',
              stroke: inputColor,
              width: 2.5,
              fill: makeGradientFillFromVar('--bar-input', 0.25),
              value: formatLegendTokens,
            },
            {
              label: 'Received from AI',
              scale: 'y2',
              stroke: outputColor,
              width: 2,
              fill: makeGradientFillFromVar('--bar-output', 0.15),
              value: formatLegendTokens,
            },
          ],
        },
        (() => {
          const filled = fillDailyGaps(props.data, props.range ?? '', 'date', (date) => ({
            date,
            input_tokens: 0,
            output_tokens: 0,
          }));
          return [
            parseTimestamps(filled),
            sanitizeNumbers(filled.map((d) => d.input_tokens)),
            sanitizeNumbers(filled.map((d) => d.output_tokens)),
          ];
        })(),
        el,
      );
    },
  });

  return <div ref={el} style="width: 100%; min-height: 260px;" />;
};

export default TokenChart;
