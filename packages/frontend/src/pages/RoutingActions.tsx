import { createSignal, type Accessor, type Setter } from 'solid-js';
import { toast } from '../services/toast-store.js';
import {
  overrideTier,
  resetTier,
  resetAllTiers,
  setFallbacks,
  type TierAssignment,
  type AuthType,
} from '../services/api.js';

interface RoutingActionsInput {
  agentName: () => string;
  tiers: Accessor<TierAssignment[] | undefined>;
  mutateTiers: Setter<TierAssignment[] | undefined>;
  refetchAll: () => Promise<void>;
  setInstructionModal: Setter<'enable' | 'disable' | null>;
}

export function createRoutingActions(input: RoutingActionsInput) {
  const [changingTier, setChangingTier] = createSignal<string | null>(null);
  const [resettingAll, setResettingAll] = createSignal(false);
  const [resettingTier, setResettingTier] = createSignal<string | null>(null);
  const [addingFallback, setAddingFallback] = createSignal<string | null>(null);
  const [fallbackOverrides, setFallbackOverrides] = createSignal<Record<string, string[]>>({});

  const getTier = (tierId: string): TierAssignment | undefined =>
    input.tiers()?.find((t) => t.tier === tierId);

  const getFallbacksFor = (tierId: string): string[] => {
    const overrides = fallbackOverrides();
    if (tierId in overrides) return overrides[tierId]!;
    return getTier(tierId)?.fallback_models ?? [];
  };

  const handleOverride = async (
    tierId: string,
    modelName: string,
    providerId: string,
    authType?: AuthType,
  ) => {
    setChangingTier(tierId);
    try {
      const updated = await overrideTier(
        input.agentName(),
        tierId,
        modelName,
        providerId,
        authType,
      );
      input.mutateTiers((prev) => prev?.map((t) => (t.tier === tierId ? updated : t)));
      toast.success('Routing updated');
    } catch {
      // error toast from fetchMutate
    } finally {
      setChangingTier(null);
    }
  };

  const handleResetAll = async () => {
    setResettingAll(true);
    try {
      await resetAllTiers(input.agentName());
      input.mutateTiers((prev) =>
        prev?.map((t) => ({
          ...t,
          override_model: null,
          override_provider: null,
          override_auth_type: null,
          fallback_models: null,
        })),
      );
      toast.success('All tiers reset to auto');
    } catch {
      // error toast from fetchMutate
    } finally {
      setResettingAll(false);
    }
  };

  const handleReset = async (tierId: string) => {
    setResettingTier(tierId);
    try {
      await resetTier(input.agentName(), tierId);
      input.mutateTiers((prev) =>
        prev?.map((t) =>
          t.tier === tierId
            ? { ...t, override_model: null, override_provider: null, override_auth_type: null }
            : t,
        ),
      );
      toast.success('Tier reset to auto');
    } catch {
      // error toast from fetchMutate
    } finally {
      setResettingTier(null);
    }
  };

  const handleAddFallback = async (
    tierId: string,
    modelName: string,
    _providerId: string,
    _authType?: AuthType,
  ) => {
    const tier = getTier(tierId);
    const current = tier?.fallback_models ?? [];
    if (current.includes(modelName)) return;
    const updated = [...current, modelName];
    setFallbackOverrides((prev) => ({ ...prev, [tierId]: updated }));
    setAddingFallback(tierId);
    try {
      await setFallbacks(input.agentName(), tierId, updated);
      input.mutateTiers((prev) =>
        prev?.map((t) => (t.tier === tierId ? { ...t, fallback_models: updated } : t)),
      );
      toast.success('Fallback added');
    } catch {
      setFallbackOverrides((prev) => {
        const next = { ...prev };
        delete next[tierId];
        return next;
      });
    } finally {
      setAddingFallback(null);
      setFallbackOverrides((prev) => {
        const next = { ...prev };
        delete next[tierId];
        return next;
      });
    }
  };

  const handleFallbackUpdate = (tierId: string, updatedFallbacks: string[]) => {
    setFallbackOverrides((prev) => {
      const next = { ...prev };
      delete next[tierId];
      return next;
    });
    input.mutateTiers((prev) =>
      prev?.map((t) => (t.tier === tierId ? { ...t, fallback_models: updatedFallbacks } : t)),
    );
  };

  return {
    changingTier,
    resettingAll,
    resettingTier,
    addingFallback,
    getTier,
    getFallbacksFor,
    handleOverride,
    handleResetAll,
    handleReset,
    handleAddFallback,
    handleFallbackUpdate,
  };
}
