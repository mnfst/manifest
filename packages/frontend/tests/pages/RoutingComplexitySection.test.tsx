import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';

vi.mock('../../src/services/providers.js', () => ({
  STAGES: [
    { id: 'simple', step: 1, label: 'Simple', desc: 'Simple tasks.' },
    { id: 'standard', step: 2, label: 'Standard', desc: 'Standard tasks.' },
    { id: 'complex', step: 3, label: 'Complex', desc: 'Complex tasks.' },
    { id: 'reasoning', step: 4, label: 'Reasoning', desc: 'Reasoning tasks.' },
  ],
}));

const mockToggleComplexity = vi.fn();
vi.mock('../../src/services/api.js', () => ({
  toggleComplexity: (...args: unknown[]) => mockToggleComplexity(...args),
}));

vi.mock('../../src/services/toast-store.js', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
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
import { toast } from '../../src/services/toast-store.js';

function makeProps(
  overrides: Partial<RoutingComplexitySectionProps> = {},
): RoutingComplexitySectionProps {
  return {
    agentName: () => 'test-agent',
    enabled: () => false,
    onEnabledChange: vi.fn(),
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
    mockToggleComplexity.mockResolvedValue({ ok: true, enabled: true });
  });

  it('renders the section title + subtitle', () => {
    render(() => <RoutingComplexitySection {...makeProps()} />);
    expect(screen.getByText('Complexity routing')).toBeDefined();
    expect(
      screen.getByText('Picks a cheap model for easy requests and your best for the rest.'),
    ).toBeDefined();
  });

  it('renders the empty explainer panel when disabled', () => {
    render(() => <RoutingComplexitySection {...makeProps()} />);
    expect(screen.getByText('Complexity routing is off')).toBeDefined();
    expect(screen.getAllByText('Enable complexity routing').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByTestId('tier-card-simple')).toBeNull();
  });

  it('renders 4 tier cards when enabled', () => {
    render(() => <RoutingComplexitySection {...makeProps({ enabled: () => true })} />);
    expect(screen.getByTestId('tier-card-simple')).toBeDefined();
    expect(screen.getByTestId('tier-card-standard')).toBeDefined();
    expect(screen.getByTestId('tier-card-complex')).toBeDefined();
    expect(screen.getByTestId('tier-card-reasoning')).toBeDefined();
    expect(screen.queryByText('Complexity routing is off')).toBeNull();
  });

  it('forwards each tier-card handler to the parent', () => {
    const onDropdownOpen = vi.fn();
    const onOverride = vi.fn();
    const onReset = vi.fn();
    const onFallbackUpdate = vi.fn();
    const onAddFallback = vi.fn();
    render(() => (
      <RoutingComplexitySection
        {...makeProps({
          enabled: () => true,
          onDropdownOpen,
          onOverride,
          onReset,
          onFallbackUpdate,
          onAddFallback,
        })}
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

  it('clicking the CTA turns complexity on', async () => {
    const onEnabledChange = vi.fn();
    render(() => <RoutingComplexitySection {...makeProps({ onEnabledChange })} />);
    fireEvent.click(screen.getAllByText('Enable complexity routing')[0]);
    await waitFor(() => {
      expect(mockToggleComplexity).toHaveBeenCalledWith('test-agent', true);
      expect(onEnabledChange).toHaveBeenCalledWith(true);
      expect(toast.success).toHaveBeenCalledWith('Complexity routing on');
    });
  });

  it('shows an error toast when the toggle API fails', async () => {
    mockToggleComplexity.mockRejectedValueOnce(new Error('boom'));
    render(() => <RoutingComplexitySection {...makeProps()} />);
    fireEvent.click(screen.getAllByText('Enable complexity routing')[0]);
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to update complexity routing');
    });
  });

  it('clicking the switch from on→off with no overrides applies immediately', async () => {
    const onEnabledChange = vi.fn();
    mockToggleComplexity.mockResolvedValue({ ok: true, enabled: false });
    render(() =>
      <RoutingComplexitySection {...makeProps({ enabled: () => true, onEnabledChange })} />,
    );
    fireEvent.click(screen.getByText('Disable complexity routing'));
    await waitFor(() => {
      expect(mockToggleComplexity).toHaveBeenCalledWith('test-agent', false);
      expect(onEnabledChange).toHaveBeenCalledWith(false);
      expect(toast.success).toHaveBeenCalledWith('Complexity routing off');
    });
  });

  it('shows a confirmation dialog when turning off with existing overrides', async () => {
    const onEnabledChange = vi.fn();
    const props = makeProps({
      enabled: () => true,
      onEnabledChange,
      tiers: () => [
        {
          id: '1',
          agent_id: 'a',
          tier: 'simple',
          override_model: 'gpt-4o',
          override_provider: 'openai',
          override_auth_type: null,
          auto_assigned_model: null,
          fallback_models: null,
          updated_at: '2025-01-01',
        },
      ],
    });
    render(() => <RoutingComplexitySection {...props} />);
    fireEvent.click(screen.getByText('Disable complexity routing'));

    await waitFor(() => {
      expect(screen.getByText('Disable complexity routing?')).toBeDefined();
    });
    expect(mockToggleComplexity).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('Disable'));
    await waitFor(() => {
      expect(mockToggleComplexity).toHaveBeenCalledWith('test-agent', false);
      expect(onEnabledChange).toHaveBeenCalledWith(false);
    });
  });

  it('closes the confirm dialog on Escape', async () => {
    const props = makeProps({
      enabled: () => true,
      tiers: () => [
        {
          id: '1',
          agent_id: 'a',
          tier: 'simple',
          override_model: 'gpt-4o',
          override_provider: 'openai',
          override_auth_type: null,
          auto_assigned_model: null,
          fallback_models: null,
          updated_at: '2025-01-01',
        },
      ],
    });
    render(() => <RoutingComplexitySection {...props} />);
    fireEvent.click(screen.getByText('Disable complexity routing'));
    await waitFor(() => {
      expect(screen.getByText('Disable complexity routing?')).toBeDefined();
    });

    const overlay = screen.getByRole('dialog').parentElement!;
    fireEvent.keyDown(overlay, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByText('Disable complexity routing?')).toBeNull();
    });
  });

  it('closes the confirm dialog on overlay click', async () => {
    const props = makeProps({
      enabled: () => true,
      tiers: () => [
        {
          id: '1',
          agent_id: 'a',
          tier: 'simple',
          override_model: 'gpt-4o',
          override_provider: 'openai',
          override_auth_type: null,
          auto_assigned_model: null,
          fallback_models: null,
          updated_at: '2025-01-01',
        },
      ],
    });
    render(() => <RoutingComplexitySection {...props} />);
    fireEvent.click(screen.getByText('Disable complexity routing'));
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeDefined();
    });
    const overlay = screen.getByRole('dialog').parentElement!;
    fireEvent.click(overlay);
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('cancelling the confirm dialog leaves the flag unchanged', async () => {
    const onEnabledChange = vi.fn();
    const props = makeProps({
      enabled: () => true,
      onEnabledChange,
      tiers: () => [
        {
          id: '1',
          agent_id: 'a',
          tier: 'simple',
          override_model: null,
          override_provider: null,
          override_auth_type: null,
          auto_assigned_model: null,
          fallback_models: ['gpt-4o'],
          updated_at: '2025-01-01',
        },
      ],
    });
    render(() => <RoutingComplexitySection {...props} />);
    fireEvent.click(screen.getByText('Disable complexity routing'));
    await waitFor(() => {
      expect(screen.getByText('Disable complexity routing?')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Cancel'));
    await waitFor(() => {
      expect(screen.queryByText('Disable complexity routing?')).toBeNull();
    });
    expect(mockToggleComplexity).not.toHaveBeenCalled();
    expect(onEnabledChange).not.toHaveBeenCalled();
  });
});
