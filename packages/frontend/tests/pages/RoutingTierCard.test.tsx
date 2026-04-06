import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';

let mockCustomProviderLogo = vi.fn(() => null as any);

vi.mock('../../src/services/providers.js', () => ({
  PROVIDERS: [],
  STAGES: [{ id: 'premium', label: 'Premium', desc: 'Best models' }],
}));

vi.mock('../../src/services/provider-utils.js', () => ({
  getModelLabel: (m: string) => m,
}));

vi.mock('../../src/components/ProviderIcon.jsx', () => ({
  providerIcon: () => null,
  customProviderLogo: (...args: any[]) => mockCustomProviderLogo(...args),
}));

vi.mock('../../src/components/AuthBadge.js', () => ({
  authBadgeFor: () => null,
}));

vi.mock('../../src/services/routing-utils.js', () => ({
  pricePerM: () => '$0.00',
  resolveProviderId: () => null,
  inferProviderFromModel: () => null,
}));

vi.mock('../../src/services/formatters.js', () => ({
  customProviderColor: () => '#abc',
}));

vi.mock('../../src/components/FallbackList.js', () => ({
  default: () => <div data-testid="fallback-list" />,
}));

import RoutingTierCard from '../../src/pages/RoutingTierCard';

const stage = { id: 'premium', label: 'Premium', desc: 'Best models' };

const baseTier = {
  tier: 'premium',
  auto_assigned_model: 'claude-sonnet-4-20250514',
  override_model: 'gpt-4o',
  fallback_models: [],
  auto_assigned_provider_id: 'anthropic',
};

const baseProps = {
  stage,
  tier: () => baseTier as any,
  models: () => [] as any[],
  customProviders: () => [] as any[],
  activeProviders: () => [] as any[],
  tiersLoading: false,
  changingTier: () => null as string | null,
  resettingTier: () => null as string | null,
  resettingAll: () => false,
  addingFallback: () => null as string | null,
  agentName: () => 'test-agent',
  onDropdownOpen: vi.fn(),
  onOverride: vi.fn(),
  onReset: vi.fn(),
  onFallbackUpdate: vi.fn(),
  onAddFallback: vi.fn(),
  getFallbacksFor: () => [] as string[],
  connectedProviders: () => [] as any[],
};

describe('RoutingTierCard', () => {
  it('renders the tier label', () => {
    render(() => <RoutingTierCard {...baseProps} />);
    expect(screen.getByText('Premium')).toBeDefined();
  });

  it('shows reset confirm modal with dialog role on Reset click', async () => {
    const { container } = render(() => <RoutingTierCard {...baseProps} />);
    const resetBtn = screen.getByText('Reset');
    fireEvent.click(resetBtn);
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog!.getAttribute('aria-modal')).toBe('true');
    expect(dialog!.getAttribute('aria-labelledby')).toBe('reset-tier-modal-title');
    expect(container.querySelector('#reset-tier-modal-title')).not.toBeNull();
    expect(screen.getByText('Reset tier?')).toBeDefined();
  });

  it('renders custom provider letter fallback when logo returns null', () => {
    mockCustomProviderLogo.mockReturnValue(null);
    const customTier = {
      ...baseTier,
      override_model: 'llama-3.1',
      override_provider: 'custom:cp-1',
    };
    const { container } = render(() => (
      <RoutingTierCard
        {...baseProps}
        tier={() => customTier as any}
        customProviders={() => [{ id: 'cp-1', name: 'Groq', base_url: 'https://api.groq.com/v1' }] as any[]}
        models={() => [{ model_name: 'llama-3.1', provider: 'custom:cp-1' }] as any[]}
      />
    ));
    const letter = container.querySelector('.provider-card__logo-letter');
    expect(letter).not.toBeNull();
    expect(letter!.textContent).toBe('G');
  });

  it('renders custom provider logo when customProviderLogo returns an element', () => {
    mockCustomProviderLogo.mockReturnValue(<img data-testid="custom-logo" />);
    const customTier = {
      ...baseTier,
      override_model: 'llama-3.1',
      override_provider: 'custom:cp-1',
    };
    const { container } = render(() => (
      <RoutingTierCard
        {...baseProps}
        tier={() => customTier as any}
        customProviders={() => [{ id: 'cp-1', name: 'Groq', base_url: 'https://api.groq.com/v1' }] as any[]}
        models={() => [{ model_name: 'llama-3.1', provider: 'custom:cp-1' }] as any[]}
      />
    ));
    expect(container.querySelector('[data-testid="custom-logo"]')).not.toBeNull();
  });

  it('closes reset modal on Escape key', async () => {
    const { container } = render(() => <RoutingTierCard {...baseProps} />);
    fireEvent.click(screen.getByText('Reset'));
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    fireEvent.keyDown(container.querySelector('.modal-overlay')!, { key: 'Escape' });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('closes reset modal on overlay click', async () => {
    const { container } = render(() => <RoutingTierCard {...baseProps} />);
    fireEvent.click(screen.getByText('Reset'));
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    const overlay = container.querySelector('.modal-overlay')!;
    fireEvent.click(overlay);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('confirms reset and calls onReset', async () => {
    const onReset = vi.fn();
    const { container } = render(() => <RoutingTierCard {...baseProps} onReset={onReset} />);
    fireEvent.click(screen.getByText('Reset'));
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    const confirmBtn = container.querySelector('.btn--danger')!;
    fireEvent.click(confirmBtn);
    expect(onReset).toHaveBeenCalledWith('premium');
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });
});
