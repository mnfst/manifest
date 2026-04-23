import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';

// uPlot-backed charts are heavy and already excluded from coverage. Stub them to
// simple DOM markers so we can assert which view is active.
vi.mock('../../src/components/CostChart.jsx', () => ({
  default: (props: { data: unknown[] }) => (
    <div data-testid="cost-chart" data-points={props.data.length} />
  ),
}));
vi.mock('../../src/components/TokenChart.jsx', () => ({
  default: (props: { data: unknown[] }) => (
    <div data-testid="token-chart" data-points={props.data.length} />
  ),
}));
vi.mock('../../src/components/SingleTokenChart.jsx', () => ({
  default: (props: { data: unknown[] }) => (
    <div data-testid="single-token-chart" data-points={props.data.length} />
  ),
}));

import ChartCard from '../../src/components/ChartCard';

function baseProps(overrides: Record<string, unknown> = {}) {
  return {
    activeView: 'cost' as const,
    onViewChange: vi.fn(),
    costValue: 12.34,
    costTrendPct: 15,
    tokensValue: 1000,
    tokensTrendPct: -10,
    messagesValue: 5,
    messagesTrendPct: 0,
    costUsage: [{ hour: '2026-04-20T12:00:00', cost: 1 }],
    tokenUsage: [{ hour: '2026-04-20T12:00:00', input_tokens: 10, output_tokens: 5 }],
    messageChartData: [{ time: '2026-04-20T12:00:00', value: 1 }],
    range: '24h',
    ...overrides,
  };
}

describe('ChartCard', () => {
  it('renders cost/tokens/messages stats with formatted values', () => {
    const { container } = render(() => <ChartCard {...baseProps()} />);
    const stats = container.querySelectorAll('.chart-card__stat');
    expect(stats).toHaveLength(3);
    expect(stats[0].textContent).toContain('Messages');
    expect(stats[1].textContent).toContain('Cost');
    expect(stats[2].textContent).toContain('Token usage');
    // formatCost formats 12.34 → $12.34
    expect(container.textContent).toContain('$12.34');
    // formatNumber formats 1000 → 1k
    expect(container.textContent).toMatch(/1(,|\.)?\d*k?/i);
  });

  it('marks the active view and only renders that view\'s chart', () => {
    const { container } = render(() => (
      <ChartCard {...baseProps({ activeView: 'tokens' })} />
    ));
    // Only the tokens stat should have the active modifier.
    const active = container.querySelectorAll('.chart-card__stat--active');
    expect(active).toHaveLength(1);
    expect(active[0].textContent).toContain('Token usage');
    expect(container.querySelector('[data-testid="token-chart"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="cost-chart"]')).toBeNull();
    expect(container.querySelector('[data-testid="single-token-chart"]')).toBeNull();
  });

  it('invokes onViewChange when a stat tile is clicked', () => {
    const onViewChange = vi.fn();
    const { container } = render(() => (
      <ChartCard {...baseProps({ onViewChange })} />
    ));
    const tiles = container.querySelectorAll('.chart-card__stat--clickable');
    fireEvent.click(tiles[0]);
    expect(onViewChange).toHaveBeenCalledWith('messages');
  });

  it('shows a fallback message when the active view has no data', () => {
    const { container } = render(() => (
      <ChartCard {...baseProps({ activeView: 'cost', costUsage: [] })} />
    ));
    expect(container.textContent).toContain('No cost data for this time range');
    expect(container.querySelector('[data-testid="cost-chart"]')).toBeNull();
  });

  it('shows fallback messages for empty tokens and messages views', () => {
    const tokens = render(() => (
      <ChartCard {...baseProps({ activeView: 'tokens', tokenUsage: [] })} />
    ));
    expect(tokens.container.textContent).toContain('No token data for this time range');

    const messages = render(() => (
      <ChartCard {...baseProps({ activeView: 'messages', messageChartData: [] })} />
    ));
    expect(messages.container.textContent).toContain('No message data for this time range');
  });

  it('shows an up-bad trend badge for rising cost', () => {
    const { container } = render(() => <ChartCard {...baseProps({ costTrendPct: 25 })} />);
    const badge = container.querySelector('.trend--up-bad');
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toBe('+25%');
  });

  it('shows a down-good trend badge for falling cost', () => {
    const { container } = render(() => <ChartCard {...baseProps({ costTrendPct: -5 })} />);
    expect(container.querySelector('.trend--down-good')).not.toBeNull();
  });

  it('shows a neutral trend badge for messages', () => {
    const { container } = render(() => <ChartCard {...baseProps({ messagesTrendPct: 10 })} />);
    expect(container.querySelector('.trend--neutral')).not.toBeNull();
  });

  it('omits the trend badge when the value is essentially zero', () => {
    const { container } = render(() => (
      <ChartCard {...baseProps({ costValue: 0.001, costTrendPct: 50 })} />
    ));
    // costValue < 0.005 — no cost badge.
    const costCell = container.querySelectorAll('.chart-card__stat')[0];
    expect(costCell.querySelector('.trend')).toBeNull();
  });

  it('clamps absurdly large percentages to +/-999', () => {
    const { container } = render(() => (
      <ChartCard {...baseProps({ costTrendPct: 5000 })} />
    ));
    const badge = container.querySelector('.trend--up-bad');
    expect(badge?.textContent).toBe('+999%');
  });
});
