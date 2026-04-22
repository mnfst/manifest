import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@solidjs/testing-library';

vi.mock('../../src/services/providers.js', () => ({
  DEFAULT_STAGE: {
    id: 'default',
    step: 0,
    label: 'Default model',
    desc: 'Handles every request.',
  },
}));

vi.mock('../../src/pages/RoutingTierCard.js', () => ({
  default: (props: any) => (
    <div data-testid={`tier-card-${props.stage.id}`} data-loading={String(props.tiersLoading)}>
      {props.stage.label}
    </div>
  ),
}));

import RoutingDefaultTierSection from '../../src/pages/RoutingDefaultTierSection';
import type { RoutingDefaultTierSectionProps } from '../../src/pages/RoutingDefaultTierSection';

function makeProps(
  overrides: Partial<RoutingDefaultTierSectionProps> = {},
): RoutingDefaultTierSectionProps {
  return {
    agentName: () => 'test-agent',
    tier: () => undefined,
    complexityEnabled: () => false,
    models: () => [],
    customProviders: () => [],
    activeProviders: () => [],
    connectedProviders: () => [],
    tiersLoading: false,
    changingTier: () => null,
    resettingTier: () => null,
    resettingAll: () => false,
    addingFallback: () => null,
    onDropdownOpen: vi.fn(),
    onOverride: vi.fn(),
    onReset: vi.fn(),
    onFallbackUpdate: vi.fn(),
    onAddFallback: vi.fn(),
    getFallbacksFor: () => [],
    ...overrides,
  };
}

describe('RoutingDefaultTierSection', () => {
  it('renders the Default model title in the section header', () => {
    render(() => <RoutingDefaultTierSection {...makeProps()} />);
    const matches = screen.getAllByText('Default model');
    // One in the section header, one in the reused tier-card mock stub
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(matches.some((el) => el.classList.contains('routing-section__title'))).toBe(true);
  });

  it('shows the "Handles every request" subtitle when complexity is off', () => {
    render(() => <RoutingDefaultTierSection {...makeProps({ complexityEnabled: () => false })} />);
    expect(screen.getByText('Handles every request.')).toBeDefined();
  });

  it('shows the "Final fallback" subtitle when complexity is on', () => {
    render(() =>
      <RoutingDefaultTierSection {...makeProps({ complexityEnabled: () => true })} />,
    );
    expect(
      screen.getByText('Final fallback after complexity and task-specific rules.'),
    ).toBeDefined();
  });

  it('renders a single default tier card', () => {
    render(() => <RoutingDefaultTierSection {...makeProps()} />);
    expect(screen.getByTestId('tier-card-default')).toBeDefined();
  });

  it('skips subtitle while tiers are loading', () => {
    render(() => <RoutingDefaultTierSection {...makeProps({ tiersLoading: true })} />);
    expect(screen.queryByText('Handles every request.')).toBeNull();
    expect(screen.queryByText('Final fallback after complexity and task-specific rules.')).toBeNull();
  });
});
