import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@solidjs/testing-library";

let capturedOpts: any = null;
let capturedData: any = null;
let capturedLifecycleOpts: any = null;

vi.mock("uplot", () => {
  return {
    default: class MockUPlot {
      constructor(opts: any, data: any, _el: any) {
        capturedOpts = opts;
        capturedData = data;
      }
      destroy = vi.fn();
    },
  };
});

vi.mock("../../src/services/theme.js", () => ({
  getHsl: (name: string) => `hsl(var(${name}))`,
  getHslA: (name: string, alpha: number) => `hsla(var(${name}), ${alpha})`,
}));

vi.mock("../../src/services/chart-utils.js", () => ({
  makeGradientFillFromVar: (cssVar: string, alpha: number) =>
    `gradient(${cssVar}, ${alpha})`,
  useChartLifecycle: (opts: any) => {
    capturedLifecycleOpts = opts;
  },
  createCursorSnap: (bg: string, point: string) => ({
    show: true,
    bg,
    point,
  }),
  createBaseAxes: (axisColor: string, gridColor: string, _range?: string) => [
    {
      stroke: axisColor,
      grid: { stroke: gridColor, width: 1 },
      ticks: { stroke: gridColor, width: 1 },
      font: '11px "Inter"',
      gap: 8,
    },
    {
      stroke: axisColor,
      grid: { stroke: gridColor, width: 1 },
      ticks: { show: false },
      font: '11px "Inter"',
      size: 54,
      gap: 8,
    },
  ],
  parseTimestamps: (data: any[]) => data.map((_: any, i: number) => 1000 + i),
  timeScaleRange: vi.fn(),
  createTimeScaleRange: (_range?: string) => vi.fn(),
  createFormatLegendTimestamp: (_range?: string) => vi.fn(),
  formatLegendTokens: vi.fn(),
  sanitizeNumbers: (vals: number[]) => vals,
}));

import TokenChart from "../../src/components/TokenChart";

const sampleData = [
  { hour: "2026-02-18 10:00:00", input_tokens: 1000, output_tokens: 500 },
  { hour: "2026-02-18 11:00:00", input_tokens: 2000, output_tokens: 800 },
  { hour: "2026-02-18 12:00:00", input_tokens: 1500, output_tokens: 1200 },
];

function renderAndBuild(data = sampleData, range?: string) {
  capturedOpts = null;
  capturedData = null;
  capturedLifecycleOpts = null;

  render(() => <TokenChart data={data} range={range} />);

  // The mock useChartLifecycle captured the options including buildChart.
  // The component's `el` ref is set after render, but clientWidth is 0 in jsdom.
  // Stub clientWidth on the element so buildChart proceeds past the width guard.
  const el = capturedLifecycleOpts.el();
  Object.defineProperty(el, "clientWidth", { value: 800, configurable: true });

  capturedLifecycleOpts.buildChart();
}

describe("TokenChart", () => {
  beforeEach(() => {
    capturedOpts = null;
    capturedData = null;
    capturedLifecycleOpts = null;
  });

  describe("rendering", () => {
    it("should render a container div element", () => {
      const { container } = render(() => <TokenChart data={sampleData} />);
      const div = container.querySelector("div");
      expect(div).not.toBeNull();
    });

    it("should set min-height of 260px on the container", () => {
      const { container } = render(() => <TokenChart data={sampleData} />);
      const div = container.querySelector("div");
      expect(div?.style.minHeight).toBe("260px");
    });

    it("should set width to 100% on the container", () => {
      const { container } = render(() => <TokenChart data={sampleData} />);
      const div = container.querySelector("div");
      expect(div?.style.width).toBe("100%");
    });
  });

  describe("scales configuration", () => {
    it("should define an x scale with time enabled", () => {
      renderAndBuild();
      expect(capturedOpts).not.toBeNull();
      expect(capturedOpts.scales.x).toBeDefined();
      expect(capturedOpts.scales.x.time).toBe(true);
    });

    it("should define a y scale for input tokens (left axis)", () => {
      renderAndBuild();
      expect(capturedOpts.scales.y).toBeDefined();
      expect(capturedOpts.scales.y.auto).toBe(true);
    });

    it("should define a y2 scale for output tokens (right axis)", () => {
      renderAndBuild();
      expect(capturedOpts.scales.y2).toBeDefined();
      expect(capturedOpts.scales.y2.auto).toBe(true);
    });

    it("should have three scales total (x, y, y2)", () => {
      renderAndBuild();
      const scaleKeys = Object.keys(capturedOpts.scales);
      expect(scaleKeys).toContain("x");
      expect(scaleKeys).toContain("y");
      expect(scaleKeys).toContain("y2");
      expect(scaleKeys).toHaveLength(3);
    });

    it("should use a yRange function that pads max by 10%", () => {
      renderAndBuild();
      const yRange = capturedOpts.scales.y.range;
      const [min, max] = yRange(null, 0, 1000);
      expect(min).toBe(0);
      expect(max).toBe(1100);
    });

    it("should return [0, 100] when max is 0", () => {
      renderAndBuild();
      const yRange = capturedOpts.scales.y.range;
      const [min, max] = yRange(null, 0, 0);
      expect(min).toBe(0);
      expect(max).toBe(100);
    });

    it("should use the same yRange logic for y and y2 scales", () => {
      renderAndBuild();
      const yRange = capturedOpts.scales.y.range;
      const y2Range = capturedOpts.scales.y2.range;
      expect(yRange(null, 0, 500)).toEqual(y2Range(null, 0, 500));
    });
  });

  describe("axes configuration", () => {
    it("should define three axes (x, left y, right y2)", () => {
      renderAndBuild();
      expect(capturedOpts.axes).toHaveLength(3);
    });

    it("should color the left y-axis with inputColor (--bar-input)", () => {
      renderAndBuild();
      const leftYAxis = capturedOpts.axes[1];
      expect(leftYAxis.stroke).toBe("hsl(var(--bar-input))");
    });

    it("should color the right y2-axis with outputColor (--bar-output)", () => {
      renderAndBuild();
      const rightYAxis = capturedOpts.axes[2];
      expect(rightYAxis.stroke).toBe("hsl(var(--bar-output))");
    });

    it("should assign right y2-axis to scale y2", () => {
      renderAndBuild();
      const rightYAxis = capturedOpts.axes[2];
      expect(rightYAxis.scale).toBe("y2");
    });

    it("should place right y2-axis on side 1 (right side)", () => {
      renderAndBuild();
      const rightYAxis = capturedOpts.axes[2];
      expect(rightYAxis.side).toBe(1);
    });

    it("should disable grid lines on the right y2-axis", () => {
      renderAndBuild();
      const rightYAxis = capturedOpts.axes[2];
      expect(rightYAxis.grid).toEqual({ show: false });
    });

    it("should disable ticks on the right y2-axis", () => {
      renderAndBuild();
      const rightYAxis = capturedOpts.axes[2];
      expect(rightYAxis.ticks).toEqual({ show: false });
    });

    it("should set font on the right y2-axis", () => {
      renderAndBuild();
      const rightYAxis = capturedOpts.axes[2];
      expect(rightYAxis.font).toBe('11px "Inter"');
    });

    it("should set size and gap on the right y2-axis", () => {
      renderAndBuild();
      const rightYAxis = capturedOpts.axes[2];
      expect(rightYAxis.size).toBe(54);
      expect(rightYAxis.gap).toBe(8);
    });

    it("should have a values formatter on the left y-axis", () => {
      renderAndBuild();
      const leftYAxis = capturedOpts.axes[1];
      expect(typeof leftYAxis.values).toBe("function");
    });

    it("should have a values formatter on the right y2-axis", () => {
      renderAndBuild();
      const rightYAxis = capturedOpts.axes[2];
      expect(typeof rightYAxis.values).toBe("function");
    });
  });

  describe("series configuration", () => {
    it("should define three series (timestamp, input, output)", () => {
      renderAndBuild();
      expect(capturedOpts.series).toHaveLength(3);
    });

    it("should assign the input series label as 'Sent to AI'", () => {
      renderAndBuild();
      expect(capturedOpts.series[1].label).toBe("Sent to AI");
    });

    it("should assign the output series label as 'Received from AI'", () => {
      renderAndBuild();
      expect(capturedOpts.series[2].label).toBe("Received from AI");
    });

    it("should assign input series to scale y (left axis)", () => {
      renderAndBuild();
      expect(capturedOpts.series[1].scale).toBe("y");
    });

    it("should assign output series to scale y2 (right axis)", () => {
      renderAndBuild();
      expect(capturedOpts.series[2].scale).toBe("y2");
    });

    it("should color input series stroke with inputColor", () => {
      renderAndBuild();
      expect(capturedOpts.series[1].stroke).toBe("hsl(var(--bar-input))");
    });

    it("should color output series stroke with outputColor", () => {
      renderAndBuild();
      expect(capturedOpts.series[2].stroke).toBe("hsl(var(--bar-output))");
    });

    it("should set input series line width to 2.5", () => {
      renderAndBuild();
      expect(capturedOpts.series[1].width).toBe(2.5);
    });

    it("should set output series line width to 2", () => {
      renderAndBuild();
      expect(capturedOpts.series[2].width).toBe(2);
    });

    it("should use gradient fill for input series from --bar-input", () => {
      renderAndBuild();
      expect(capturedOpts.series[1].fill).toBe("gradient(--bar-input, 0.25)");
    });

    it("should use gradient fill for output series from --bar-output", () => {
      renderAndBuild();
      expect(capturedOpts.series[2].fill).toBe("gradient(--bar-output, 0.15)");
    });
  });

  describe("layout configuration", () => {
    it("should set chart height to 260", () => {
      renderAndBuild();
      expect(capturedOpts.height).toBe(260);
    });

    it("should set right padding to 0 for the dual-axis layout", () => {
      renderAndBuild();
      expect(capturedOpts.padding[1]).toBe(0);
    });

    it("should set top padding to 16", () => {
      renderAndBuild();
      expect(capturedOpts.padding[0]).toBe(16);
    });

    it("should set the full padding array to [16, 0, 0, 0]", () => {
      renderAndBuild();
      expect(capturedOpts.padding).toEqual([16, 0, 0, 0]);
    });

    it("should set chart width from the container element", () => {
      renderAndBuild();
      expect(capturedOpts.width).toBe(800);
    });
  });

  describe("data mapping", () => {
    it("should pass input_tokens as the second data series", () => {
      renderAndBuild();
      expect(capturedData[1]).toEqual([1000, 2000, 1500]);
    });

    it("should pass output_tokens as the third data series", () => {
      renderAndBuild();
      expect(capturedData[2]).toEqual([500, 800, 1200]);
    });

    it("should pass timestamps as the first data series", () => {
      renderAndBuild();
      expect(capturedData[0]).toEqual([1000, 1001, 1002]);
    });

    it("should pass three data arrays total", () => {
      renderAndBuild();
      expect(capturedData).toHaveLength(3);
    });
  });

  describe("buildChart guard clauses", () => {
    it("should return null when el has zero width", () => {
      render(() => <TokenChart data={sampleData} />);
      // el.clientWidth defaults to 0 in jsdom, do not stub it
      const result = capturedLifecycleOpts.buildChart();
      expect(result).toBeNull();
    });
  });
});
