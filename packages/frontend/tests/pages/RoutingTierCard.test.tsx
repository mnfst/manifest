import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';

let mockCustomProviderLogo = vi.fn(() => null as any);

// Mutable so individual tests can override the provider registry to exercise
// the PROVIDERS fallback loop inside providerIdForModel. Reset in beforeEach.
const mockProvidersRef: { current: any[] } = { current: [] };

vi.mock('../../src/services/providers.js', () => ({
  get PROVIDERS() {
    return mockProvidersRef.current;
  },
  STAGES: [{ id: 'premium', label: 'Premium', desc: 'Best models' }],
}));

vi.mock('../../src/services/provider-utils.js', () => ({
  getModelLabel: (m: string) => m,
}));

vi.mock('../../src/components/ProviderIcon.jsx', () => ({
  providerIcon: (id: string) => <span data-testid={`prov-icon-${id}`} />,
  customProviderLogo: (...args: any[]) => mockCustomProviderLogo(...args),
}));

vi.mock('../../src/components/AuthBadge.js', () => ({
  authBadgeFor: () => null,
}));

// Mutable refs for routing-utils so specific tests can exercise branches in
// providerIdForModel (e.g. ollama-cloud precedence, the PROVIDERS fallback loop).
const mockResolveProviderId: { current: (p: string) => string | null | undefined } = {
  current: () => null,
};
const mockInferProviderFromModel: { current: (m: string) => string | null | undefined } = {
  current: () => null,
};

vi.mock('../../src/services/routing-utils.js', () => ({
  pricePerM: () => '$0.00',
  resolveProviderId: (p: string) => mockResolveProviderId.current(p),
  inferProviderFromModel: (m: string) => mockInferProviderFromModel.current(m),
}));

vi.mock('../../src/services/formatters.js', () => ({
  customProviderColor: () => '#abc',
}));

let capturedFallbackListProps: any = {};
vi.mock('../../src/components/FallbackList.js', () => ({
  default: (props: any) => {
    capturedFallbackListProps = props;
    return <div data-testid="fallback-list" />;
  },
}));

vi.mock('../../src/services/api.js', () => ({
  setFallbacks: vi.fn(() => Promise.resolve([])),
}));

vi.mock('../../src/services/toast-store.js', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

import RoutingTierCard from '../../src/pages/RoutingTierCard';
import { setFallbacks as mockSetFallbacksApi } from '../../src/services/api.js';
import { toast as mockToast } from '../../src/services/toast-store.js';

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
  beforeEach(() => {
    vi.clearAllMocks();
    capturedFallbackListProps = {};
    mockProvidersRef.current = [];
    mockResolveProviderId.current = () => null;
    mockInferProviderFromModel.current = () => null;
  });

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

  it('shows "+ Add model" button when eff() is null (no model available)', () => {
    const noModelTier = {
      tier: 'premium',
      auto_assigned_model: null,
      override_model: null,
      fallback_models: [],
      auto_assigned_provider_id: null,
    };
    render(() => (
      <RoutingTierCard {...baseProps} tier={() => noModelTier as any} />
    ));
    expect(screen.getByText('+ Add model')).toBeDefined();
  });

  it('"+ Add model" button calls onDropdownOpen', () => {
    const onDropdownOpen = vi.fn();
    const noModelTier = {
      tier: 'premium',
      auto_assigned_model: null,
      override_model: null,
      fallback_models: [],
      auto_assigned_provider_id: null,
    };
    render(() => (
      <RoutingTierCard
        {...baseProps}
        tier={() => noModelTier as any}
        onDropdownOpen={onDropdownOpen}
      />
    ));
    fireEvent.click(screen.getByText('+ Add model'));
    expect(onDropdownOpen).toHaveBeenCalledWith('premium');
  });

  it('renders primary model chip with drag handle', () => {
    const { container } = render(() => <RoutingTierCard {...baseProps} />);
    const chip = container.querySelector('.routing-card__model-chip');
    expect(chip).not.toBeNull();
    expect(chip!.getAttribute('draggable')).toBe('true');
    const dragHandle = chip!.querySelector('.fallback-list__drag-handle');
    expect(dragHandle).not.toBeNull();
  });

  it('primary model chip has Change icon with tooltip', () => {
    const { container } = render(() => <RoutingTierCard {...baseProps} />);
    const changeBtn = container.querySelector('.routing-card__chip-action');
    expect(changeBtn).not.toBeNull();
    expect(changeBtn!.getAttribute('aria-label')).toBe('Change model for Premium');
    const tooltip = changeBtn!.querySelector('.routing-tooltip');
    expect(tooltip).not.toBeNull();
    expect(tooltip!.textContent).toBe('Change');
  });

  it('reset button appears in header when hasCustomizations (override set)', () => {
    // baseTier has override_model set, so hasCustomizations should be true
    const { container } = render(() => <RoutingTierCard {...baseProps} />);
    const resetBtn = container.querySelector('.routing-card__header-reset');
    expect(resetBtn).not.toBeNull();
    expect(resetBtn!.textContent).toContain('Reset');
  });

  it('does not show reset button when no customizations', () => {
    const autoTier = {
      tier: 'premium',
      auto_assigned_model: 'claude-sonnet-4-20250514',
      override_model: null,
      fallback_models: [],
      auto_assigned_provider_id: 'anthropic',
    };
    const { container } = render(() => (
      <RoutingTierCard {...baseProps} tier={() => autoTier as any} />
    ));
    const resetBtn = container.querySelector('.routing-card__header-reset');
    expect(resetBtn).toBeNull();
  });

  it('model chip footer shows pricing info', () => {
    const modelsWithPricing = [
      {
        model_name: 'gpt-4o',
        provider: 'OpenAI',
        input_price_per_token: 0.000005,
        output_price_per_token: 0.000015,
      },
    ] as any[];
    const { container } = render(() => (
      <RoutingTierCard {...baseProps} models={() => modelsWithPricing} />
    ));
    const footer = container.querySelector('.routing-card__chip-footer');
    expect(footer).not.toBeNull();
    const priceSpan = footer!.querySelector('.routing-card__chip-price');
    expect(priceSpan).not.toBeNull();
    // pricePerM mock returns '$0.00', so the label contains that
    expect(priceSpan!.textContent).toContain('$0.00');
  });

  it('persistFallbacks prop is passed through to FallbackList', () => {
    const persistFn = vi.fn();
    render(() => (
      <RoutingTierCard {...baseProps} persistFallbacks={persistFn} />
    ));
    expect(capturedFallbackListProps.persistFallbacks).toBe(persistFn);
  });

  it('persistClearFallbacks prop is passed through to FallbackList', () => {
    const clearFn = vi.fn();
    render(() => (
      <RoutingTierCard {...baseProps} persistClearFallbacks={clearFn} />
    ));
    expect(capturedFallbackListProps.persistClearFallbacks).toBe(clearFn);
  });

  it('handlePrimaryDropAtSlot swaps primary with first fallback', async () => {
    const onOverride = vi.fn();
    const onFallbackUpdate = vi.fn();
    const tierWithFallbacks = {
      ...baseTier,
      fallback_models: ['fallback-model-1', 'fallback-model-2'],
    };
    vi.mocked(mockSetFallbacksApi).mockResolvedValue([]);

    render(() => (
      <RoutingTierCard
        {...baseProps}
        tier={() => tierWithFallbacks as any}
        getFallbacksFor={() => ['fallback-model-1', 'fallback-model-2']}
        onOverride={onOverride}
        onFallbackUpdate={onFallbackUpdate}
      />
    ));

    // Simulate primary being dropped at slot 1 in fallback list
    await capturedFallbackListProps.onPrimaryDropAtSlot(1);
    expect(onFallbackUpdate).toHaveBeenCalled();
    expect(onOverride).toHaveBeenCalled();
  });

  it('handlePrimaryDropAtSlot reverts on API failure', async () => {
    const onFallbackUpdate = vi.fn();
    const onOverride = vi.fn();
    const tierWithFallbacks = {
      ...baseTier,
      fallback_models: ['fb-1'],
    };
    vi.mocked(mockSetFallbacksApi).mockRejectedValue(new Error('fail'));

    render(() => (
      <RoutingTierCard
        {...baseProps}
        tier={() => tierWithFallbacks as any}
        getFallbacksFor={() => ['fb-1']}
        onOverride={onOverride}
        onFallbackUpdate={onFallbackUpdate}
      />
    ));

    await capturedFallbackListProps.onPrimaryDropAtSlot(1);
    // Should revert fallbacks and show error toast
    expect(onFallbackUpdate).toHaveBeenCalledTimes(2); // optimistic + revert
    expect(mockToast.error).toHaveBeenCalledWith('Failed to update fallbacks');
    expect(onOverride).not.toHaveBeenCalled();
  });

  it('handlePrimaryDropAtSlot uses persistFallbacks when provided', async () => {
    const persistFn = vi.fn(() => Promise.resolve([]));
    const onOverride = vi.fn();
    const onFallbackUpdate = vi.fn();

    render(() => (
      <RoutingTierCard
        {...baseProps}
        getFallbacksFor={() => ['fb-1']}
        onOverride={onOverride}
        onFallbackUpdate={onFallbackUpdate}
        persistFallbacks={persistFn}
      />
    ));

    await capturedFallbackListProps.onPrimaryDropAtSlot(1);
    expect(persistFn).toHaveBeenCalled();
    expect(mockSetFallbacksApi).not.toHaveBeenCalled();
  });

  it('handlePrimaryDropAtSlot is no-op when slot 0 and same model', async () => {
    const onOverride = vi.fn();
    const onFallbackUpdate = vi.fn();

    render(() => (
      <RoutingTierCard
        {...baseProps}
        getFallbacksFor={() => []}
        onOverride={onOverride}
        onFallbackUpdate={onFallbackUpdate}
      />
    ));

    await capturedFallbackListProps.onPrimaryDropAtSlot(0);
    expect(onFallbackUpdate).not.toHaveBeenCalled();
    expect(onOverride).not.toHaveBeenCalled();
  });

  it('primary chip drag events set dragging state', () => {
    const { container } = render(() => <RoutingTierCard {...baseProps} />);
    const chip = container.querySelector('.routing-card__model-chip')!;

    const dragStartEvent = new Event('dragstart', { bubbles: true });
    Object.defineProperty(dragStartEvent, 'dataTransfer', {
      value: { effectAllowed: '', setData: vi.fn() },
    });
    chip.dispatchEvent(dragStartEvent);
    expect(chip.classList.contains('routing-card__model-chip--dragging')).toBe(true);

    chip.dispatchEvent(new Event('dragend', { bubbles: true }));
    expect(chip.classList.contains('routing-card__model-chip--dragging')).toBe(false);
  });

  it('primary chip accepts drop from fallback and shows drop-target class', () => {
    const { container } = render(() => (
      <RoutingTierCard {...baseProps} getFallbacksFor={() => ['fb-1']} />
    ));
    const chip = container.querySelector('.routing-card__model-chip')!;

    // Simulate fallback drag start via FallbackList callback
    capturedFallbackListProps.onFallbackDragStart(0);

    const dragOverEvent = new Event('dragover', { bubbles: true, cancelable: true });
    Object.defineProperty(dragOverEvent, 'dataTransfer', {
      value: { dropEffect: '' },
    });
    chip.dispatchEvent(dragOverEvent);
    expect(chip.classList.contains('routing-card__model-chip--drop-target')).toBe(true);

    chip.dispatchEvent(new Event('dragleave', { bubbles: true }));
    expect(chip.classList.contains('routing-card__model-chip--drop-target')).toBe(false);
  });

  it('swapPrimaryWithFallback via drop on primary chip', async () => {
    const onOverride = vi.fn();
    const onFallbackUpdate = vi.fn();
    vi.mocked(mockSetFallbacksApi).mockResolvedValue([]);

    render(() => (
      <RoutingTierCard
        {...baseProps}
        getFallbacksFor={() => ['fb-model']}
        onOverride={onOverride}
        onFallbackUpdate={onFallbackUpdate}
      />
    ));

    // Simulate: fallback at index 0 being dragged
    capturedFallbackListProps.onFallbackDragStart(0);

    const chip = document.querySelector('.routing-card__model-chip')!;
    const dropEvent = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(dropEvent, 'dataTransfer', { value: {} });
    chip.dispatchEvent(dropEvent);

    // Wait for async
    await new Promise((r) => setTimeout(r, 50));
    expect(onFallbackUpdate).toHaveBeenCalled();
    expect(onOverride).toHaveBeenCalled();
  });

  it('swapPrimaryWithFallback reverts on API failure', async () => {
    const onOverride = vi.fn();
    const onFallbackUpdate = vi.fn();
    vi.mocked(mockSetFallbacksApi).mockRejectedValue(new Error('fail'));

    render(() => (
      <RoutingTierCard
        {...baseProps}
        getFallbacksFor={() => ['fb-model']}
        onOverride={onOverride}
        onFallbackUpdate={onFallbackUpdate}
      />
    ));

    capturedFallbackListProps.onFallbackDragStart(0);
    const chip = document.querySelector('.routing-card__model-chip')!;
    const dropEvent = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(dropEvent, 'dataTransfer', { value: {} });
    chip.dispatchEvent(dropEvent);

    await new Promise((r) => setTimeout(r, 50));
    expect(onFallbackUpdate).toHaveBeenCalledTimes(2); // optimistic + revert
    expect(mockToast.error).toHaveBeenCalledWith('Failed to update fallbacks');
    expect(onOverride).not.toHaveBeenCalled();
  });

  it('swapPrimaryWithFallback is no-op when no current model', async () => {
    const onOverride = vi.fn();
    const noModelTier = { ...baseTier, override_model: null, auto_assigned_model: null };

    render(() => (
      <RoutingTierCard
        {...baseProps}
        tier={() => noModelTier as any}
        getFallbacksFor={() => ['fb-model']}
        onOverride={onOverride}
      />
    ));
    // No chip rendered, no swap possible — just verify no error
    expect(onOverride).not.toHaveBeenCalled();
  });

  describe('providerIdForModel branches', () => {
    it('uses the ollama-cloud DB id over the colon-suffix heuristic (ollama-cloud branch)', () => {
      // When the model exists in apiModels and the DB provider resolves to
      // `ollama-cloud`, providerIdForModel must return `ollama-cloud` even
      // though inferProviderFromModel would route a tagged name (`gemma4:31b`)
      // to local `ollama` via the colon suffix heuristic.
      mockResolveProviderId.current = (p) => (p === 'ollama-cloud' ? 'ollama-cloud' : null);
      mockInferProviderFromModel.current = (m) => (m.includes(':') ? 'ollama' : null);
      mockProvidersRef.current = [
        { id: 'ollama', name: 'Ollama', models: [] },
        { id: 'ollama-cloud', name: 'Ollama Cloud', models: [] },
      ];

      const tier = {
        ...baseTier,
        override_model: 'gemma4:31b',
        auto_assigned_model: null,
      };
      const apiModels = [{ model_name: 'gemma4:31b', provider: 'ollama-cloud' }];

      const { container } = render(() => (
        <RoutingTierCard {...baseProps} tier={() => tier as any} models={() => apiModels as any} />
      ));

      // The provider icon mock emits data-testid=`prov-icon-${id}`, so the
      // presence of prov-icon-ollama-cloud (and absence of prov-icon-ollama)
      // proves providerIdForModel returned the DB id, not the prefix-inferred one.
      expect(container.querySelector('[data-testid="prov-icon-ollama-cloud"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="prov-icon-ollama"]')).toBeNull();
    });

    it('uses local ollama DB id for ollama-hosted models (ollama branch)', () => {
      mockResolveProviderId.current = (p) => (p === 'ollama' ? 'ollama' : null);
      mockInferProviderFromModel.current = () => 'anthropic';
      mockProvidersRef.current = [
        { id: 'ollama', name: 'Ollama', models: [] },
        { id: 'anthropic', name: 'Anthropic', models: [] },
      ];

      const tier = { ...baseTier, override_model: 'llama3.1:70b', auto_assigned_model: null };
      const apiModels = [{ model_name: 'llama3.1:70b', provider: 'ollama' }];

      const { container } = render(() => (
        <RoutingTierCard {...baseProps} tier={() => tier as any} models={() => apiModels as any} />
      ));
      expect(container.querySelector('[data-testid="prov-icon-ollama"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="prov-icon-anthropic"]')).toBeNull();
    });

    it('falls back to searching PROVIDERS.models when nothing else matches (lines 44-45)', () => {
      // Empty apiModels → first block skipped.
      // inferProviderFromModel returns null → second block skipped.
      // PROVIDERS entry has a matching model prefix → the for-loop returns prov.id.
      mockInferProviderFromModel.current = () => null;
      mockProvidersRef.current = [
        {
          id: 'special-vendor',
          name: 'Special',
          models: [{ value: 'weird-model' }],
        },
      ];

      const tier = {
        ...baseTier,
        override_model: 'weird-model-v2',
        auto_assigned_model: null,
      };
      const { container } = render(() => (
        <RoutingTierCard {...baseProps} tier={() => tier as any} models={() => [] as any[]} />
      ));
      expect(container.querySelector('[data-testid="prov-icon-special-vendor"]')).not.toBeNull();
    });

    it('uses PROVIDERS.models reverse-prefix match', () => {
      mockInferProviderFromModel.current = () => null;
      mockProvidersRef.current = [
        {
          id: 'special-vendor',
          name: 'Special',
          // value starts with the tier model — reverse prefix match
          models: [{ value: 'short-v2' }],
        },
      ];

      const tier = {
        ...baseTier,
        override_model: 'short',
        auto_assigned_model: null,
      };
      const { container } = render(() => (
        <RoutingTierCard {...baseProps} tier={() => tier as any} models={() => [] as any[]} />
      ));
      expect(container.querySelector('[data-testid="prov-icon-special-vendor"]')).not.toBeNull();
    });
  });

  it('swapPrimaryWithFallback is no-op when fallback index out of range', async () => {
    const onOverride = vi.fn();
    const onFallbackUpdate = vi.fn();
    vi.mocked(mockSetFallbacksApi).mockResolvedValue([]);

    render(() => (
      <RoutingTierCard
        {...baseProps}
        getFallbacksFor={() => []}
        onOverride={onOverride}
        onFallbackUpdate={onFallbackUpdate}
      />
    ));

    // Simulate fallback drag from invalid index
    capturedFallbackListProps.onFallbackDragStart(5);
    const chip = document.querySelector('.routing-card__model-chip')!;
    const dropEvent = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(dropEvent, 'dataTransfer', { value: {} });
    chip.dispatchEvent(dropEvent);

    await new Promise((r) => setTimeout(r, 50));
    expect(onOverride).not.toHaveBeenCalled();
  });
});
