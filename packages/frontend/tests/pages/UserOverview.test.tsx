import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';

vi.mock('@solidjs/router', () => ({
  A: (props: any) => (
    <a href={props.href} class={props.class} data-state={JSON.stringify(props.state ?? null)}>
      {props.children}
    </a>
  ),
}));

const [mockOverview, setMockOverview] = createSignal<any>(undefined);
const [mockOverviewError, setMockOverviewError] = createSignal<unknown>(undefined);
const [mockUser, setMockUser] = createSignal<any>(undefined);
const mockRefetchOverview = vi.fn();
// A resource look-alike: the value is the accessor, error/loading are getters.
const overviewResource = Object.defineProperties(() => mockOverview(), {
  error: { get: () => mockOverviewError() },
  loading: { get: () => false },
});
vi.mock('../../src/pages/UserDetail.jsx', () => ({
  useUserDetail: () => ({
    userId: () => 'u-maya',
    user: mockUser,
    overview: overviewResource,
    refetchUser: vi.fn(),
    refetchOverview: mockRefetchOverview,
  }),
}));

import UserOverview, { axisLabels, shortDay } from '../../src/pages/UserOverview';

const maya = { id: 'u-maya', name: 'Maya Okonkwo' };

const agents = [
  {
    agent_name: 'claude-code',
    display_name: 'claude-code',
    agent_platform: 'claude-code',
    agent_category: 'coding',
    owner: maya,
    projects: [{ id: 'p-atlas', name: 'Atlas' }],
    models_enabled: 12,
    models_total: 40,
    spend_30d_usd: 121.3,
    request_count: 12880,
    last_used_at: null,
    archived_at: null,
  },
  {
    agent_name: 'bot',
    display_name: 'Bot',
    agent_platform: null,
    agent_category: null,
    owner: maya,
    projects: [],
    models_enabled: 40,
    models_total: 40,
    spend_30d_usd: 1,
    request_count: 2,
    last_used_at: null,
    archived_at: '2026-08-01T00:00:00Z',
  },
];

const overview = {
  cost_month_usd: 186.2,
  cost_trend_pct: 22,
  budget_usd: 200,
  requests: 21406,
  tokens: 48_200_000,
  cost_series: [
    { date: '2026-08-01', cost_usd: 3 },
    { date: '2026-08-02', cost_usd: 5 },
    { date: '2026-08-03', cost_usd: 4 },
  ],
  agents,
};

describe('UserOverview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setMockUser(maya);
    setMockOverview(undefined);
    setMockOverviewError(undefined);
  });

  it('shows a skeleton until the overview loads', () => {
    const { container } = render(() => <UserOverview />);
    expect(container.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
  });

  it('shows an error state with retry when the overview failed', () => {
    setMockOverviewError(new Error('boom'));
    const { container, getByText } = render(() => <UserOverview />);
    expect(container.textContent).toContain("Couldn't load this overview");
    expect(container.textContent).toContain('boom');
    expect(container.querySelector('.skeleton')).toBeNull();
    fireEvent.click(getByText('Try again'));
    expect(mockRefetchOverview).toHaveBeenCalled();
  });

  it('renders the stat cards, the chart against the budget and the agents', () => {
    setMockOverview(overview);
    const { container } = render(() => <UserOverview />);
    expect(container.textContent).toContain('$186.20');
    expect(container.textContent).toContain('+22%');
    expect(container.textContent).toContain('$13.80 left');
    expect(container.textContent).toContain('21.4k');
    expect(container.textContent).toContain('48.2M');
    expect(container.textContent).toContain('Against a $200 monthly budget');
    expect(container.querySelector('.bar-chart__svg')).toBeTruthy();
    expect(container.textContent).toContain('1 Aug');
    expect(container.textContent).toContain('Atlas');
    expect(container.textContent).toContain('None');
    expect(container.textContent).toContain('Archived');
    expect(container.querySelector('img.who__icon')).toBeTruthy();
    expect(container.textContent).toContain('12.9k');
    expect(container.textContent).toContain('$121.30');
    const link = container.querySelector('a[href="/agents/claude-code"]')!;
    expect(JSON.parse(link.getAttribute('data-state')!)).toEqual({
      via: [
        { label: 'Users', href: '/users' },
        { label: 'Maya Okonkwo', href: '/users/u-maya' },
      ],
    });
  });

  it('colours the budget card amber near the cap and red over it', () => {
    setMockOverview({ ...overview, cost_month_usd: 208.4 });
    const { container } = render(() => <UserOverview />);
    expect(container.textContent).toContain('$8.40 over');
    const cards = container.querySelectorAll('.overview-stat-card__value');
    expect((cards[1] as HTMLElement).style.color).toContain('destructive');
  });

  it('handles a user without a budget and without agents', () => {
    setMockOverview({ ...overview, budget_usd: null, agents: [], cost_series: [] });
    setMockUser(undefined);
    const { container } = render(() => <UserOverview />);
    expect(container.textContent).toContain('No budget');
    expect(container.textContent).toContain('This month');
    expect(container.textContent).toContain('No agents yet');
    expect(container.textContent).toContain('No data for this period yet.');
  });

  it('formats axis labels', () => {
    expect(shortDay('2026-08-01')).toBe('1 Aug');
    expect(axisLabels([])).toEqual([]);
    expect(axisLabels(['2026-08-01', '2026-08-02'])).toEqual(['1 Aug', '2 Aug']);
    expect(
      axisLabels(['2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04', '2026-08-05']),
    ).toEqual(['1 Aug', '3 Aug', '5 Aug']);
  });
});
