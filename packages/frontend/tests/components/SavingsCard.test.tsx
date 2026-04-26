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

const OVERRIDE_SAVINGS: SavingsData = {
  ...AUTO_SAVINGS,
  is_auto: false,
  baseline_model: {
    id: 'claude-sonnet-4-5',
    display_name: 'Claude Sonnet 4.5',
    provider: 'anthropic',
    input_price_per_token: 0.000003,
    output_price_per_token: 0.000015,
  },
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
  {
    id: 'gpt-4o',
    display_name: 'GPT-4o',
    provider: 'openai',
    input_price_per_token: 0.005,
    output_price_per_token: 0.015,
    price_per_million: 20.0,
    is_current: false,
  },
];

const noop = () => {};
const noopData = () => {};

describe('SavingsCard', () => {
  beforeEach(() => {
    mockSavingsResult = AUTO_SAVINGS;
    mockCandidatesResult = SAMPLE_CANDIDATES;
    mockSavingsError = false;
  });

  it('renders controls in auto mode', async () => {
    render(() => (
      <SavingsCard agentName="bot-1" range="30d" ping={0} onOpenExplainer={noop} onData={noopData} />
    ));
    await vi.waitFor(() => {
      expect(screen.getByText('vs')).toBeDefined();
    });
  });

  it('shows Auto as display value in auto mode', async () => {
    render(() => (
      <SavingsCard agentName="bot-1" range="30d" ping={0} onOpenExplainer={noop} onData={noopData} />
    ));
    await vi.waitFor(() => {
      expect(screen.getByText('Auto')).toBeDefined();
    });
  });

  it('calls onData with savings in auto mode', async () => {
    const onData = vi.fn();
    render(() => (
      <SavingsCard agentName="bot-1" range="30d" ping={0} onOpenExplainer={noop} onData={onData} />
    ));
    await vi.waitFor(() => {
      expect(onData).toHaveBeenCalledWith(12.47, 67);
    });
  });

  it('shows model name when override is set', async () => {
    mockSavingsResult = OVERRIDE_SAVINGS;
    render(() => (
      <SavingsCard agentName="bot-1" range="30d" ping={0} onOpenExplainer={noop} onData={noopData} />
    ));
    await vi.waitFor(() => {
      expect(screen.getByText('Claude Sonnet 4.5')).toBeDefined();
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

  it('renders info button', async () => {
    render(() => (
      <SavingsCard agentName="bot-1" range="30d" ping={0} onOpenExplainer={noop} onData={noopData} />
    ));
    await vi.waitFor(() => {
      expect(screen.getByLabelText('How savings are calculated')).toBeDefined();
    });
  });

  it('calls onOpenExplainer on info click', async () => {
    mockSavingsResult = OVERRIDE_SAVINGS;
    const onOpen = vi.fn();
    render(() => (
      <SavingsCard agentName="bot-1" range="30d" ping={0} onOpenExplainer={onOpen} onData={noopData} />
    ));
    await vi.waitFor(() => {
      screen.getByLabelText('How savings are calculated').click();
    });
    expect(onOpen).toHaveBeenCalledWith('Claude Sonnet 4.5');
  });

  it('populates dropdown with candidates', async () => {
    render(() => (
      <SavingsCard agentName="bot-1" range="30d" ping={0} onOpenExplainer={noop} onData={noopData} />
    ));
    await vi.waitFor(() => {
      screen.getByLabelText('Baseline model').click();
    });
    await vi.waitFor(() => {
      expect(screen.getByText('GPT-4o ($20.00/M)')).toBeDefined();
    });
  });

  it('handles baseline change to a model', async () => {
    const { updateBaseline: mockUpdate } = await import('../../src/services/api/analytics.js');
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
    mockSavingsResult = OVERRIDE_SAVINGS;
    const { updateBaseline: mockUpdate } = await import('../../src/services/api/analytics.js');
    render(() => (
      <SavingsCard agentName="bot-1" range="30d" ping={0} onOpenExplainer={noop} onData={noopData} />
    ));
    await vi.waitFor(() => {
      screen.getByLabelText('Baseline model').click();
    });
    await vi.waitFor(() => {
      screen.getByText('Auto (per-request baseline)').click();
    });
    await vi.waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith('bot-1', null);
    });
  });

  it('shows toast on baseline update failure', async () => {
    const { updateBaseline: mockUpdate } = await import('../../src/services/api/analytics.js');
    const { toast: mockToast } = await import('../../src/services/toast-store.js');
    (mockUpdate as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('fail'));
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
});
