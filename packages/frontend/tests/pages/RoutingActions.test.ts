import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSignal } from 'solid-js';

const overrideTierMock = vi.fn();
const setFallbacksMock = vi.fn();
const resetTierMock = vi.fn();
const resetAllTiersMock = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock('../../src/services/api.js', () => ({
  overrideTier: (...args: unknown[]) => overrideTierMock(...args),
  setFallbacks: (...args: unknown[]) => setFallbacksMock(...args),
  resetTier: (...args: unknown[]) => resetTierMock(...args),
  resetAllTiers: (...args: unknown[]) => resetAllTiersMock(...args),
}));

vi.mock('../../src/services/toast-store.js', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

import { createRoutingActions } from '../../src/pages/RoutingActions';

function makeTier(overrides: Record<string, unknown> = {}) {
  return {
    id: 't1',
    user_id: 'u',
    agent_id: 'a',
    tier: 'standard',
    override_model: null,
    override_provider: null,
    override_auth_type: null,
    override_provider_key_label: null,
    auto_assigned_model: 'gpt-4o-mini',
    fallback_models: null,
    updated_at: '2026-04-27',
    ...overrides,
  };
}

function setup(initialTiers: ReturnType<typeof makeTier>[] = [makeTier()]) {
  const [tiers, mutateTiers] = createSignal<ReturnType<typeof makeTier>[] | undefined>(
    initialTiers,
  );
  const refetchAll = vi.fn().mockResolvedValue(undefined);
  const setInstructionModal = vi.fn();
  const actions = createRoutingActions({
    agentName: () => 'test-agent',
    tiers,
    mutateTiers: mutateTiers as never,
    refetchAll,
    setInstructionModal,
  });
  return { actions, tiers, refetchAll };
}

describe('RoutingActions.handlePinKey', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends the resolved providerId + label to overrideTier and updates tier state', async () => {
    overrideTierMock.mockResolvedValue(
      makeTier({ override_provider_key_label: 'Work', override_provider: 'openai' }),
    );
    const { actions, tiers } = setup();

    await actions.handlePinKey('standard', 'openai', 'Work', 'api_key');

    expect(overrideTierMock).toHaveBeenCalledWith(
      'test-agent',
      'standard',
      'gpt-4o-mini',
      'openai',
      'api_key',
      'Work',
    );
    expect(toastSuccess).toHaveBeenCalledWith('Pinned to "Work" key');
    expect(tiers()![0].override_provider_key_label).toBe('Work');
  });

  it('passes undefined providerKeyLabel when clearing the pin', async () => {
    overrideTierMock.mockResolvedValue(makeTier());
    const { actions } = setup();

    await actions.handlePinKey('standard', 'openai', null, 'api_key');

    expect(overrideTierMock).toHaveBeenCalledWith(
      'test-agent',
      'standard',
      'gpt-4o-mini',
      'openai',
      'api_key',
      undefined,
    );
    expect(toastSuccess).toHaveBeenCalledWith('Key pin cleared');
  });

  it('falls back to the tier override_auth_type when no authType arg is given', async () => {
    overrideTierMock.mockResolvedValue(makeTier());
    const { actions } = setup([
      makeTier({ override_auth_type: 'subscription', override_provider: 'anthropic' }),
    ]);

    await actions.handlePinKey('standard', 'anthropic', 'Pro');

    expect(overrideTierMock).toHaveBeenCalledWith(
      'test-agent',
      'standard',
      'gpt-4o-mini',
      'anthropic',
      'subscription',
      'Pro',
    );
  });

  it('is a no-op when the tier has no model', async () => {
    const { actions } = setup([makeTier({ auto_assigned_model: null })]);

    await actions.handlePinKey('standard', 'openai', 'Work');

    expect(overrideTierMock).not.toHaveBeenCalled();
  });

  it('is a no-op when providerId is empty', async () => {
    const { actions } = setup();

    await actions.handlePinKey('standard', '', 'Work');

    expect(overrideTierMock).not.toHaveBeenCalled();
  });

  it('swallows API errors silently (existing fetchMutate already toasts)', async () => {
    overrideTierMock.mockRejectedValue(new Error('boom'));
    const { actions } = setup();

    await actions.handlePinKey('standard', 'openai', 'Work');

    // No success toast on error.
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});

describe('RoutingActions.handleAddFallback inheriting the primary pin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setFallbacksMock.mockResolvedValue([]);
  });

  it('appends the new fallback with the primary tier label suffixed when present', async () => {
    const { actions } = setup([
      makeTier({
        override_model: 'gpt-4o',
        override_provider: 'openai',
        override_provider_key_label: 'Work',
      }),
    ]);

    await actions.handleAddFallback('standard', 'gpt-4o-mini', 'openai', 'api_key');

    expect(setFallbacksMock).toHaveBeenCalledWith('test-agent', 'standard', [
      'gpt-4o-mini||Work',
    ]);
  });

  it('appends the bare model when the primary has no key pin', async () => {
    const { actions } = setup();

    await actions.handleAddFallback('standard', 'gpt-4o-mini', 'openai', 'api_key');

    expect(setFallbacksMock).toHaveBeenCalledWith('test-agent', 'standard', ['gpt-4o-mini']);
  });

  it('skips when the model is already in the fallback list', async () => {
    const { actions } = setup([makeTier({ fallback_models: ['gpt-4o-mini'] })]);

    await actions.handleAddFallback('standard', 'gpt-4o-mini', 'openai', 'api_key');

    expect(setFallbacksMock).not.toHaveBeenCalled();
  });

  it('dedupes on the encoded entry — same model with a different label is allowed', async () => {
    const { actions } = setup([
      makeTier({
        override_provider_key_label: 'Work',
        fallback_models: ['gpt-4o-mini||Personal'],
      }),
    ]);
    await actions.handleAddFallback('standard', 'gpt-4o-mini', 'openai', 'api_key');
    expect(setFallbacksMock).toHaveBeenCalledWith('test-agent', 'standard', [
      'gpt-4o-mini||Personal',
      'gpt-4o-mini||Work',
    ]);
  });

  it('dedupes the same model+label combo even when added twice in a row', async () => {
    const { actions } = setup([
      makeTier({
        override_provider_key_label: 'Work',
        fallback_models: ['gpt-4o-mini||Work'],
      }),
    ]);
    await actions.handleAddFallback('standard', 'gpt-4o-mini', 'openai', 'api_key');
    expect(setFallbacksMock).not.toHaveBeenCalled();
  });
});
