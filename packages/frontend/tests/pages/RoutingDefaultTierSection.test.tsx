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

  it('shows the "All requests" subtitle when complexity is off', () => {
    render(() => <RoutingDefaultTierSection {...makeProps({ complexityEnabled: () => false })} />);
    expect(screen.getByText('All requests route through this model')).toBeDefined();
  });

  it('shows the "Safety net" subtitle when complexity is on', () => {
    render(() =>
      <RoutingDefaultTierSection {...makeProps({ complexityEnabled: () => true })} />,
    );
    expect(
      screen.getByText('Acts as a safety net and handles requests that complexity routing can\u2019t resolve'),
    ).toBeDefined();
  });

  it('applies dimmed class when complexity is on', () => {
    const { container } = render(() =>
      <RoutingDefaultTierSection {...makeProps({ complexityEnabled: () => true })} />,
    );
    expect(container.querySelector('.routing-section--dimmed')).not.toBeNull();
  });

  it('does not apply dimmed class when complexity is off', () => {
    const { container } = render(() =>
      <RoutingDefaultTierSection {...makeProps({ complexityEnabled: () => false })} />,
    );
    expect(container.querySelector('.routing-section--dimmed')).toBeNull();
  });

  it('renders a single default tier card', () => {
    render(() => <RoutingDefaultTierSection {...makeProps()} />);
    expect(screen.getByTestId('tier-card-default')).toBeDefined();
  });

  it('skips subtitle while tiers are loading', () => {
    render(() => <RoutingDefaultTierSection {...makeProps({ tiersLoading: true })} />);
    expect(screen.queryByText('All requests route through this model')).toBeNull();
    expect(
      screen.queryByText('Acts as a safety net and handles requests that complexity routing can\u2019t resolve'),
    ).toBeNull();
  });

  it('forwards every handler prop to the inner tier card', () => {
    const onDropdownOpen = vi.fn();
    const onOverride = vi.fn();
    const onReset = vi.fn();
    const onFallbackUpdate = vi.fn();
    const onAddFallback = vi.fn();

    render(() => (
      <RoutingDefaultTierSection
        {...makeProps({ onDropdownOpen, onOverride, onReset, onFallbackUpdate, onAddFallback })}
      />
    ));

    (screen.getByTestId('dropdown-default') as HTMLButtonElement).click();
    (screen.getByTestId('override-default') as HTMLButtonElement).click();
    (screen.getByTestId('reset-default') as HTMLButtonElement).click();
    (screen.getByTestId('fallback-update-default') as HTMLButtonElement).click();
    (screen.getByTestId('add-fallback-default') as HTMLButtonElement).click();

    expect(onDropdownOpen).toHaveBeenCalledWith('default');
    expect(onOverride).toHaveBeenCalledWith('default', 'm', 'p');
    expect(onReset).toHaveBeenCalledWith('default');
    expect(onFallbackUpdate).toHaveBeenCalledWith('default', ['m1']);
    expect(onAddFallback).toHaveBeenCalledWith('default');
  });

  it('passes accessor-sourced props so every JSX binding is exercised', () => {
    const props = makeProps({
      tier: () => ({
        id: 't1',
        agent_id: 'a1',
        tier: 'default',
        override_model: 'gpt-4o',
        override_provider: 'openai',
        override_auth_type: null,
        auto_assigned_model: null,
        fallback_models: ['claude-sonnet'],
        updated_at: '2025-01-01',
      }),
      models: () => [{ model_name: 'gpt-4o' } as any],
      customProviders: () => [{ id: 'cp1' } as any],
      activeProviders: () => [{ id: 'ap1' } as any],
      connectedProviders: () => [{ id: 'cp2' } as any, { id: 'cp3' } as any],
      changingTier: () => 'default',
      resettingTier: () => 'default',
      resettingAll: () => true,
      addingFallback: () => 'default',
      getFallbacksFor: () => ['claude-sonnet'],
    });
    render(() => <RoutingDefaultTierSection {...props} />);
    const card = screen.getByTestId('tier-card-default');
    expect(card.getAttribute('data-models-count')).toBe('1');
    expect(card.getAttribute('data-custom-providers-count')).toBe('1');
    expect(card.getAttribute('data-active-providers-count')).toBe('1');
    expect(card.getAttribute('data-connected-providers-count')).toBe('2');
    expect(card.getAttribute('data-changing-tier')).toBe('default');
    expect(card.getAttribute('data-resetting-tier')).toBe('default');
    expect(card.getAttribute('data-resetting-all')).toBe('true');
    expect(card.getAttribute('data-adding-fallback')).toBe('default');
    expect(card.getAttribute('data-agent-name')).toBe('test-agent');
    const fallbacks = JSON.parse(card.getAttribute('data-fallbacks')!);
    expect(fallbacks).toEqual(['claude-sonnet']);
  });
});
