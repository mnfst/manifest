import type { Component } from "solid-js";
import uPlot from "uplot";
import { getHsl, getHslA } from "../services/theme.js";
import {
  makeGradientFillFromVar,
  useChartLifecycle,
  createCursorSnap,
  createBaseAxes,
  timeScaleRange,
} from "../services/chart-utils.js";

interface SingleTokenChartProps {
  data: Array<{ time: string; value: number }>;
  label: string;
  colorVar: string;
  range?: string;
}

const SingleTokenChart: Component<SingleTokenChartProps> = (props) => {
  let el!: HTMLDivElement;

  useChartLifecycle({
    el: () => el,
    data: () => props.data,
    buildChart() {
      if (!el) return null;
      const w = el.clientWidth || el.getBoundingClientRect().width;
      if (w === 0) return null;

      const color = getHsl(props.colorVar);
      const axisColor = getHslA("--foreground", 0.55);
      const gridColor = getHslA("--foreground", 0.05);
      const bgColor = getHsl("--card");

      return new uPlot({
        width: w,
        height: 260,
        padding: [16, 16, 0, 0],
        cursor: createCursorSnap(bgColor, color),
        scales: { x: { time: true, range: timeScaleRange }, y: { auto: true, range: (_u, _min, max) => [0, max * 1.1] } },
        axes: createBaseAxes(axisColor, gridColor, props.range),
        series: [
          {},
          { label: props.label, stroke: color, width: 2.5, fill: makeGradientFillFromVar(props.colorVar, 0.25) },
        ],
      }, [
        props.data.map((d) => new Date(d.time.replace(" ", "T") + "Z").getTime() / 1000),
        props.data.map((d) => d.value),
      ], el);
    },
  });

  return <div ref={el} style="width: 100%; min-height: 260px;" />;
};

export default SingleTokenChart;
