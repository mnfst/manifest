import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import type { SavingsData, SavingsTimeseriesRow } from '../../src/services/api/analytics.js';

let mockSavingsResult: SavingsData | null = null;
let mockTimeseriesResult: SavingsTimeseriesRow[] = [];
let mockSavingsError = false;
let mockTimeseriesError = false;

vi.mock('../../src/services/api/analytics.js', () => ({
  getSavings: vi.fn(() =>
    mockSavingsError
      ? Promise.reject(new Error('fail'))
      : Promise.resolve(mockSavingsResult),
  ),
  getSavingsTimeseries: vi.fn(() =>
    mockTimeseriesError
      ? Promise.reject(new Error('fail'))
      : Promise.resolve(mockTimeseriesResult),
  ),
}));

import SavingsCard from '../../src/components/SavingsCard';

const AUTO_SAVINGS: SavingsData = {
  total_saved: 12.47,
  savings_pct: 67,
  actual_cost: 6.18,
  baseline_cost: 18.65,
  baseline_model: null,
  baseline_override_stale: false,
  request_count: 142,
  trend_pct: 15,
  is_auto: true,
  savings_by_auth_type: { api_key: 8.2, subscription: 3.5, local: 0.77 },
};

const SAMPLE_TIMESERIES: SavingsTimeseriesRow[] = [
  { date: '2026-04-20', actual_cost: 2.0, baseline_cost: 5.0 },
  { date: '2026-04-21', actual_cost: 1.5, baseline_cost: 4.0 },
];

const noop = () => {};
const noopData = () => {};
const noopTimeseries = () => {};

function defaultProps(overrides: Record<string, unknown> = {}) {
  return {
    agentName: 'bot-1',
    range: '30d',
    ping: 0,
    onOpenExplainer: noop,
    onData: noopData,
    onTimeseriesData: noopTimeseries,
    ...overrides,
  };
}

describe('SavingsCard', () => {
  beforeEach(() => {
    mockSavingsResult = AUTO_SAVINGS;
    mockTimeseriesResult = SAMPLE_TIMESERIES;
    mockSavingsError = false;
    mockTimeseriesError = false;
  });

  it('calls onData with savings in auto mode', async () => {
    const onData = vi.fn();
    render(() => <SavingsCard {...defaultProps({ onData })} />);
    await vi.waitFor(() => {
      expect(onData).toHaveBeenCalledWith(12.47, 67);
    });
  });

  it('calls onData with null when no data and not auto', async () => {
    mockSavingsResult = {
      ...AUTO_SAVINGS,
      is_auto: false,
      baseline_model: null,
      request_count: 0,
    };
    const onData = vi.fn();
    render(() => <SavingsCard {...defaultProps({ onData })} />);
    await vi.waitFor(() => {
      expect(onData).toHaveBeenCalledWith(null, null);
    });
  });

  it('does not render controls on API error', async () => {
    mockSavingsError = true;
    const { container } = render(() => <SavingsCard {...defaultProps()} />);
    await vi.waitFor(() => {
      expect(container.querySelector('.savings-controls__info-wrap')).toBeNull();
    });
  });

  it('renders info icon', async () => {
    const { container } = render(() => <SavingsCard {...defaultProps()} />);
    await vi.waitFor(() => {
      expect(container.querySelector('.info-tooltip__icon')).not.toBeNull();
    });
  });

  it('calls onTimeseriesData with timeseries data', async () => {
    const onTimeseriesData = vi.fn();
    render(() => <SavingsCard {...defaultProps({ onTimeseriesData })} />);
    await vi.waitFor(() => {
      expect(onTimeseriesData).toHaveBeenCalledWith(SAMPLE_TIMESERIES);
    });
  });

  it('calls onTimeseriesData with empty array on API error', async () => {
    mockTimeseriesError = true;
    const onTimeseriesData = vi.fn();
    render(() => <SavingsCard {...defaultProps({ onTimeseriesData })} />);
    await vi.waitFor(() => {
      expect(onTimeseriesData).toHaveBeenCalledWith([]);
    });
  });

  it('shows tooltip on hover over info wrapper', async () => {
    const { container } = render(() => <SavingsCard {...defaultProps()} />);
    await vi.waitFor(() => {
      expect(container.querySelector('.savings-controls__info-wrap')).not.toBeNull();
    });
    const wrap = container.querySelector('.savings-controls__info-wrap')!;
    wrap.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    await vi.waitFor(() => {
      expect(container.querySelector('.savings-tooltip')).not.toBeNull();
    });
  });

  it('hides tooltip after mouseleave with delay', async () => {
    vi.useFakeTimers();
    const { container } = render(() => <SavingsCard {...defaultProps()} />);
    await vi.waitFor(() => {
      expect(container.querySelector('.savings-controls__info-wrap')).not.toBeNull();
    });
    const wrap = container.querySelector('.savings-controls__info-wrap')!;
    wrap.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    await vi.waitFor(() => {
      expect(container.querySelector('.savings-tooltip')).not.toBeNull();
    });
    wrap.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    vi.advanceTimersByTime(300);
    expect(container.querySelector('.savings-tooltip')).toBeNull();
    vi.useRealTimers();
  });

  it('cancels hide timer when re-entering before delay expires', async () => {
    vi.useFakeTimers();
    const { container } = render(() => <SavingsCard {...defaultProps()} />);
    await vi.waitFor(() => {
      expect(container.querySelector('.savings-controls__info-wrap')).not.toBeNull();
    });
    const wrap = container.querySelector('.savings-controls__info-wrap')!;
    wrap.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    await vi.waitFor(() => {
      expect(container.querySelector('.savings-tooltip')).not.toBeNull();
    });
    wrap.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    vi.advanceTimersByTime(100);
    wrap.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    vi.advanceTimersByTime(300);
    expect(container.querySelector('.savings-tooltip')).not.toBeNull();
    vi.useRealTimers();
  });

  it('calls onOpenExplainer and closes tooltip when "More details" is clicked', async () => {
    const onOpen = vi.fn();
    const { container } = render(() => <SavingsCard {...defaultProps({ onOpenExplainer: onOpen })} />);
    await vi.waitFor(() => {
      expect(container.querySelector('.savings-controls__info-wrap')).not.toBeNull();
    });
    const wrap = container.querySelector('.savings-controls__info-wrap')!;
    wrap.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    await vi.waitFor(() => {
      expect(container.querySelector('.savings-tooltip__link')).not.toBeNull();
    });
    const link = container.querySelector('.savings-tooltip__link') as HTMLAnchorElement;
    link.click();
    expect(onOpen).toHaveBeenCalled();
    expect(container.querySelector('.savings-tooltip')).toBeNull();
  });
});
