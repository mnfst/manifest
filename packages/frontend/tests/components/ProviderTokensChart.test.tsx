import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@solidjs/testing-library';

let capturedOpts: any = null;
let capturedData: any = null;
let capturedLifecycleOpts: any = null;

vi.mock('uplot', () => {
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

vi.mock('../../src/services/theme.js', () => ({
  getHsl: (name: string) => `hsl(var(${name}))`,
  getHslA: (name: string, alpha: number) => `hsla(var(${name}), ${alpha})`,
}));

vi.mock('../../src/services/chart-utils.js', () => ({
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
      font: '11px "DM Sans", sans-serif',
      gap: 8,
    },
    {
      stroke: axisColor,
      grid: { stroke: gridColor, width: 1 },
      ticks: { show: false },
      font: '11px "DM Sans", sans-serif',
      size: 54,
      gap: 8,
    },
  ],
  parseTimestamps: (data: any[]) => data.map((_: any, i: number) => 1000 + i),
  createTimeScaleRange: (_range?: string) => vi.fn(),
  createFormatLegendTimestamp: (_range?: string) => vi.fn(),
  formatLegendTokens: vi.fn(),
  isMultiDayRange: () => true,
  sanitizeNumbers: (vals: number[]) => vals,
  fillDailyGaps: (data: any[]) => data,
}));

import ProviderTokensChart, {
  buildUnionDates,
  datesToEpochs,
  CHART_COLORS,
} from '../../src/components/ProviderTokensChart';
import type { ProviderTokensSeries } from '../../src/components/ProviderTokensChart';

const sampleSeries: ProviderTokensSeries[] = [
  {
    label: 'claude-sonnet-4-20250514',
    daily: [
      { date: '2026-04-01', tokens: 500 },
      { date: '2026-04-02', tokens: 800 },
    ],
  },
  {
    label: 'claude-haiku-3.5',
    daily: [
      { date: '2026-04-01', tokens: 200 },
      { date: '2026-04-03', tokens: 300 },
    ],
  },
];

function renderAndBuild(series = sampleSeries) {
  capturedOpts = null;
  capturedData = null;
  capturedLifecycleOpts = null;

  render(() => <ProviderTokensChart series={series} />);

  const el = capturedLifecycleOpts.el();
  Object.defineProperty(el, 'clientWidth', { value: 800, configurable: true });

  capturedLifecycleOpts.buildChart();
}

describe('ProviderTokensChart', () => {
  beforeEach(() => {
    capturedOpts = null;
    capturedData = null;
    capturedLifecycleOpts = null;
  });

  describe('rendering', () => {
    it('renders a container div element', () => {
      const { container } = render(() => <ProviderTokensChart series={sampleSeries} />);
      const div = container.querySelector('div');
      expect(div).not.toBeNull();
    });

    it('sets min-height of 260px on the container', () => {
      const { container } = render(() => <ProviderTokensChart series={sampleSeries} />);
      const div = container.querySelector('div');
      expect(div?.style.minHeight).toBe('260px');
    });

    it('sets width to 100%', () => {
      const { container } = render(() => <ProviderTokensChart series={sampleSeries} />);
      const div = container.querySelector('div');
      expect(div?.style.width).toBe('100%');
    });
  });

  describe('buildUnionDates', () => {
    it('merges dates from multiple series', () => {
      const dates = buildUnionDates(sampleSeries);
      expect(dates).toEqual(['2026-04-01', '2026-04-02', '2026-04-03']);
    });

    it('returns empty array for empty series', () => {
      expect(buildUnionDates([])).toEqual([]);
    });

    it('deduplicates dates', () => {
      const dates = buildUnionDates([
        { label: 'a', daily: [{ date: '2026-04-01', tokens: 1 }] },
        { label: 'b', daily: [{ date: '2026-04-01', tokens: 2 }] },
      ]);
      expect(dates).toEqual(['2026-04-01']);
    });
  });

  describe('datesToEpochs', () => {
    it('converts date strings to epoch seconds', () => {
      const epochs = datesToEpochs(['2026-04-01']);
      const expected = new Date(2026, 3, 1).getTime() / 1000;
      expect(epochs[0]).toBe(expected);
    });

    it('handles multiple dates', () => {
      const epochs = datesToEpochs(['2026-04-01', '2026-04-02']);
      expect(epochs).toHaveLength(2);
      expect(epochs[1]! - epochs[0]!).toBe(86400);
    });
  });

  describe('CHART_COLORS', () => {
    it('has 5 color entries', () => {
      expect(CHART_COLORS).toHaveLength(5);
    });

    it('contains CSS variable references', () => {
      for (const c of CHART_COLORS) {
        expect(c).toMatch(/^--chart-\d$/);
      }
    });
  });

  describe('chart configuration', () => {
    it('creates correct number of series (1 timestamp + N data)', () => {
      renderAndBuild();
      expect(capturedOpts.series).toHaveLength(3); // timestamp + 2 models
    });

    it('assigns correct labels to series', () => {
      renderAndBuild();
      expect(capturedOpts.series[1].label).toBe('claude-sonnet-4-20250514');
      expect(capturedOpts.series[2].label).toBe('claude-haiku-3.5');
    });

    it('uses different colors for each series', () => {
      renderAndBuild();
      expect(capturedOpts.series[1].stroke).toBe('hsl(var(--chart-1))');
      expect(capturedOpts.series[2].stroke).toBe('hsl(var(--chart-2))');
    });

    it('sets line width to 2', () => {
      renderAndBuild();
      expect(capturedOpts.series[1].width).toBe(2);
    });

    it('uses gradient fill', () => {
      renderAndBuild();
      expect(capturedOpts.series[1].fill).toBe('gradient(--chart-1, 0.15)');
    });

    it('sets chart height to 260', () => {
      renderAndBuild();
      expect(capturedOpts.height).toBe(260);
    });

    it('sets chart width from container', () => {
      renderAndBuild();
      expect(capturedOpts.width).toBe(800);
    });

    it('sets padding to [16, 16, 0, 0]', () => {
      renderAndBuild();
      expect(capturedOpts.padding).toEqual([16, 16, 0, 0]);
    });

    it('disables time mode on x scale', () => {
      renderAndBuild();
      expect(capturedOpts.scales.x.time).toBe(false);
    });

    it('y scale pads max by 15%', () => {
      renderAndBuild();
      const [min, max] = capturedOpts.scales.y.range(null, 0, 1000);
      expect(min).toBe(0);
      expect(max).toBe(1150);
    });

    it('y scale returns [0, 100] when max is 0', () => {
      renderAndBuild();
      const [min, max] = capturedOpts.scales.y.range(null, 0, 0);
      expect(min).toBe(0);
      expect(max).toBe(100);
    });
  });

  describe('data mapping', () => {
    it('creates union timestamps as first data array', () => {
      renderAndBuild();
      expect(capturedData[0]).toHaveLength(3); // 3 unique dates
    });

    it('maps series tokens to data arrays with gaps filled as 0', () => {
      renderAndBuild();
      // claude-sonnet: has data for 04-01 and 04-02, not 04-03
      expect(capturedData[1]).toEqual([500, 800, 0]);
      // claude-haiku: has data for 04-01 and 04-03, not 04-02
      expect(capturedData[2]).toEqual([200, 0, 300]);
    });
  });

  describe('buildChart guard clauses', () => {
    it('returns null when el has zero width', () => {
      render(() => <ProviderTokensChart series={sampleSeries} />);
      const result = capturedLifecycleOpts.buildChart();
      expect(result).toBeNull();
    });

    it('returns null when series is empty', () => {
      render(() => <ProviderTokensChart series={[]} />);
      const el = capturedLifecycleOpts.el();
      Object.defineProperty(el, 'clientWidth', { value: 800, configurable: true });
      const result = capturedLifecycleOpts.buildChart();
      expect(result).toBeNull();
    });
  });

  describe('color cycling', () => {
    it('wraps around colors when more series than colors', () => {
      const manySeries: ProviderTokensSeries[] = [];
      for (let i = 0; i < 7; i++) {
        manySeries.push({
          label: `model-${i}`,
          daily: [{ date: '2026-04-01', tokens: 100 }],
        });
      }
      renderAndBuild(manySeries);
      // 6th series (index 5) should wrap to --chart-1
      expect(capturedOpts.series[6].stroke).toBe('hsl(var(--chart-1))');
      // 7th series (index 6) should wrap to --chart-2
      expect(capturedOpts.series[7].stroke).toBe('hsl(var(--chart-2))');
    });
  });
});
