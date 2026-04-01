import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';

vi.mock('../../src/services/providers.js', () => ({
  PROVIDERS: [],
  STAGES: [{ id: 'premium', label: 'Premium', desc: 'Best models' }],
}));

vi.mock('../../src/services/provider-utils.js', () => ({
  getModelLabel: (m: string) => m,
}));

vi.mock('../../src/components/ProviderIcon.jsx', () => ({
  providerIcon: () => null,
}));

vi.mock('../../src/components/AuthBadge.js', () => ({
  authBadgeFor: () => null,
}));

vi.mock('../../src/services/routing-utils.js', () => ({
  pricePerM: () => '$0.00',
  resolveProviderId: () => null,
  inferProviderFromModel: () => null,
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
});
