import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';

let capturedLifecycleOpts: any = null;
let capturedChartOpts: any = null;
let capturedChartData: any = null;

vi.mock('uplot', () => ({
  default: class MockUPlot {
    static paths = {
      bars: () => vi.fn(),
    };

    bbox = { width: 800 };
    cursor = { idx: 0 };
    data: number[][] = [];

    constructor(opts: any, data: any) {
      capturedChartOpts = opts;
      capturedChartData = data;
      this.data = data;
    }

    posToIdx = () => 0;
    valToPos = () => 120;
    destroy = vi.fn();
  },
}));

vi.mock('../../src/services/theme.js', () => ({
  getHsl: (name: string) => `hsl(var(${name}))`,
  getHslA: (name: string, alpha: number) => `hsla(var(${name}), ${alpha})`,
}));

vi.mock('../../src/services/chart-utils.js', () => ({
  useChartLifecycle: (opts: any) => {
    capturedLifecycleOpts = opts;
  },
  createBaseAxes: (axisColor: string, gridColor: string) => [
    { stroke: axisColor, grid: { stroke: gridColor } },
    { stroke: axisColor, grid: { stroke: gridColor } },
  ],
  parseTimestamps: (rows: unknown[]) => rows.map((_, i) => 1_700_000_000 + i * 3600),
  createTimeScaleRange: () => vi.fn(),
  createFormatLegendTimestamp: () => vi.fn(),
  formatLegendTokens: (_u: unknown, value: number) => String(value),
  isMultiDayRange: (range: string) => range !== '24h',
  fillDailyGaps: (
    rows: unknown[],
    _range: string,
    key: string,
    buildMissing: (bucket: string) => unknown,
  ) => (rows.length ? rows : [buildMissing(key === 'date' ? '2026-06-04' : '2026-06-04 00:00:00')]),
}));

vi.mock('../../src/components/InfoTooltip.jsx', () => ({
  default: (props: { text: string }) => <span data-testid="info-tooltip">{props.text}</span>,
}));

import GlobalOverviewSkeleton from '../../src/components/GlobalOverviewSkeleton';
import MultiAgentTokenChart, { AGENT_COLORS } from '../../src/components/MultiAgentTokenChart';
import ProviderChartCard from '../../src/components/ProviderChartCard';

beforeEach(() => {
  vi.clearAllMocks();
  capturedLifecycleOpts = null;
  capturedChartOpts = null;
  capturedChartData = null;
});

const buildCapturedChart = () => {
  const el = capturedLifecycleOpts.el();
  Object.defineProperty(el, 'clientWidth', { value: 800, configurable: true });
  capturedLifecycleOpts.buildChart();
};

// ProviderChartCard lazy-loads MultiAgentTokenChart (uPlot stays out of the
// initial bundle), so its lifecycle hook is registered asynchronously. Wait for
// the lazy chart to mount before driving buildChart().
const buildLazyChart = async () => {
  await waitFor(() => expect(capturedLifecycleOpts).not.toBeNull());
  buildCapturedChart();
};

describe('analytics chart surface components', () => {
  it('renders the global overview skeleton placeholders', () => {
    const { container } = render(() => <GlobalOverviewSkeleton />);
    expect(container.querySelectorAll('.overview-stat-card')).toHaveLength(4);
    expect(container.querySelectorAll('.skeleton').length).toBeGreaterThan(10);
  });

  it('renders ProviderChartCard views and changes active view on click', async () => {
    const onViewChange = vi.fn();

    render(() => (
      <ProviderChartCard
        activeView="requests"
        onViewChange={onViewChange}
        requestsValue={100}
        requestsTrendPct={5}
        messagesValue={42}
        messagesTrendPct={3}
        tokensValue={1234}
        tokensTrendPct={5}
        costValue={4.56}
        costTrendPct={-2}
        costInfoTooltip="API key cost only"
        range="24h"
        agentRequestTimeseries={{
          agents: ['openai'],
          timeseries: [{ hour: '2026-06-04 10:00:00', openai: 100 }],
        }}
        agentMessageTimeseries={{
          agents: ['openai'],
          timeseries: [{ hour: '2026-06-04 10:00:00', openai: 42 }],
        }}
        agentTimeseries={{
          agents: ['openai'],
          timeseries: [{ hour: '2026-06-04 10:00:00', openai: 1200 }],
        }}
        agentCostTimeseries={{
          agents: ['openai'],
          timeseries: [{ hour: '2026-06-04 10:00:00', openai: 4.56 }],
        }}
        colorMap={{ openai: '#111111' }}
      />
    ));

    // Both the 'requests' and 'messages' view buttons are labeled "Requests".
    // Verify all four stat headers are present.
    expect(screen.getAllByText('Requests').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Cost')).toBeDefined();
    expect(screen.getByText('Token usage')).toBeDefined();
    expect(screen.getByTestId('info-tooltip')).toBeDefined();
    await buildLazyChart();

    // Tab controls are semantic <button>s (keyboard/a11y).
    // Stat order: Requests(requests view)=0, Cost=1, Requests(messages view)=2, Token usage=3.
    const allStats = document.querySelectorAll('.chart-card__stat--clickable');
    expect(allStats.length).toBe(4);
    // The 'messages'-view button is at index 2.
    fireEvent.click(allStats[2]);
    expect(onViewChange).toHaveBeenCalledWith('messages');
    fireEvent.click(screen.getByText('Token usage'));
    expect(onViewChange).toHaveBeenCalledWith('tokens');
    fireEvent.click(screen.getByText('Cost'));
    expect(onViewChange).toHaveBeenCalledWith('cost');
  });

  it('renders ProviderChartCard token and cost chart branches', async () => {
    const onViewChange = vi.fn();

    const { unmount } = render(() => (
      <ProviderChartCard
        activeView="tokens"
        onViewChange={onViewChange}
        requestsValue={100}
        requestsTrendPct={0}
        messagesValue={0}
        messagesTrendPct={0}
        tokensValue={1234}
        tokensTrendPct={0}
        costValue={4.56}
        costTrendPct={0}
        range="24h"
        agentTimeseries={{ agents: ['openai'], timeseries: [] }}
        agentCostTimeseries={{
          agents: ['openai'],
          timeseries: [{ hour: '2026-06-04 10:00:00', openai: 4.56 }],
        }}
        colorMap={{ openai: '#111111' }}
      />
    ));

    expect(screen.getAllByText('Requests').length).toBeGreaterThanOrEqual(1);
    await buildLazyChart();
    unmount();
    capturedLifecycleOpts = null;

    render(() => (
      <ProviderChartCard
        activeView="cost"
        onViewChange={onViewChange}
        requestsValue={100}
        requestsTrendPct={0}
        messagesValue={0}
        messagesTrendPct={0}
        tokensValue={1234}
        tokensTrendPct={0}
        costValue={4.56}
        costTrendPct={0}
        range="24h"
        agentTimeseries={{ agents: ['openai'], timeseries: [] }}
        agentCostTimeseries={{
          agents: ['openai'],
          timeseries: [{ hour: '2026-06-04 10:00:00', openai: 4.56 }],
        }}
        colorMap={{ openai: '#111111' }}
      />
    ));

    expect(screen.getByText('Cost')).toBeDefined();
    await buildLazyChart();
  });

  it('renders ProviderChartCard empty states and hides cost when missing', () => {
    const { unmount } = render(() => (
      <ProviderChartCard
        activeView="requests"
        onViewChange={vi.fn()}
        requestsValue={0}
        requestsTrendPct={0}
        messagesValue={0}
        messagesTrendPct={0}
        tokensValue={0}
        tokensTrendPct={0}
        range="24h"
        agentTimeseries={{ agents: [], timeseries: [] }}
        agentMessageTimeseries={{ agents: [], timeseries: [] }}
        agentCostTimeseries={{ agents: [], timeseries: [] }}
      />
    ));

    expect(screen.getByText('No request data for this time range')).toBeDefined();
    expect(screen.queryByText('Cost')).toBeNull();
    unmount();

    const tokenEmpty = render(() => (
      <ProviderChartCard
        activeView="tokens"
        onViewChange={vi.fn()}
        requestsValue={0}
        requestsTrendPct={0}
        messagesValue={0}
        messagesTrendPct={0}
        tokensValue={0}
        tokensTrendPct={0}
        range="24h"
        agentTimeseries={{ agents: [], timeseries: [] }}
        agentCostTimeseries={{ agents: [], timeseries: [] }}
      />
    ));

    expect(screen.getByText('No token data for this time range')).toBeDefined();
    expect(screen.queryByText('Cost')).toBeNull();
    unmount();

    render(() => (
      <ProviderChartCard
        activeView="cost"
        onViewChange={vi.fn()}
        requestsValue={0}
        requestsTrendPct={0}
        messagesValue={0}
        messagesTrendPct={0}
        tokensValue={0}
        tokensTrendPct={0}
        costValue={0}
        costTrendPct={0}
        range="24h"
        agentTimeseries={{ agents: [], timeseries: [] }}
        agentCostTimeseries={{ agents: [], timeseries: [] }}
      />
    ));

    expect(screen.getByText('No cost data for this time range')).toBeDefined();
  });

  it('builds stacked data for the multi-agent token chart', () => {
    const hover = vi.fn();

    render(() => (
      <MultiAgentTokenChart
        agents={['openai', 'anthropic']}
        timeseries={[{ hour: '2026-06-04 10:00:00', openai: 10, anthropic: 5 }]}
        range="24h"
        colorMap={{ openai: '#111111', anthropic: '#222222' }}
        onHoverValues={hover}
      />
    ));

    buildCapturedChart();
    expect(capturedChartData).toHaveLength(3);
    expect(capturedChartOpts.series).toHaveLength(3);

    capturedChartOpts.hooks.setCursor[0]({
      cursor: { idx: 0 },
      data: capturedChartData,
      bbox: { width: 800 },
      valToPos: () => 120,
    });
    expect(hover).toHaveBeenCalledWith({ openai: 10, anthropic: 5 });

    // Tooltip rows render after a hover with non-zero values.
    expect(screen.getByText('openai')).toBeDefined();
    expect(screen.getByText('Total')).toBeDefined();
  });

  it('formats token y-axis values and snaps the cursor for token charts', () => {
    render(() => (
      <MultiAgentTokenChart
        agents={['openai']}
        timeseries={[{ hour: '2026-06-04 10:00:00', openai: 1234 }]}
        range="24h"
        colorMap={{ openai: '#111111' }}
      />
    ));

    buildCapturedChart();
    // Token axis uses formatLegendTokens (mocked to String()).
    expect(capturedChartOpts.axes[1].values({}, [1234])).toEqual(['1234']);
    expect(
      capturedChartOpts.cursor.move({ posToIdx: () => 0, data: [[1700000000]], valToPos: () => 5 }, 7, 3),
    ).toEqual([5, 3]);
  });

  it('builds empty and cost multi-day chart states', () => {
    const hover = vi.fn();

    const { container } = render(() => (
      <MultiAgentTokenChart
        agents={['openai']}
        timeseries={[]}
        range="30d"
        colorMap={{ openai: '#111111' }}
        onHoverValues={hover}
        label="Cost"
      />
    ));

    buildCapturedChart();
    expect(capturedChartData[1][0]).toBe(0);
    // Cost y-axis uses formatCost: whole/cent values render normally, but a
    // sub-cent value surfaces as "< $0.01" instead of rounding to "$0.00".
    expect(capturedChartOpts.axes[1].values({}, [1.23])).toEqual(['$1.23']);
    expect(capturedChartOpts.axes[1].values({}, [0.004])).toEqual(['< $0.01']);
    expect(capturedChartOpts.axes[1].values({}, [0])).toEqual(['$0.00']);
    expect(
      capturedChartOpts.cursor.move({ posToIdx: () => null, data: [[]], valToPos: () => 0 }, 42, 9),
    ).toEqual([42, 9]);

    capturedChartOpts.hooks.setCursor[0]({ cursor: { idx: -1 } });
    expect(hover).toHaveBeenCalledWith(null);

    fireEvent.mouseLeave(container.firstElementChild!);
    expect(hover).toHaveBeenLastCalledWith(null);
  });

  it('falls back to a distinct per-index default color for each series (no colorMap)', () => {
    const hover = vi.fn();

    render(() => (
      <MultiAgentTokenChart
        agents={['openai', 'anthropic']}
        timeseries={[{ hour: '2026-06-04 10:00:00', openai: 10, anthropic: 5 }]}
        range="24h"
        onHoverValues={hover}
      />
    ));

    buildCapturedChart();
    // Series are rendered in reverse agent order; each must get the default
    // color for its ORIGINAL index, so colors don't all collapse onto index 0.
    // reversed = ['anthropic'(idx1), 'openai'(idx0)] → AGENT_COLORS[1], [0].
    const strokes = capturedChartOpts.series
      .slice(1)
      .map((s: { stroke: string }) => s.stroke);
    expect(strokes).toEqual([AGENT_COLORS[1], AGENT_COLORS[0]]);
    // A real per-series distinction: the two strokes differ.
    expect(strokes[0]).not.toBe(strokes[1]);

    capturedChartOpts.hooks.setCursor[0]({
      cursor: { idx: 0 },
      data: capturedChartData,
      bbox: { width: 800 },
      valToPos: () => 700,
    });
    expect(hover).toHaveBeenCalledWith({ openai: 10, anthropic: 5 });
  });

  it('honors an explicit colorMap entry over the per-index fallback', () => {
    render(() => (
      <MultiAgentTokenChart
        agents={['openai', 'anthropic']}
        timeseries={[{ hour: '2026-06-04 10:00:00', openai: 10, anthropic: 5 }]}
        range="24h"
        colorMap={{ openai: '#abcdef' }}
      />
    ));

    buildCapturedChart();
    // reversed order: anthropic (no map → AGENT_COLORS[1]), openai (mapped).
    const strokes = capturedChartOpts.series
      .slice(1)
      .map((s: { stroke: string }) => s.stroke);
    expect(strokes).toEqual([AGENT_COLORS[1], '#abcdef']);
  });
});
