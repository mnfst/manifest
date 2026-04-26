import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import type { SavingsData, BaselineCandidateData } from '../../src/services/api/analytics.js';

let mockSavingsResult: SavingsData | null = null;
let mockCandidatesResult: BaselineCandidateData[] = [];
let mockSavingsError = false;

vi.mock('../../src/services/api/analytics.js', () => ({
  getSavings: vi.fn(() =>
    mockSavingsError
      ? Promise.reject(new Error('fail'))
      : Promise.resolve(mockSavingsResult),
  ),
  getBaselineCandidates: vi.fn(() => Promise.resolve(mockCandidatesResult)),
  updateBaseline: vi.fn(() => Promise.resolve(mockSavingsResult)),
}));

vi.mock('../../src/services/toast-store.js', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import SavingsCard from '../../src/components/SavingsCard';

const SAMPLE_SAVINGS: SavingsData = {
  total_saved: 12.47,
  savings_pct: 67,
  actual_cost: 6.18,
  baseline_cost: 18.65,
  baseline_model: {
    id: 'claude-sonnet-4-5',
    display_name: 'Claude Sonnet 4.5',
    provider: 'anthropic',
    input_price_per_token: 0.000003,
    output_price_per_token: 0.000015,
  },
  baseline_override_stale: false,
  request_count: 142,
  trend_pct: 15,
  savings_by_auth_type: { api_key: 8.2, subscription: 3.5, local: 0.77 },
};

const SAMPLE_CANDIDATES: BaselineCandidateData[] = [
  {
    id: 'claude-sonnet-4-5',
    display_name: 'Claude Sonnet 4.5',
    provider: 'anthropic',
    input_price_per_token: 0.000003,
    output_price_per_token: 0.000015,
    price_per_million: 18.0,
    is_current: true,
  },
];

const noop = () => {};
const noopData = () => {};

describe('SavingsCard', () => {
  beforeEach(() => {
    mockSavingsResult = SAMPLE_SAVINGS;
    mockCandidatesResult = SAMPLE_CANDIDATES;
    mockSavingsError = false;
  });

  it('renders vs label when baseline exists', async () => {
    render(() => (
      <SavingsCard agentName="bot-1" range="30d" ping={0} onOpenExplainer={noop} onData={noopData} />
    ));
    await vi.waitFor(() => {
      expect(screen.getByText('vs')).toBeDefined();
    });
  });

  it('renders baseline select when baseline exists', async () => {
    render(() => (
      <SavingsCard agentName="bot-1" range="30d" ping={0} onOpenExplainer={noop} onData={noopData} />
    ));
    await vi.waitFor(() => {
      expect(screen.getByLabelText('Baseline model')).toBeDefined();
    });
  });

  it('renders info button', async () => {
    render(() => (
      <SavingsCard agentName="bot-1" range="30d" ping={0} onOpenExplainer={noop} onData={noopData} />
    ));
    await vi.waitFor(() => {
      expect(screen.getByLabelText('How savings are calculated')).toBeDefined();
    });
  });

  it('calls onData with savings values', async () => {
    const onData = vi.fn();
    render(() => (
      <SavingsCard agentName="bot-1" range="30d" ping={0} onOpenExplainer={noop} onData={onData} />
    ));
    await vi.waitFor(() => {
      expect(onData).toHaveBeenCalledWith(12.47, 67);
    });
  });

  it('calls onData with null when no baseline', async () => {
    mockSavingsResult = { ...SAMPLE_SAVINGS, baseline_model: null };
    const onData = vi.fn();
    render(() => (
      <SavingsCard agentName="bot-1" range="30d" ping={0} onOpenExplainer={noop} onData={onData} />
    ));
    await vi.waitFor(() => {
      expect(onData).toHaveBeenCalledWith(null, null);
    });
  });

  it('does not render controls on API error', async () => {
    mockSavingsError = true;
    const { container } = render(() => (
      <SavingsCard agentName="bot-1" range="30d" ping={0} onOpenExplainer={noop} onData={noopData} />
    ));
    await vi.waitFor(() => {
      expect(container.querySelector('.savings-controls__vs')).toBeNull();
    });
  });

  it('calls onOpenExplainer when info button clicked', async () => {
    const onOpen = vi.fn();
    render(() => (
      <SavingsCard agentName="bot-1" range="30d" ping={0} onOpenExplainer={onOpen} onData={noopData} />
    ));
    await vi.waitFor(() => {
      screen.getByLabelText('How savings are calculated').click();
    });
    expect(onOpen).toHaveBeenCalledWith('Claude Sonnet 4.5');
  });

  it('populates baseline dropdown with candidates', async () => {
    mockCandidatesResult = [
      { id: 'model-a', display_name: 'Model A', provider: 'p1', input_price_per_token: 0.001, output_price_per_token: 0.002, price_per_million: 3.0, is_current: false },
      { id: 'claude-sonnet-4-5', display_name: 'Claude Sonnet 4.5', provider: 'anthropic', input_price_per_token: 0.003, output_price_per_token: 0.015, price_per_million: 18.0, is_current: true },
    ];
    render(() => (
      <SavingsCard agentName="bot-1" range="30d" ping={0} onOpenExplainer={noop} onData={noopData} />
    ));
    await vi.waitFor(() => {
      expect(screen.getByLabelText('Baseline model')).toBeDefined();
    });
    screen.getByLabelText('Baseline model').click();
    await vi.waitFor(() => {
      expect(screen.getByText('Model A ($3.00/M)')).toBeDefined();
    });
  });

  it('shows display name in select trigger', async () => {
    render(() => (
      <SavingsCard agentName="bot-1" range="30d" ping={0} onOpenExplainer={noop} onData={noopData} />
    ));
    await vi.waitFor(() => {
      expect(screen.getByText('Claude Sonnet 4.5')).toBeDefined();
    });
  });

  it('handles baseline change to a specific model', async () => {
    const { updateBaseline: mockUpdate } = await import('../../src/services/api/analytics.js');
    mockCandidatesResult = [
      { id: 'gpt-4o', display_name: 'GPT-4o', provider: 'openai', input_price_per_token: 0.005, output_price_per_token: 0.015, price_per_million: 20.0, is_current: false },
    ];
    render(() => (
      <SavingsCard agentName="bot-1" range="30d" ping={0} onOpenExplainer={noop} onData={noopData} />
    ));
    await vi.waitFor(() => {
      screen.getByLabelText('Baseline model').click();
    });
    await vi.waitFor(() => {
      screen.getByText('GPT-4o ($20.00/M)').click();
    });
    await vi.waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith('bot-1', 'gpt-4o');
    });
  });

  it('handles baseline change to auto', async () => {
    const { updateBaseline: mockUpdate } = await import('../../src/services/api/analytics.js');
    render(() => (
      <SavingsCard agentName="bot-1" range="30d" ping={0} onOpenExplainer={noop} onData={noopData} />
    ));
    await vi.waitFor(() => {
      screen.getByLabelText('Baseline model').click();
    });
    await vi.waitFor(() => {
      screen.getByText('Auto (cheapest that covers all tiers)').click();
    });
    await vi.waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith('bot-1', null);
    });
  });

  it('shows toast on baseline update failure', async () => {
    const { updateBaseline: mockUpdate } = await import('../../src/services/api/analytics.js');
    const { toast: mockToast } = await import('../../src/services/toast-store.js');
    (mockUpdate as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('fail'));
    mockCandidatesResult = [
      { id: 'gpt-4o', display_name: 'GPT-4o', provider: 'openai', input_price_per_token: 0.005, output_price_per_token: 0.015, price_per_million: 20.0, is_current: false },
    ];
    render(() => (
      <SavingsCard agentName="bot-1" range="30d" ping={0} onOpenExplainer={noop} onData={noopData} />
    ));
    await vi.waitFor(() => {
      screen.getByLabelText('Baseline model').click();
    });
    await vi.waitFor(() => {
      screen.getByText('GPT-4o ($20.00/M)').click();
    });
    await vi.waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Failed to update baseline model');
    });
  });

  it('returns __auto__ when baseline_model.id differs from is_current candidate', async () => {
    mockCandidatesResult = [
      { id: 'other-model', display_name: 'Other', provider: 'p1', input_price_per_token: 0.001, output_price_per_token: 0.002, price_per_million: 3.0, is_current: true },
    ];
    const onData = vi.fn();
    render(() => (
      <SavingsCard agentName="bot-1" range="30d" ping={0} onOpenExplainer={noop} onData={onData} />
    ));
    await vi.waitFor(() => {
      expect(onData).toHaveBeenCalledWith(12.47, 67);
    });
  });
});
