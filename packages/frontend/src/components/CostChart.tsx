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
  costYRange,
} from "../services/chart-utils.js";

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

      const c1 = getHsl("--chart-1");
      const axisColor = getHslA("--foreground", 0.55);
      const gridColor = getHslA("--foreground", 0.05);
      const bgColor = getHsl("--card");

      const axes = createBaseAxes(axisColor, gridColor, props.range);
      axes[1] = {
        ...axes[1]!,
        values: (_u: uPlot, vals: number[]) => vals.map((v) => `$${v.toFixed(2)}`),
      };

      return new uPlot({
        width: w,
        height: 260,
        padding: [16, 16, 0, 0],
        cursor: createCursorSnap(bgColor, c1),
        scales: { x: { time: true, range: timeScaleRange }, y: { auto: true, range: costYRange } },
        axes,
        series: [
          {},
          { label: "Cost", stroke: c1, width: 2.5, fill: makeGradientFillFromVar("--chart-1", 0.25) },
        ],
      }, [
        parseTimestamps(props.data),
        props.data.map((d) => d.cost),
      ], el);
    },
  });

  return <div ref={el} style="width: 100%; min-height: 260px;" />;
};

export default CostChart;
