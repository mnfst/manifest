import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';

/* ---- mock SPECIFICITY_STAGES ---- */
const MOCK_STAGES = [
  { id: 'coding', step: 1, label: 'Coding', desc: 'Write, debug, and refactor code.' },
  { id: 'web_browsing', step: 2, label: 'Web Browsing', desc: 'Navigate pages, search, and extract content.' },
  { id: 'data_analysis', step: 3, label: 'Data Analysis', desc: 'Crunch numbers, run stats, build charts.' },
];

vi.mock('../../src/services/providers.js', () => ({
  SPECIFICITY_STAGES: [
    { id: 'coding', step: 1, label: 'Coding', desc: 'Write, debug, and refactor code.' },
    { id: 'web_browsing', step: 2, label: 'Web Browsing', desc: 'Navigate pages, search, and extract content.' },
    { id: 'data_analysis', step: 3, label: 'Data Analysis', desc: 'Crunch numbers, run stats, build charts.' },
  ],
  STAGES: [],
}));

vi.mock('../../src/services/toast-store.js', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

const mockToggleSpecificity = vi.fn();
const mockSetSpecificityFallbacks = vi.fn();
const mockClearSpecificityFallbacks = vi.fn();

vi.mock('../../src/services/api.js', () => ({
  toggleSpecificity: (...args: unknown[]) => mockToggleSpecificity(...args),
  setSpecificityFallbacks: (...args: unknown[]) => mockSetSpecificityFallbacks(...args),
  clearSpecificityFallbacks: (...args: unknown[]) => mockClearSpecificityFallbacks(...args),
}));

vi.mock('../../src/pages/RoutingTierCard.js', () => ({
  default: (props: any) => {
    // Exercise accessors and callbacks to cover the lambda wrappers
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
        data-tiers-loading={String(props.tiersLoading ?? false)}
        data-changing-tier={props.changingTier?.() ?? ''}
        data-resetting-tier={props.resettingTier?.() ?? ''}
        data-resetting-all={String(props.resettingAll?.() ?? false)}
        data-adding-fallback={props.addingFallback?.() ?? ''}
        data-agent-name={props.agentName?.() ?? ''}
        data-connected-providers-count={props.connectedProviders?.()?.length ?? 0}
      >
        {props.stage?.label ?? 'Unknown'}
        <button
          data-testid={`persist-fallbacks-${props.stage?.id}`}
          onClick={() => props.persistFallbacks?.('test-agent', props.stage?.id, ['m1'])}
        >persist</button>
        <button
          data-testid={`clear-fallbacks-${props.stage?.id}`}
          onClick={() => props.persistClearFallbacks?.('test-agent', props.stage?.id)}
        >clear</button>
        <button
          data-testid={`dropdown-${props.stage?.id}`}
          onClick={() => props.onDropdownOpen?.(props.stage?.id)}
        >dropdown</button>
        <button
          data-testid={`override-${props.stage?.id}`}
          onClick={() => props.onOverride?.(props.stage?.id, 'model', 'provider')}
        >override</button>
        <button
          data-testid={`reset-${props.stage?.id}`}
          onClick={() => props.onReset?.(props.stage?.id)}
        >reset</button>
        <button
          data-testid={`fallback-update-${props.stage?.id}`}
          onClick={() => props.onFallbackUpdate?.(props.stage?.id, ['m1'])}
        >fallback-update</button>
        <button
          data-testid={`add-fallback-${props.stage?.id}`}
          onClick={() => props.onAddFallback?.(props.stage?.id)}
        >add-fallback</button>
      </div>
    );
  },
}));

vi.mock('../../src/styles/routing-specificity.css', () => ({}));

vi.mock('../../src/components/ProviderIcon.js', () => ({
  providerIcon: () => null,
  customProviderLogo: () => null,
}));

import RoutingSpecificitySection from '../../src/pages/RoutingSpecificitySection';
import type { RoutingSpecificitySectionProps } from '../../src/pages/RoutingSpecificitySection';
import { toast } from '../../src/services/toast-store.js';

function makeProps(overrides: Partial<RoutingSpecificitySectionProps> = {}): RoutingSpecificitySectionProps {
  return {
    agentName: () => 'test-agent',
    assignments: () => undefined,
    models: () => [],
    customProviders: () => [],
    activeProviders: () => [],
    connectedProviders: () => [],
    changingTier: () => null,
    resettingTier: () => null,
    resettingAll: () => false,
    addingFallback: () => null,
    onDropdownOpen: vi.fn(),
    onOverride: vi.fn(),
    onReset: vi.fn(),
    onFallbackUpdate: vi.fn(),
    onAddFallback: vi.fn(),
    refetchAll: vi.fn().mockResolvedValue(undefined),
    refetchSpecificity: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('RoutingSpecificitySection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockToggleSpecificity.mockResolvedValue({});
  });

  /* ---- Static rendering ---- */

  it('renders "Task-specific routing" title and subtitle', () => {
    render(() => <RoutingSpecificitySection {...makeProps()} />);
    expect(screen.getByText('Task-specific routing')).toBeDefined();
    expect(
      screen.getByText(
        'Send specific kinds of work (coding, trading, image gen…) to dedicated models. Overrides everything else.',
      ),
    ).toBeDefined();
  });

  it('shows "Enable specificity tiers" button when no tiers are active', () => {
    render(() => <RoutingSpecificitySection {...makeProps()} />);
    const buttons = screen.getAllByText('Enable task-specific routing');
    // One in the header, one in the empty state
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });

  it('shows "Manage specificity tiers" button when at least one tier is active', () => {
    const props = makeProps({
      assignments: () => [
        {
          id: '1',
          agent_id: 'a1',
          category: 'coding',
          is_active: true,
          override_model: null,
          override_provider: null,
          override_auth_type: null,
          auto_assigned_model: null,
          fallback_models: null,
          updated_at: '2025-01-01',
        },
      ],
    });
    render(() => <RoutingSpecificitySection {...props} />);
    expect(screen.getByText('Manage task-specific routing')).toBeDefined();
  });

  it('shows empty state with "No task-specific rules yet" when nothing active', () => {
    render(() => <RoutingSpecificitySection {...makeProps()} />);
    expect(screen.getByText('No task-specific rules yet')).toBeDefined();
    expect(screen.getByText('Route specialized tasks to dedicated models.')).toBeDefined();
  });

  it('renders RoutingTierCard for each active tier', () => {
    const props = makeProps({
      assignments: () => [
        {
          id: '1',
          agent_id: 'a1',
          category: 'coding',
          is_active: true,
          override_model: null,
          override_provider: null,
          override_auth_type: null,
          auto_assigned_model: null,
          fallback_models: null,
          updated_at: '2025-01-01',
        },
        {
          id: '2',
          agent_id: 'a1',
          category: 'web_browsing',
          is_active: true,
          override_model: null,
          override_provider: null,
          override_auth_type: null,
          auto_assigned_model: null,
          fallback_models: null,
          updated_at: '2025-01-01',
        },
      ],
    });
    render(() => <RoutingSpecificitySection {...props} />);
    expect(screen.getByTestId('tier-card-coding')).toBeDefined();
    expect(screen.getByTestId('tier-card-web_browsing')).toBeDefined();
    expect(screen.queryByTestId('tier-card-data_analysis')).toBeNull();
  });

  /* ---- Modal open/close ---- */

  it('opens modal on header button click and shows all SPECIFICITY_STAGES with toggles', async () => {
    render(() => <RoutingSpecificitySection {...makeProps()} />);
    // Click the header "Enable specific tiers" button (first one found)
    const headerBtn = screen.getAllByText('Enable task-specific routing')[0];
    fireEvent.click(headerBtn);
    await waitFor(() => {
      expect(screen.getByText('Manage task-specific routing')).toBeDefined();
    });
    // All stages should appear
    for (const stage of MOCK_STAGES) {
      expect(screen.getByText(stage.label)).toBeDefined();
      expect(screen.getByText(stage.desc)).toBeDefined();
    }
    // Toggle buttons for each stage
    for (const stage of MOCK_STAGES) {
      expect(screen.getByLabelText(`Enable ${stage.label}`)).toBeDefined();
    }
  });

  it('opens modal on empty-state button click', async () => {
    render(() => <RoutingSpecificitySection {...makeProps()} />);
    // The empty-state also has an "Enable specific tiers" button
    const buttons = screen.getAllByText('Enable task-specific routing');
    fireEvent.click(buttons[buttons.length - 1]);
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeDefined();
    });
  });

  it('closes modal on "Done" button click', async () => {
    render(() => <RoutingSpecificitySection {...makeProps()} />);
    fireEvent.click(screen.getAllByText('Enable task-specific routing')[0]);
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeDefined();
    });
    fireEvent.click(screen.getByText('Done'));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('closes modal on Escape key', async () => {
    render(() => <RoutingSpecificitySection {...makeProps()} />);
    fireEvent.click(screen.getAllByText('Enable task-specific routing')[0]);
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeDefined();
    });
    const overlay = screen.getByRole('dialog').parentElement!;
    fireEvent.keyDown(overlay, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('closes modal on overlay click (e.target === e.currentTarget)', async () => {
    render(() => <RoutingSpecificitySection {...makeProps()} />);
    fireEvent.click(screen.getAllByText('Enable task-specific routing')[0]);
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeDefined();
    });
    // Click the overlay itself (parent of the dialog)
    const overlay = screen.getByRole('dialog').parentElement!;
    fireEvent.click(overlay);
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('does NOT close modal when clicking inside the dialog card', async () => {
    render(() => <RoutingSpecificitySection {...makeProps()} />);
    fireEvent.click(screen.getAllByText('Enable task-specific routing')[0]);
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeDefined();
    });
    // Click the dialog card itself (stopPropagation)
    fireEvent.click(screen.getByRole('dialog'));
    // Dialog should still be open
    expect(screen.getByRole('dialog')).toBeDefined();
  });

  /* ---- Toggle interactions ---- */

  it('toggle calls toggleSpecificity API and shows success toast', async () => {
    const refetchSpecificity = vi.fn().mockResolvedValue(undefined);
    const props = makeProps({ refetchSpecificity });
    render(() => <RoutingSpecificitySection {...props} />);

    // Open modal
    fireEvent.click(screen.getAllByText('Enable task-specific routing')[0]);
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeDefined();
    });

    // Toggle "Coding" on
    const codingToggle = screen.getByLabelText('Enable Coding');
    fireEvent.click(codingToggle);

    await waitFor(() => {
      expect(mockToggleSpecificity).toHaveBeenCalledWith('test-agent', 'coding', true);
    });
    await waitFor(() => {
      expect(refetchSpecificity).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith('Enabled Coding routing');
    });
  });

  it('toggle disable calls toggleSpecificity with active=false and shows disable toast', async () => {
    const props = makeProps({
      assignments: () => [
        {
          id: '1',
          agent_id: 'a1',
          category: 'coding',
          is_active: true,
          override_model: null,
          override_provider: null,
          override_auth_type: null,
          auto_assigned_model: null,
          fallback_models: null,
          updated_at: '2025-01-01',
        },
      ],
      refetchSpecificity: vi.fn().mockResolvedValue(undefined),
    });
    render(() => <RoutingSpecificitySection {...props} />);

    // Open modal
    fireEvent.click(screen.getByText('Manage task-specific routing'));
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeDefined();
    });

    // Toggle "Coding" off (it's currently active)
    const codingToggle = screen.getByLabelText('Disable Coding');
    fireEvent.click(codingToggle);

    await waitFor(() => {
      expect(mockToggleSpecificity).toHaveBeenCalledWith('test-agent', 'coding', false);
    });
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Disabled Coding routing');
    });
  });

  it('shows error toast when toggle fails', async () => {
    mockToggleSpecificity.mockRejectedValueOnce(new Error('Network error'));
    const props = makeProps();
    render(() => <RoutingSpecificitySection {...props} />);

    fireEvent.click(screen.getAllByText('Enable task-specific routing')[0]);
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeDefined();
    });

    fireEvent.click(screen.getByLabelText('Enable Coding'));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to update task-specific routing');
    });
  });

  it('modal stays open after toggle (showModal persists)', async () => {
    const props = makeProps({
      refetchSpecificity: vi.fn().mockResolvedValue(undefined),
    });
    render(() => <RoutingSpecificitySection {...props} />);

    fireEvent.click(screen.getAllByText('Enable task-specific routing')[0]);
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeDefined();
    });

    fireEvent.click(screen.getByLabelText('Enable Coding'));

    await waitFor(() => {
      expect(mockToggleSpecificity).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalled();
    });

    // Modal should still be open
    expect(screen.getByRole('dialog')).toBeDefined();
  });

  it('uses refetchSpecificity when modal is open, refetchAll otherwise', async () => {
    const refetchAll = vi.fn().mockResolvedValue(undefined);
    const refetchSpecificity = vi.fn().mockResolvedValue(undefined);
    const [assignments, setAssignments] = createSignal<any[]>([]);

    const props = makeProps({
      assignments,
      refetchAll,
      refetchSpecificity,
    });
    render(() => <RoutingSpecificitySection {...props} />);

    // Open modal and toggle -- should use refetchSpecificity
    fireEvent.click(screen.getAllByText('Enable task-specific routing')[0]);
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeDefined();
    });

    fireEvent.click(screen.getByLabelText('Enable Coding'));
    await waitFor(() => {
      expect(refetchSpecificity).toHaveBeenCalled();
      expect(refetchAll).not.toHaveBeenCalled();
    });
  });

  it('uses refetchAll when refetchSpecificity is not provided', async () => {
    const refetchAll = vi.fn().mockResolvedValue(undefined);
    const props = makeProps({
      refetchAll,
      refetchSpecificity: undefined,
    });
    render(() => <RoutingSpecificitySection {...props} />);

    // Open modal and toggle -- should fallback to refetchAll
    fireEvent.click(screen.getAllByText('Enable task-specific routing')[0]);
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeDefined();
    });

    fireEvent.click(screen.getByLabelText('Enable Coding'));
    await waitFor(() => {
      expect(refetchAll).toHaveBeenCalled();
    });
  });

  it('toggle button is disabled while loading and shows spinner', async () => {
    // Make toggle hang so we can observe loading state
    let resolveToggle!: () => void;
    mockToggleSpecificity.mockImplementation(
      () => new Promise<void>((r) => { resolveToggle = r; }),
    );
    const props = makeProps({
      refetchSpecificity: vi.fn().mockResolvedValue(undefined),
    });
    render(() => <RoutingSpecificitySection {...props} />);

    fireEvent.click(screen.getAllByText('Enable task-specific routing')[0]);
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeDefined();
    });

    const codingToggle = screen.getByLabelText('Enable Coding');
    fireEvent.click(codingToggle);

    // The button should be disabled while loading
    await waitFor(() => {
      expect(codingToggle.hasAttribute('disabled')).toBe(true);
    });

    // Spinner should be visible
    const spinner = document.querySelector('.spinner');
    expect(spinner).not.toBeNull();

    // Resolve the promise
    resolveToggle();
    await waitFor(() => {
      expect(codingToggle.hasAttribute('disabled')).toBe(false);
    });
  });

  /* ---- toTierAssignment coverage ---- */

  it('passes tier assignment via toTierAssignment for active tiers with data', () => {
    const props = makeProps({
      assignments: () => [
        {
          id: '1',
          agent_id: 'a1',
          category: 'coding',
          is_active: true,
          override_model: 'gpt-4o',
          override_provider: 'openai',
          override_auth_type: null,
          auto_assigned_model: 'gpt-4o-mini',
          fallback_models: ['claude-sonnet-4'],
          updated_at: '2025-01-01',
        },
      ],
    });
    render(() => <RoutingSpecificitySection {...props} />);
    // The tier card should render for coding
    expect(screen.getByTestId('tier-card-coding')).toBeDefined();
  });

  it('handles undefined assignments gracefully', () => {
    const props = makeProps({ assignments: () => undefined });
    render(() => <RoutingSpecificitySection {...props} />);
    expect(screen.getByText('No task-specific rules yet')).toBeDefined();
  });

  it('handles empty assignments array', () => {
    const props = makeProps({ assignments: () => [] });
    render(() => <RoutingSpecificitySection {...props} />);
    expect(screen.getByText('No task-specific rules yet')).toBeDefined();
  });

  it('handles assignments with inactive tiers', () => {
    const props = makeProps({
      assignments: () => [
        {
          id: '1',
          agent_id: 'a1',
          category: 'coding',
          is_active: false,
          override_model: null,
          override_provider: null,
          override_auth_type: null,
          auto_assigned_model: null,
          fallback_models: null,
          updated_at: '2025-01-01',
        },
      ],
    });
    render(() => <RoutingSpecificitySection {...props} />);
    // No tier card should be rendered since coding is not active
    expect(screen.queryByTestId('tier-card-coding')).toBeNull();
    expect(screen.getByText('No task-specific rules yet')).toBeDefined();
    // Header button should say "Enable" not "Manage" since none are active
    expect(screen.getAllByText('Enable task-specific routing').length).toBeGreaterThanOrEqual(1);
  });

  /* ---- RoutingTierCard prop callbacks ---- */

  it('tier card receives toTierAssignment result with tier = category', () => {
    const props = makeProps({
      assignments: () => [
        {
          id: '1',
          agent_id: 'a1',
          category: 'coding',
          is_active: true,
          override_model: 'gpt-4o',
          override_provider: 'openai',
          override_auth_type: null,
          auto_assigned_model: 'gpt-4o-mini',
          fallback_models: ['claude-sonnet-4'],
          updated_at: '2025-01-01',
        },
      ],
    });
    render(() => <RoutingSpecificitySection {...props} />);
    const card = screen.getByTestId('tier-card-coding');
    const tierData = JSON.parse(card.getAttribute('data-tier')!);
    expect(tierData.tier).toBe('coding');
    expect(tierData.override_model).toBe('gpt-4o');
    expect(tierData.category).toBe('coding');
  });

  it('tier card getFallbacksFor returns fallback_models from assignment', () => {
    const props = makeProps({
      assignments: () => [
        {
          id: '1',
          agent_id: 'a1',
          category: 'coding',
          is_active: true,
          override_model: null,
          override_provider: null,
          override_auth_type: null,
          auto_assigned_model: null,
          fallback_models: ['model-a', 'model-b'],
          updated_at: '2025-01-01',
        },
      ],
    });
    render(() => <RoutingSpecificitySection {...props} />);
    const card = screen.getByTestId('tier-card-coding');
    const fallbacks = JSON.parse(card.getAttribute('data-fallbacks')!);
    expect(fallbacks).toEqual(['model-a', 'model-b']);
  });

  it('tier card getFallbacksFor returns empty array when no assignment found', () => {
    const props = makeProps({
      assignments: () => [
        {
          id: '1',
          agent_id: 'a1',
          category: 'coding',
          is_active: true,
          override_model: null,
          override_provider: null,
          override_auth_type: null,
          auto_assigned_model: null,
          fallback_models: null,
          updated_at: '2025-01-01',
        },
      ],
    });
    render(() => <RoutingSpecificitySection {...props} />);
    const card = screen.getByTestId('tier-card-coding');
    const fallbacks = JSON.parse(card.getAttribute('data-fallbacks')!);
    expect(fallbacks).toEqual([]);
  });

  it('persistFallbacks calls setSpecificityFallbacks', async () => {
    mockSetSpecificityFallbacks.mockResolvedValue([]);
    const props = makeProps({
      assignments: () => [
        {
          id: '1',
          agent_id: 'a1',
          category: 'coding',
          is_active: true,
          override_model: null,
          override_provider: null,
          override_auth_type: null,
          auto_assigned_model: null,
          fallback_models: null,
          updated_at: '2025-01-01',
        },
      ],
    });
    render(() => <RoutingSpecificitySection {...props} />);
    fireEvent.click(screen.getByTestId('persist-fallbacks-coding'));
    await waitFor(() => {
      expect(mockSetSpecificityFallbacks).toHaveBeenCalledWith('test-agent', 'coding', ['m1']);
    });
  });

  it('persistClearFallbacks calls clearSpecificityFallbacks', async () => {
    mockClearSpecificityFallbacks.mockResolvedValue(undefined);
    const props = makeProps({
      assignments: () => [
        {
          id: '1',
          agent_id: 'a1',
          category: 'coding',
          is_active: true,
          override_model: null,
          override_provider: null,
          override_auth_type: null,
          auto_assigned_model: null,
          fallback_models: null,
          updated_at: '2025-01-01',
        },
      ],
    });
    render(() => <RoutingSpecificitySection {...props} />);
    fireEvent.click(screen.getByTestId('clear-fallbacks-coding'));
    await waitFor(() => {
      expect(mockClearSpecificityFallbacks).toHaveBeenCalledWith('test-agent', 'coding');
    });
  });

  it('delegates onDropdownOpen, onOverride, onReset, onFallbackUpdate, onAddFallback to props', async () => {
    const onDropdownOpen = vi.fn();
    const onOverride = vi.fn();
    const onReset = vi.fn();
    const onFallbackUpdate = vi.fn();
    const onAddFallback = vi.fn();
    const props = makeProps({
      onDropdownOpen,
      onOverride,
      onReset,
      onFallbackUpdate,
      onAddFallback,
      assignments: () => [
        {
          id: '1',
          agent_id: 'a1',
          category: 'coding',
          is_active: true,
          override_model: null,
          override_provider: null,
          override_auth_type: null,
          auto_assigned_model: null,
          fallback_models: null,
          updated_at: '2025-01-01',
        },
      ],
    });
    render(() => <RoutingSpecificitySection {...props} />);
    fireEvent.click(screen.getByTestId('dropdown-coding'));
    fireEvent.click(screen.getByTestId('override-coding'));
    fireEvent.click(screen.getByTestId('reset-coding'));
    fireEvent.click(screen.getByTestId('fallback-update-coding'));
    fireEvent.click(screen.getByTestId('add-fallback-coding'));
    expect(onDropdownOpen).toHaveBeenCalledWith('coding');
    expect(onOverride).toHaveBeenCalledWith('coding', 'model', 'provider');
    expect(onReset).toHaveBeenCalledWith('coding');
    expect(onFallbackUpdate).toHaveBeenCalledWith('coding', ['m1']);
    expect(onAddFallback).toHaveBeenCalledWith('coding');
  });

  it('passes correct accessor values to tier card', () => {
    const props = makeProps({
      models: () => [{ model_name: 'gpt-4o' } as any],
      customProviders: () => [{ id: 'cp1' } as any],
      activeProviders: () => [{ id: 'ap1' } as any],
      connectedProviders: () => [{ id: 'cp2' } as any, { id: 'cp3' } as any],
      changingTier: () => 'coding',
      resettingTier: () => 'web_browsing',
      resettingAll: () => true,
      addingFallback: () => 'data_analysis',
      assignments: () => [
        {
          id: '1',
          agent_id: 'a1',
          category: 'coding',
          is_active: true,
          override_model: null,
          override_provider: null,
          override_auth_type: null,
          auto_assigned_model: null,
          fallback_models: null,
          updated_at: '2025-01-01',
        },
      ],
    });
    render(() => <RoutingSpecificitySection {...props} />);
    const card = screen.getByTestId('tier-card-coding');
    expect(card.getAttribute('data-models-count')).toBe('1');
    expect(card.getAttribute('data-custom-providers-count')).toBe('1');
    expect(card.getAttribute('data-active-providers-count')).toBe('1');
    expect(card.getAttribute('data-connected-providers-count')).toBe('2');
    expect(card.getAttribute('data-tiers-loading')).toBe('false');
    expect(card.getAttribute('data-changing-tier')).toBe('coding');
    expect(card.getAttribute('data-resetting-tier')).toBe('web_browsing');
    expect(card.getAttribute('data-resetting-all')).toBe('true');
    expect(card.getAttribute('data-adding-fallback')).toBe('data_analysis');
    expect(card.getAttribute('data-agent-name')).toBe('test-agent');
  });

  /* ---- toggle toggle-on class ---- */

  it('applies toggle--on class to active tier toggles in modal', async () => {
    const props = makeProps({
      assignments: () => [
        {
          id: '1',
          agent_id: 'a1',
          category: 'coding',
          is_active: true,
          override_model: null,
          override_provider: null,
          override_auth_type: null,
          auto_assigned_model: null,
          fallback_models: null,
          updated_at: '2025-01-01',
        },
      ],
    });
    render(() => <RoutingSpecificitySection {...props} />);

    fireEvent.click(screen.getByText('Manage task-specific routing'));
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeDefined();
    });

    const codingToggle = screen.getByLabelText('Disable Coding');
    expect(codingToggle.classList.contains('specificity-modal__toggle--on')).toBe(true);

    const browsingToggle = screen.getByLabelText('Enable Web Browsing');
    expect(browsingToggle.classList.contains('specificity-modal__toggle--on')).toBe(false);
  });
});
