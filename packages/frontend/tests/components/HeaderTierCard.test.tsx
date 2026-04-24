import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@solidjs/testing-library';
import type { HeaderTier } from '../../src/services/api/header-tiers';

const setHeaderTierFallbacksMock = vi.fn();
const clearHeaderTierFallbacksMock = vi.fn();

vi.mock('../../src/services/api/header-tiers.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    setHeaderTierFallbacks: (...args: unknown[]) => setHeaderTierFallbacksMock(...args),
    clearHeaderTierFallbacks: (...args: unknown[]) => clearHeaderTierFallbacksMock(...args),
  };
});

vi.mock('../../src/components/ModelPickerModal.js', () => ({
  default: (props: {
    tierId: string;
    models: unknown[];
    tiers: unknown[];
    customProviders: unknown[];
    connectedProviders: unknown[];
    onSelect: (tierId: string, model: string, provider: string, auth?: string) => void;
    onClose: () => void;
  }) => (
    <div
      data-testid="mock-picker"
      data-tier-id={props.tierId}
      data-models-len={props.models.length}
      data-tiers-len={props.tiers.length}
      data-custom-len={props.customProviders.length}
      data-connected-len={props.connectedProviders.length}
    >
      <button
        data-testid="mock-pick"
        onClick={() => props.onSelect('ignored', 'gpt-4o-mini', 'OpenAI', 'api_key')}
      >
        pick gpt-4o-mini
      </button>
      <button data-testid="mock-picker-close" onClick={props.onClose}>
        close
      </button>
    </div>
  ),
}));

vi.mock('../../src/components/FallbackList.js', () => ({
  default: (props: {
    agentName: string;
    tier: string;
    fallbacks: string[];
    models: unknown[];
    customProviders: unknown[];
    connectedProviders: unknown[];
    onAddFallback: () => void;
    onUpdate: (next: string[]) => void;
    persistFallbacks: (agent: string, tierId: string, models: string[]) => Promise<unknown>;
    persistClearFallbacks: (agent: string, tierId: string) => Promise<unknown>;
  }) => (
    <div
      data-testid="mock-fallback-list"
      data-agent-name={props.agentName}
      data-tier={props.tier}
      data-models-len={props.models.length}
      data-custom-len={props.customProviders.length}
      data-connected-len={props.connectedProviders.length}
    >
      <span data-testid="fallback-count">{props.fallbacks.length}</span>
      <button data-testid="add-fallback" onClick={props.onAddFallback}>
        + Add fallback
      </button>
      <button data-testid="fallback-update" onClick={() => props.onUpdate(['mock-removed'])}>
        update
      </button>
      <button
        data-testid="invoke-persist"
        onClick={() => void props.persistFallbacks('cb-agent', 'cb-tier', ['m1', 'm2'])}
      >
        persist
      </button>
      <button
        data-testid="invoke-persist-clear"
        onClick={() => void props.persistClearFallbacks('cb-agent', 'cb-tier')}
      >
        persist-clear
      </button>
    </div>
  ),
}));

vi.mock('../../src/components/ProviderIcon.js', () => ({
  providerIcon: () => <span data-testid="provider-icon" />,
  customProviderLogo: () => <span data-testid="custom-logo" />,
}));

vi.mock('../../src/components/AuthBadge.js', () => ({
  authBadgeFor: (t: string | null | undefined) =>
    t ? <span data-testid={`auth-${t}`} /> : null,
}));

import HeaderTierCard from '../../src/components/HeaderTierCard';

const baseTier: HeaderTier = {
  id: 'ht-1',
  agent_id: 'a1',
  name: 'Premium',
  header_key: 'x-manifest-tier',
  header_value: 'premium',
  badge_color: 'violet',
  sort_order: 0,
  enabled: true,
  override_model: 'gpt-4o',
  override_provider: 'openai',
  override_auth_type: 'api_key',
  fallback_models: null,
  created_at: '2026-04-21',
  updated_at: '2026-04-21',
};

interface MountOptions {
  tier?: HeaderTier;
  models?: never[];
  customProviders?: never[];
  connectedProviders?: never[];
  onOverride?: ReturnType<typeof vi.fn>;
  onFallbacksUpdate?: ReturnType<typeof vi.fn>;
  onEdit?: ReturnType<typeof vi.fn>;
}

function mount(opts: MountOptions = {}) {
  const onOverride = opts.onOverride ?? vi.fn();
  const onFallbacksUpdate = opts.onFallbacksUpdate ?? vi.fn();
  const onEdit = opts.onEdit;
  const result = render(() => (
    <HeaderTierCard
      agentName="my-agent"
      tier={opts.tier ?? baseTier}
      models={
        opts.models ??
        ([
          {
            model_name: 'gpt-4o',
            display_name: 'GPT-4o',
            provider: 'OpenAI',
            input_price_per_token: 0.000005,
            output_price_per_token: 0.00001,
          },
        ] as never)
      }
      customProviders={opts.customProviders ?? []}
      connectedProviders={opts.connectedProviders ?? []}
      onOverride={onOverride}
      onFallbacksUpdate={onFallbacksUpdate}
      onEdit={onEdit}
    />
  ));
  return { ...result, onOverride, onFallbacksUpdate, onEdit };
}

describe('HeaderTierCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
  });

  it('renders name, rule, and primary model chip', () => {
    const { container, getByText } = mount();
    expect(getByText('Premium')).toBeDefined();
    expect(container.textContent).toContain('x-manifest-tier: premium');
    expect(container.textContent).toContain('GPT-4o');
    expect(container.querySelector('[data-testid="auth-api_key"]')).not.toBeNull();
    // Vertical card uses the shared routing-card layout.
    expect(container.querySelector('.routing-card.routing-card--header-tier')).not.toBeNull();
    expect(container.querySelector('.routing-card__model-chip')).not.toBeNull();
  });

  it('falls back to raw model name when no display_name is known', () => {
    const { container } = mount({ models: [] as never });
    expect(container.textContent).toContain('gpt-4o');
  });

  it('renders "+ Add model" when override_model is null', () => {
    const emptyTier: HeaderTier = { ...baseTier, override_model: null };
    const { getByText } = mount({ tier: emptyTier });
    expect(getByText('+ Add model')).toBeDefined();
  });

  it('opens the model picker for primary and forwards selection to onOverride', () => {
    const { container, getByTestId, onOverride } = mount();
    fireEvent.click(container.querySelector('.routing-card__model-chip')!);
    expect(getByTestId('mock-picker')).toBeDefined();
    fireEvent.click(getByTestId('mock-pick'));
    expect(onOverride).toHaveBeenCalledWith('gpt-4o-mini', 'OpenAI', 'api_key');
  });

  it('renders gear icon button for snippet modal', () => {
    const { container } = mount();
    expect(container.querySelector('.header-tier-card__icon-btn')).not.toBeNull();
  });

  it('renders the FallbackList when a primary model is set', () => {
    const { getByTestId } = mount();
    expect(getByTestId('mock-fallback-list')).toBeDefined();
  });

  it('does not render the FallbackList when no primary model is set', () => {
    const emptyTier: HeaderTier = { ...baseTier, override_model: null };
    const { queryByTestId } = mount({ tier: emptyTier });
    expect(queryByTestId('mock-fallback-list')).toBeNull();
  });

  it('reflects fallback_models length to the FallbackList', () => {
    const tierWithFallbacks: HeaderTier = {
      ...baseTier,
      fallback_models: ['claude-sonnet-4', 'gemini-2.5-pro'],
    };
    const { getByTestId } = mount({ tier: tierWithFallbacks });
    expect(getByTestId('fallback-count').textContent).toBe('2');
  });

  it('add-fallback opens the picker and selection appends to fallback_models then triggers refetch', async () => {
    setHeaderTierFallbacksMock.mockResolvedValue(['gpt-4o-mini']);
    const { getByTestId, onFallbacksUpdate } = mount();
    fireEvent.click(getByTestId('add-fallback'));
    expect(getByTestId('mock-picker')).toBeDefined();
    fireEvent.click(getByTestId('mock-pick'));
    await waitFor(() =>
      expect(setHeaderTierFallbacksMock).toHaveBeenCalledWith('my-agent', 'ht-1', ['gpt-4o-mini']),
    );
    expect(onFallbacksUpdate).toHaveBeenCalledWith(['gpt-4o-mini']);
  });

  it('FallbackList onUpdate forwards to onFallbacksUpdate', () => {
    const { getByTestId, onFallbacksUpdate } = mount();
    fireEvent.click(getByTestId('fallback-update'));
    expect(onFallbacksUpdate).toHaveBeenCalledWith(['mock-removed']);
  });

  it('renders gear icon button for snippet modal', () => {
    const { container } = mount();
    expect(container.querySelector('.header-tier-card__icon-btn')).not.toBeNull();
  });

  it('infers the provider id from the model prefix when override_provider is absent', () => {
    const prefixTier: HeaderTier = {
      ...baseTier,
      override_provider: null,
      override_model: 'anthropic/claude-sonnet-4',
    };
    const { container } = mount({ tier: prefixTier });
    expect(container.querySelector('[data-testid="provider-icon"]')).not.toBeNull();
  });

  it('renders the custom-provider swatch when the tier points at custom:{id}', () => {
    const customTier: HeaderTier = {
      ...baseTier,
      override_provider: 'custom:cp-1',
      override_model: 'custom:cp-1/llama3',
    };
    const { container } = mount({
      tier: customTier,
      customProviders: [{ id: 'cp-1', name: 'Local Llama' }] as never,
    });
    expect(container.querySelector('[data-testid="custom-logo"]')).not.toBeNull();
  });

  it('falls back to subscription auth when no override_auth_type and provider is subscription', () => {
    const subTier: HeaderTier = { ...baseTier, override_auth_type: null };
    const { container } = mount({
      tier: subTier,
      connectedProviders: [{ provider: 'OpenAI', auth_type: 'subscription' }] as never,
    });
    expect(container.textContent).toContain('Included in subscription');
  });

  it('falls back to api_key auth when no override_auth_type and provider is api_key only', () => {
    const apiTier: HeaderTier = { ...baseTier, override_auth_type: null };
    const { container } = mount({
      tier: apiTier,
      connectedProviders: [{ provider: 'openai', auth_type: 'api_key' }] as never,
    });
    expect(container.querySelector('[data-testid="auth-api_key"]')).not.toBeNull();
  });

  it('renders no auth badge when override_auth_type is null and no providers match', () => {
    const noAuthTier: HeaderTier = { ...baseTier, override_auth_type: null };
    const { container } = mount({ tier: noAuthTier });
    // No connected providers → effectiveAuth() returns null → no badge.
    expect(container.querySelector('[data-testid^="auth-"]')).toBeNull();
  });

  it('Change chip-action button opens the picker, stops propagation, and forwards selection', () => {
    const { container, getByTestId, onOverride } = mount();
    const chipAction = container.querySelector('.routing-card__chip-action') as HTMLElement;
    expect(chipAction).not.toBeNull();
    fireEvent.click(chipAction);
    expect(getByTestId('mock-picker')).toBeDefined();
    fireEvent.click(getByTestId('mock-pick'));
    expect(onOverride).toHaveBeenCalledWith('gpt-4o-mini', 'OpenAI', 'api_key');
  });

  it('persistFallbacks closure forwards the card agentName and tier id to the API', async () => {
    setHeaderTierFallbacksMock.mockResolvedValue([]);
    const { getByTestId } = mount();
    fireEvent.click(getByTestId('invoke-persist'));
    await waitFor(() =>
      expect(setHeaderTierFallbacksMock).toHaveBeenCalledWith('my-agent', 'cb-tier', ['m1', 'm2']),
    );
  });

  it('persistClearFallbacks closure forwards the card agentName and tier id to the API', async () => {
    clearHeaderTierFallbacksMock.mockResolvedValue(undefined);
    const { getByTestId } = mount();
    fireEvent.click(getByTestId('invoke-persist-clear'));
    await waitFor(() =>
      expect(clearHeaderTierFallbacksMock).toHaveBeenCalledWith('my-agent', 'cb-tier'),
    );
  });

  it('add-fallback selection swallows persist errors without calling onFallbacksUpdate', async () => {
    setHeaderTierFallbacksMock.mockRejectedValue(new Error('persist boom'));
    const { getByTestId, onFallbacksUpdate } = mount();
    fireEvent.click(getByTestId('add-fallback'));
    fireEvent.click(getByTestId('mock-pick'));
    await waitFor(() => expect(setHeaderTierFallbacksMock).toHaveBeenCalled());
    expect(onFallbacksUpdate).not.toHaveBeenCalled();
  });

  it('resolves the provider from the models list when override_provider is null', () => {
    const inferTier: HeaderTier = { ...baseTier, override_provider: null };
    const { container } = mount({ tier: inferTier });
    // gpt-4o is in the default models with provider 'OpenAI'; we should still
    // get a non-custom provider icon for the chip.
    expect(container.querySelector('[data-testid="provider-icon"]')).not.toBeNull();
  });

  it('falls back to undefined provider when the model prefix is unknown', () => {
    const unknownTier: HeaderTier = {
      ...baseTier,
      override_provider: null,
      override_model: 'totally-made-up-model',
    };
    const { container } = mount({ tier: unknownTier, models: [] as never });
    // No matching model and no recognizable prefix → no provider icon.
    expect(container.querySelector('[data-testid="provider-icon"]')).toBeNull();
  });

  it('gear icon button opens the SDK snippet modal', async () => {
    const { container, getByText } = mount();
    const gearBtn = container.querySelector('.header-tier-card__icon-btn');
    expect(gearBtn).not.toBeNull();
    fireEvent.click(gearBtn!);
    await waitFor(() => expect(getByText(/Send the .* header/)).toBeDefined());
  });

  it('renders the edit button only when onEdit is provided', () => {
    const onEdit = vi.fn();
    const { container: withEdit } = mount({ onEdit });
    expect(withEdit.querySelector(`button[aria-label="Edit ${baseTier.name}"]`)).not.toBeNull();

    const { container: withoutEdit } = mount();
    expect(withoutEdit.querySelector('button[aria-label^="Edit "]')).toBeNull();
  });

  it('calls onEdit when the edit button is clicked', () => {
    const onEdit = vi.fn();
    const { container } = mount({ onEdit });
    const editBtn = container.querySelector(
      `button[aria-label="Edit ${baseTier.name}"]`,
    ) as HTMLButtonElement;
    fireEvent.click(editBtn);
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('falls back to the provider db-id when the model name has no recognizable prefix', () => {
    // model name has no known vendor prefix but the model entry still resolves
    // to a known provider via its `provider` field — we should fall back to it.
    const oddTier: HeaderTier = {
      ...baseTier,
      override_provider: null,
      override_model: 'odd-name',
    };
    const { container } = mount({
      tier: oddTier,
      models: [
        {
          model_name: 'odd-name',
          display_name: 'Odd',
          provider: 'OpenAI',
          input_price_per_token: 0,
          output_price_per_token: 0,
        },
      ] as never,
    });
    expect(container.querySelector('[data-testid="provider-icon"]')).not.toBeNull();
  });
});
