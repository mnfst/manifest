import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';

type Ctx = ReturnType<(typeof import('../../src/pages/ProjectDetail'))['useProjectDetail']>;
let mockCtx: Ctx;
vi.mock('../../src/pages/ProjectDetail.jsx', () => ({
  useProjectDetail: () => mockCtx,
}));

import ProjectOverview, { axisLabels, dayLabel } from '../../src/pages/ProjectOverview';

const resource = <T,>(value: T, loading = false, error: unknown = undefined) =>
  Object.assign(() => value, {
    loading,
    error,
    state: 'ready',
  }) as unknown as Ctx['overview'];

const overview = {
  cost_month_usd: 1204.8,
  cost_trend_pct: 23,
  cost_last_month_usd: 980.15,
  requests: 64110,
  tokens: 151_000_000,
  cost_series: [
    { date: '2026-08-01', cost_usd: 10 },
    { date: '2026-08-02', cost_usd: 20 },
    { date: '2026-08-03', cost_usd: 30 },
  ],
  tokens_series: [
    { date: '2026-08-01', tokens: 100 },
    { date: '2026-08-02', tokens: 200 },
  ],
  cost_by_owner: [
    { owner: { id: 'u1', name: 'Maya Okonkwo' }, cost_usd: 412.6 },
    { owner: null, cost_usd: 112.15 },
  ],
  agents: [],
  users: [],
  spend_shared: false,
};

const makeCtx = (ov: unknown, loading = false, error: unknown = undefined): Ctx =>
  ({
    projectId: () => 'p-1',
    project: resource(null) as never,
    overview: resource(ov, loading, error),
    refetchProject: vi.fn(),
    refetchOverview: vi.fn(),
  }) as unknown as Ctx;

describe('ProjectOverview', () => {
  beforeEach(() => {
    mockCtx = makeCtx(overview);
  });

  it('renders KPIs, the cost chart, cost by owner and token usage', () => {
    const { container } = render(() => <ProjectOverview />);
    expect(container.querySelectorAll('.overview-stat-card').length).toBe(4);
    expect(container.textContent).toContain('$1,204.80');
    expect(container.textContent).toContain('+23%');
    expect(container.textContent).toContain('$980.15');
    expect(container.textContent).toContain('64.1k');
    expect(container.textContent).toContain('151M');
    expect(container.querySelector('svg[aria-label^="Daily cost this month"]')).not.toBeNull();
    expect(
      container.querySelector('svg[aria-label^="Daily token usage this month"]'),
    ).not.toBeNull();
    expect(container.textContent).toContain('Maya Okonkwo');
    expect(container.textContent).toContain('$412.60');
    expect(container.querySelector('.pill-muted')?.textContent).toBe('No user');
    expect(container.textContent).toContain('$112.15');
    expect(container.textContent).not.toContain('counted in each project');
    expect(container.textContent).toContain('1 Aug');
    expect(container.textContent).toContain('3 Aug');
  });

  it('warns when cost is counted in each project and handles no owners', () => {
    mockCtx = makeCtx({ ...overview, spend_shared: true, cost_by_owner: [] });
    const { container } = render(() => <ProjectOverview />);
    expect(container.textContent).toContain('Their cost is counted in each project');
    expect(container.textContent).toContain('No cost yet this month.');
  });

  it('shows a skeleton while loading and a hint when unavailable', () => {
    mockCtx = makeCtx(undefined, true);
    const loading = render(() => <ProjectOverview />);
    expect(loading.container.querySelector('.skeleton')).not.toBeNull();
    loading.unmount();
    mockCtx = makeCtx(null, false);
    const { container, getByText } = render(() => <ProjectOverview />);
    expect(container.textContent).toContain('Overview unavailable for this project.');
    fireEvent.click(getByText('Try again'));
    expect(mockCtx.refetchOverview).toHaveBeenCalled();
  });

  it('shows an error state with retry when the overview failed', () => {
    mockCtx = makeCtx(undefined, false, new Error('boom'));
    const { container, getByText } = render(() => <ProjectOverview />);
    expect(container.textContent).toContain("Couldn't load this overview");
    expect(container.textContent).toContain('boom');
    expect(container.querySelector('.overview-stat-card')).toBeNull();
    fireEvent.click(getByText('Try again'));
    expect(mockCtx.refetchOverview).toHaveBeenCalled();
  });

  it('builds axis labels', () => {
    expect(dayLabel('2026-08-14')).toBe('14 Aug');
    expect(axisLabels([])).toEqual([]);
    expect(axisLabels(['2026-08-01'])).toEqual(['1 Aug']);
    expect(axisLabels(['2026-08-01', '2026-08-02'])).toEqual(['1 Aug', '2 Aug', '2 Aug']);
    expect(axisLabels(['2026-08-01', '2026-08-14', '2026-08-26'])).toEqual([
      '1 Aug',
      '14 Aug',
      '26 Aug',
    ]);
  });
});
