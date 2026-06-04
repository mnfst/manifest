import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';

let capturedLifecycleOpts: any = null;
let capturedChartOpts: any = null;
let capturedChartData: any = null;

const routerMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
}));

const apiMocks = vi.hoisted(() => ({
  createAgent: vi.fn(),
}));

vi.mock('@solidjs/router', () => ({
  Navigate: (props: { href: string }) => <span data-testid="redirect">{props.href}</span>,
  useNavigate: () => routerMocks.navigate,
}));

vi.mock('manifest-shared', () => ({
  PLATFORMS_BY_CATEGORY: { personal: ['codex'], work: ['cursor'] },
}));

vi.mock('../../src/components/AgentTypeSelect.jsx', () => ({
  default: (props: {
    category: string | null;
    platform: string | null;
    onCategoryChange: (category: string) => void;
    onPlatformChange: (platform: string) => void;
  }) => (
    <div data-category={props.category ?? ''} data-platform={props.platform ?? ''}>
      <button onClick={() => props.onCategoryChange('work')}>Work type</button>
      <button onClick={() => props.onPlatformChange('cursor')}>Cursor platform</button>
    </div>
  ),
}));

vi.mock('../../src/services/api.js', () => ({
  createAgent: (...args: unknown[]) => apiMocks.createAgent(...args),
}));

vi.mock('../../src/services/toast-store.js', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

vi.mock('../../src/services/recent-agents.js', () => ({
  markAgentCreated: vi.fn(),
}));

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

import ActionMenu from '../../src/components/ActionMenu';
import AddAgentModal from '../../src/components/AddAgentModal';
import GlobalOverviewSkeleton from '../../src/components/GlobalOverviewSkeleton';
import MultiAgentTokenChart from '../../src/components/MultiAgentTokenChart';
import ProviderChartCard from '../../src/components/ProviderChartCard';
import RootRedirect from '../../src/components/RootRedirect';

beforeEach(() => {
  vi.clearAllMocks();
  capturedLifecycleOpts = null;
  capturedChartOpts = null;
  capturedChartData = null;
  routerMocks.navigate.mockReset();
  apiMocks.createAgent.mockResolvedValue({
    agent: { name: 'new-agent' },
    apiKey: 'mnfst_test',
  });
});

const buildCapturedChart = () => {
  const el = capturedLifecycleOpts.el();
  Object.defineProperty(el, 'clientWidth', { value: 800, configurable: true });
  capturedLifecycleOpts.buildChart();
};

describe('global provider surface components', () => {
  it('opens action menu items and invokes the selected action', () => {
    const disconnect = vi.fn();

    render(() => (
      <ActionMenu items={[{ label: 'Disconnect', danger: true, onClick: disconnect }]} />
    ));

    fireEvent.click(screen.getByLabelText('Actions'));
    expect(screen.getByText('Disconnect')).toBeDefined();

    fireEvent.click(screen.getByText('Disconnect'));
    expect(disconnect).toHaveBeenCalled();
  });

  it('creates an agent from the add agent modal', async () => {
    const onClose = vi.fn();

    render(() => <AddAgentModal open onClose={onClose} />);

    fireEvent.input(screen.getByLabelText('Agent name'), { target: { value: 'New Agent' } });
    fireEvent.click(screen.getByText('Work type'));
    fireEvent.click(screen.getByText('Create'));

    await waitFor(() => {
      expect(apiMocks.createAgent).toHaveBeenCalledWith({
        name: 'New Agent',
        agent_category: 'work',
        agent_platform: 'cursor',
      });
      expect(onClose).toHaveBeenCalled();
      expect(routerMocks.navigate).toHaveBeenCalledWith('/agents/new-agent', {
        state: { newApiKey: 'mnfst_test' },
      });
    });
  });

  it('handles add agent modal keyboard and error paths', async () => {
    const onClose = vi.fn();
    apiMocks.createAgent.mockRejectedValueOnce(new Error('create failed'));

    const { unmount } = render(() => <AddAgentModal open onClose={onClose} />);

    const input = screen.getByLabelText('Agent name');
    fireEvent.input(input, { target: { value: 'Broken Agent' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(apiMocks.createAgent).toHaveBeenCalledWith({
        name: 'Broken Agent',
        agent_category: 'personal',
        agent_platform: 'codex',
      });
    });

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
    unmount();

    const overlayClose = vi.fn();
    const second = render(() => <AddAgentModal open onClose={overlayClose} />);
    fireEvent.click(second.container.querySelector('.modal-overlay')!);
    expect(overlayClose).toHaveBeenCalled();
  });

  it('renders the global overview skeleton placeholders', () => {
    const { container } = render(() => <GlobalOverviewSkeleton />);
    expect(container.querySelectorAll('.overview-stat-card')).toHaveLength(4);
    expect(container.querySelectorAll('.skeleton').length).toBeGreaterThan(10);
  });

  it('redirects the root route to overview', () => {
    render(() => <RootRedirect />);
    expect(screen.getByTestId('redirect').textContent).toBe('/overview');
  });

  it('renders ProviderChartCard views and changes active view on click', () => {
    const onViewChange = vi.fn();

    render(() => (
      <ProviderChartCard
        activeView="tokens"
        onViewChange={onViewChange}
        messagesValue={12}
        messagesTrendPct={10}
        tokensValue={1234}
        tokensTrendPct={5}
        costValue={4.56}
        costTrendPct={-2}
        costInfoTooltip="API key cost only"
        tokenUsage={[{ hour: '2026-06-04 10:00:00', input_tokens: 800, output_tokens: 400 }]}
        messageChartData={[{ time: '2026-06-04 10:00:00', value: 12 }]}
        range="24h"
        agentTimeseries={{
          agents: ['openai'],
          timeseries: [{ hour: '2026-06-04 10:00:00', openai: 1200 }],
        }}
        agentMessageTimeseries={{
          agents: ['openai'],
          timeseries: [{ hour: '2026-06-04 10:00:00', openai: 12 }],
        }}
        agentCostTimeseries={{
          agents: ['openai'],
          timeseries: [{ hour: '2026-06-04 10:00:00', openai: 4.56 }],
        }}
        colorMap={{ openai: '#111111' }}
      />
    ));

    expect(screen.getByText('Cost')).toBeDefined();
    expect(screen.getByText('Messages')).toBeDefined();
    expect(screen.getByText('Token usage')).toBeDefined();
    buildCapturedChart();

    fireEvent.click(screen.getByText('Messages'));
    expect(onViewChange).toHaveBeenCalledWith('messages');
  });

  it('renders ProviderChartCard message and cost chart branches', () => {
    const onViewChange = vi.fn();

    const { unmount } = render(() => (
      <ProviderChartCard
        activeView="messages"
        onViewChange={onViewChange}
        messagesValue={12}
        messagesTrendPct={0}
        tokensValue={1234}
        tokensTrendPct={0}
        costValue={4.56}
        costTrendPct={0}
        tokenUsage={[]}
        messageChartData={[{ time: '2026-06-04 10:00:00', value: 12 }]}
        range="24h"
        agentTimeseries={{ agents: ['openai'], timeseries: [] }}
        agentMessageTimeseries={{
          agents: ['openai'],
          timeseries: [{ hour: '2026-06-04 10:00:00', openai: 12 }],
        }}
        agentCostTimeseries={{
          agents: ['openai'],
          timeseries: [{ hour: '2026-06-04 10:00:00', openai: 4.56 }],
        }}
        colorMap={{ openai: '#111111' }}
      />
    ));

    expect(screen.getByText('Messages')).toBeDefined();
    buildCapturedChart();
    unmount();

    render(() => (
      <ProviderChartCard
        activeView="cost"
        onViewChange={onViewChange}
        messagesValue={12}
        messagesTrendPct={0}
        tokensValue={1234}
        tokensTrendPct={0}
        costValue={4.56}
        costTrendPct={0}
        tokenUsage={[]}
        messageChartData={[]}
        range="24h"
        agentTimeseries={{ agents: ['openai'], timeseries: [] }}
        agentMessageTimeseries={{ agents: ['openai'], timeseries: [] }}
        agentCostTimeseries={{
          agents: ['openai'],
          timeseries: [{ hour: '2026-06-04 10:00:00', openai: 4.56 }],
        }}
        colorMap={{ openai: '#111111' }}
      />
    ));

    expect(screen.getByText('Cost')).toBeDefined();
    buildCapturedChart();
  });

  it('renders ProviderChartCard empty states and hides cost when missing', () => {
    const { unmount } = render(() => (
      <ProviderChartCard
        activeView="messages"
        onViewChange={vi.fn()}
        messagesValue={0}
        messagesTrendPct={0}
        tokensValue={0}
        tokensTrendPct={0}
        tokenUsage={[]}
        messageChartData={[]}
        range="24h"
        agentTimeseries={{ agents: [], timeseries: [] }}
        agentMessageTimeseries={{ agents: [], timeseries: [] }}
        agentCostTimeseries={{ agents: [], timeseries: [] }}
      />
    ));

    expect(screen.getByText('No message data for this time range')).toBeDefined();
    expect(screen.queryByText('Cost')).toBeNull();
    unmount();

    const tokenEmpty = render(() => (
      <ProviderChartCard
        activeView="tokens"
        onViewChange={vi.fn()}
        messagesValue={0}
        messagesTrendPct={0}
        tokensValue={0}
        tokensTrendPct={0}
        tokenUsage={[]}
        messageChartData={[]}
        range="24h"
        agentTimeseries={{ agents: [], timeseries: [] }}
        agentMessageTimeseries={{ agents: [], timeseries: [] }}
        agentCostTimeseries={{ agents: [], timeseries: [] }}
      />
    ));

    expect(screen.getByText('No token data for this time range')).toBeDefined();
    tokenEmpty.unmount();

    render(() => (
      <ProviderChartCard
        activeView="cost"
        onViewChange={vi.fn()}
        messagesValue={0}
        messagesTrendPct={0}
        tokensValue={0}
        tokensTrendPct={0}
        costValue={0}
        costTrendPct={0}
        tokenUsage={[]}
        messageChartData={[]}
        range="24h"
        agentTimeseries={{ agents: [], timeseries: [] }}
        agentMessageTimeseries={{ agents: [], timeseries: [] }}
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
    expect(capturedChartOpts.axes[1].values({}, [1.23])).toEqual(['$1.23']);
    expect(
      capturedChartOpts.cursor.move({ posToIdx: () => null, data: [[]], valToPos: () => 0 }, 42, 9),
    ).toEqual([42, 9]);

    capturedChartOpts.hooks.setCursor[0]({ cursor: { idx: -1 } });
    expect(hover).toHaveBeenCalledWith(null);

    fireEvent.mouseLeave(container.firstElementChild!);
    expect(hover).toHaveBeenLastCalledWith(null);
  });
});
