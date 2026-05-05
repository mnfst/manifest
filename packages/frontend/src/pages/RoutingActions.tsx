import { createSignal, type Accessor, type Setter } from 'solid-js';
import { toast } from '../services/toast-store.js';
import {
  overrideTier,
  resetTier,
  resetAllTiers,
  setFallbacks,
  type TierAssignment,
  type AuthType,
  type ModelRoute,
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
    return getTier(tierId)?.fallback_routes?.map((r) => r.model) ?? [];
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
          override_route: null,
          fallback_routes: null,
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
        prev?.map((t) => (t.tier === tierId ? { ...t, override_route: null } : t)),
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
    providerId: string,
    authType?: AuthType,
  ) => {
    const tier = getTier(tierId);
    const currentRoutes = tier?.fallback_routes ?? [];
    const current = currentRoutes.map((r) => r.model);
    if (current.includes(modelName)) return;
    const updated = [...current, modelName];
    // Pass the explicit (provider, authType, model) tuple alongside the model
    // name. Without it, the backend can't disambiguate when the same model id
    // is offered by two of the user's connected providers (e.g. OpenAI
    // subscription + OpenAI API key both expose gpt-4o), which causes the
    // backend's unambiguousRoute() to return null and silently drop the save.
    const updatedRoutes: ModelRoute[] | undefined =
      authType !== undefined
        ? [...currentRoutes, { provider: providerId, authType, model: modelName }]
        : undefined;
    setFallbackOverrides((prev) => ({ ...prev, [tierId]: updated }));
    setAddingFallback(tierId);
    try {
      const persistedRoutes = await setFallbacks(input.agentName(), tierId, updated, updatedRoutes);
      input.mutateTiers((prev) =>
        prev?.map((t) => (t.tier === tierId ? { ...t, fallback_routes: persistedRoutes } : t)),
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

  const handleFallbackUpdate = (
    tierId: string,
    updatedFallbacks: string[],
    updatedRoutes?: ModelRoute[] | null,
  ) => {
    setFallbackOverrides((prev) => {
      const next = { ...prev };
      delete next[tierId];
      return next;
    });
    void updatedFallbacks; // names are derived from routes; kept in signature for caller convenience
    input.mutateTiers((prev) =>
      prev?.map((t) =>
        t.tier === tierId
          ? {
              ...t,
              ...(updatedRoutes !== undefined ? { fallback_routes: updatedRoutes } : {}),
            }
          : t,
      ),
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
