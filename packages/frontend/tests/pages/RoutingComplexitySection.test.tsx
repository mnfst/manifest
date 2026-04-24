import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@solidjs/testing-library';

vi.mock('../../src/services/providers.js', () => ({
  STAGES: [
    { id: 'simple', step: 1, label: 'Simple', desc: 'Simple tasks.' },
    { id: 'standard', step: 2, label: 'Standard', desc: 'Standard tasks.' },
    { id: 'complex', step: 3, label: 'Complex', desc: 'Complex tasks.' },
    { id: 'reasoning', step: 4, label: 'Reasoning', desc: 'Reasoning tasks.' },
  ],
}));

vi.mock('../../src/pages/RoutingTierCard.js', () => ({
  default: (props: any) => {
    // Touch every accessor so each JSX prop binding is instrumented as executed.
    const tier = props.tier?.();
    const fallbacks = props.getFallbacksFor?.(props.stage?.id ?? '');
    return (
      <div
        data-testid={`tier-card-${props.stage?.id ?? 'unknown'}`}
        data-tier={JSON.stringify(tier ?? null)}
        data-fallbacks={JSON.stringify(fallbacks ?? [])}
        data-models-count={props.models?.()?.length ?? 0}
        data-custom-providers-count={props.customProviders?.()?.length ?? 0}
        data-active-providers-count={props.activeProviders?.()?.length ?? 0}
        data-connected-providers-count={props.connectedProviders?.()?.length ?? 0}
        data-tiers-loading={String(props.tiersLoading ?? false)}
        data-changing-tier={props.changingTier?.() ?? ''}
        data-resetting-tier={props.resettingTier?.() ?? ''}
        data-resetting-all={String(props.resettingAll?.() ?? false)}
        data-adding-fallback={props.addingFallback?.() ?? ''}
        data-agent-name={props.agentName?.() ?? ''}
      >
        {props.stage?.label ?? 'Unknown'}
        <button
          data-testid={`dropdown-${props.stage?.id}`}
          onClick={() => props.onDropdownOpen?.(props.stage?.id)}
        >
          dropdown
        </button>
        <button
          data-testid={`override-${props.stage?.id}`}
          onClick={() => props.onOverride?.(props.stage?.id, 'm', 'p')}
        >
          override
        </button>
        <button
          data-testid={`reset-${props.stage?.id}`}
          onClick={() => props.onReset?.(props.stage?.id)}
        >
          reset
        </button>
        <button
          data-testid={`fallback-update-${props.stage?.id}`}
          onClick={() => props.onFallbackUpdate?.(props.stage?.id, ['m1'])}
        >
          fallback-update
        </button>
        <button
          data-testid={`add-fallback-${props.stage?.id}`}
          onClick={() => props.onAddFallback?.(props.stage?.id)}
        >
          add-fallback
        </button>
      </div>
    );
  },
}));

import RoutingComplexitySection from '../../src/pages/RoutingComplexitySection';
import type { RoutingComplexitySectionProps } from '../../src/pages/RoutingComplexitySection';

function makeProps(
  overrides: Partial<RoutingComplexitySectionProps> = {},
): RoutingComplexitySectionProps {
  return {
    agentName: () => 'test-agent',
    tiers: () => [],
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
    getTier: () => undefined,
    ...overrides,
  };
}

describe('RoutingComplexitySection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the section title + subtitle in standalone mode', () => {
    render(() => <RoutingComplexitySection {...makeProps()} />);
    expect(screen.getByText('Complexity routing')).toBeDefined();
    expect(
      screen.getByText(
        'Analyzes the complexity of each request on the fly and routes it to the matching tier.',
      ),
    ).toBeDefined();
  });

  it('renders the subtitle but no title in embedded mode', () => {
    render(() => <RoutingComplexitySection {...makeProps({ embedded: true })} />);
    expect(screen.queryByText('Complexity routing')).toBeNull();
    expect(
      screen.getByText(
        'Analyzes the complexity of each request on the fly and routes it to the matching tier.',
      ),
    ).toBeDefined();
  });

  it('always renders the four tier cards (complexity routing is always on)', () => {
    render(() => <RoutingComplexitySection {...makeProps()} />);
    expect(screen.getByTestId('tier-card-simple')).toBeDefined();
    expect(screen.getByTestId('tier-card-standard')).toBeDefined();
    expect(screen.getByTestId('tier-card-complex')).toBeDefined();
    expect(screen.getByTestId('tier-card-reasoning')).toBeDefined();
  });

  it('does not render any enable/disable toggle', () => {
    render(() => <RoutingComplexitySection {...makeProps()} />);
    expect(screen.queryByText(/enable complexity routing/i)).toBeNull();
    expect(screen.queryByText(/disable complexity routing/i)).toBeNull();
    expect(screen.queryByText(/complexity routing is off/i)).toBeNull();
  });

  it('forwards each tier-card handler to the parent', () => {
    const onDropdownOpen = vi.fn();
    const onOverride = vi.fn();
    const onReset = vi.fn();
    const onFallbackUpdate = vi.fn();
    const onAddFallback = vi.fn();
    render(() => (
      <RoutingComplexitySection
        {...makeProps({ onDropdownOpen, onOverride, onReset, onFallbackUpdate, onAddFallback })}
      />
    ));
    (screen.getByTestId('dropdown-simple') as HTMLButtonElement).click();
    (screen.getByTestId('override-simple') as HTMLButtonElement).click();
    (screen.getByTestId('reset-simple') as HTMLButtonElement).click();
    (screen.getByTestId('fallback-update-simple') as HTMLButtonElement).click();
    (screen.getByTestId('add-fallback-simple') as HTMLButtonElement).click();
    expect(onDropdownOpen).toHaveBeenCalledWith('simple');
    expect(onOverride).toHaveBeenCalledWith('simple', 'm', 'p');
    expect(onReset).toHaveBeenCalledWith('simple');
    expect(onFallbackUpdate).toHaveBeenCalledWith('simple', ['m1']);
    expect(onAddFallback).toHaveBeenCalledWith('simple');
  });
});
