import type { Component } from "solid-js";
import uPlot from "uplot";
import { getHsl, getHslA } from "../services/theme.js";
import {
  makeGradientFillFromVar,
  useChartLifecycle,
  createCursorSnap,
  createBaseAxes,
  parseTimestamps,
  timeScaleRange,
} from "../services/chart-utils.js";

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

      const inputColor = getHsl("--bar-input");
      const outputColor = getHsl("--bar-output");
      const axisColor = getHslA("--foreground", 0.55);
      const gridColor = getHslA("--foreground", 0.05);
      const bgColor = getHsl("--card");

      return new uPlot({
        width: w,
        height: 260,
        padding: [16, 16, 0, 0],
        cursor: createCursorSnap(bgColor, inputColor),
        scales: { x: { time: true, range: timeScaleRange }, y: { auto: true, range: (_u, _min, max) => [0, max > 0 ? max * 1.1 : 100] } },
        axes: createBaseAxes(axisColor, gridColor, props.range),
        series: [
          {},
          { label: "Sent to AI", stroke: inputColor, width: 2.5, fill: makeGradientFillFromVar("--bar-input", 0.25) },
          { label: "Received from AI", stroke: outputColor, width: 2, fill: makeGradientFillFromVar("--bar-output", 0.15) },
        ],
      }, [
        parseTimestamps(props.data),
        props.data.map((d) => d.input_tokens),
        props.data.map((d) => d.output_tokens),
      ], el);
    },
  });

  return <div ref={el} style="width: 100%; min-height: 260px;" />;
};

export default TokenChart;
