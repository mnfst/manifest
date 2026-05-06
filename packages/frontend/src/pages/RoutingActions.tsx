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
    providerKeyLabel?: string,
  ) => {
    setChangingTier(tierId);
    try {
      const updated = await overrideTier(
        input.agentName(),
        tierId,
        modelName,
        providerId,
        authType,
        providerKeyLabel,
      );
      // Commit the primary update to local state immediately so the UI reflects
      // the new model even if the fallback cleanup below fails.
      input.mutateTiers((prev) => prev?.map((t) => (t.tier === tierId ? updated : t)));
      toast.success('Routing updated');
      // Auto-remove any fallback that conflicts with the new primary's full
      // (model, provider, authType, keyLabel) tuple. Same model on a different
      // (provider, authType, keyLabel) is intentionally preserved — those are
      // distinct routing slots. The backend also dedupes via routeMatches, but
      // we mirror it locally so the optimistic UI doesn't flash a stale row.
      const routes = updated.fallback_routes ?? [];
      if (routes.length > 0) {
        const primary = updated.override_route ?? null;
        const cleanedRoutes = primary
          ? routes.filter(
              (r) =>
                !(
                  r.model === primary.model &&
                  r.provider.toLowerCase() === primary.provider.toLowerCase() &&
                  r.authType === primary.authType &&
                  (r.keyLabel ?? null) === (primary.keyLabel ?? null)
                ),
            )
          : routes;
        if (cleanedRoutes.length < routes.length) {
          const cleanedModels = cleanedRoutes.map((r) => r.model);
          const persistedRoutes = await setFallbacks(
            input.agentName(),
            tierId,
            cleanedModels,
            cleanedRoutes,
          );
          input.mutateTiers((prev) =>
            prev?.map((t) => (t.tier === tierId ? { ...t, fallback_routes: persistedRoutes } : t)),
          );
        }
      }
    } catch {
      // error toast from fetchMutate
    } finally {
      setChangingTier(null);
    }
  };

  /**
   * Pin a tier to a specific provider key label.
   * Re-uses the existing PUT /tiers/:tier endpoint by re-sending the current
   * (model, provider, authType) tuple — the only delta is the new
   * providerKeyLabel. The caller supplies the resolved providerId because
   * tiers in `auto` mode have a null override_route, and the DTO requires a
   * non-empty provider value.
   */
  const handlePinKey = async (
    tierId: string,
    providerId: string,
    providerKeyLabel: string | null,
    authType?: AuthType,
  ) => {
    const tier = getTier(tierId);
    const effective = tier?.override_route ?? tier?.auto_assigned_route ?? null;
    const model = effective?.model;
    if (!tier || !model || !providerId) return;
    setChangingTier(tierId);
    try {
      const updated = await overrideTier(
        input.agentName(),
        tierId,
        model,
        providerId,
        authType ?? effective?.authType,
        providerKeyLabel ?? undefined,
      );
      input.mutateTiers((prev) => prev?.map((t) => (t.tier === tierId ? updated : t)));
      toast.success(providerKeyLabel ? `Pinned to "${providerKeyLabel}" key` : 'Key pin cleared');
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
    providerKeyLabel?: string,
  ) => {
    const tier = getTier(tierId);
    const currentRoutes = tier?.fallback_routes ?? [];
    // Build the new fallback route. keyLabel comes from the explicit pick
    // in the key picker — we do NOT inherit the primary's pin so the user
    // can keep adding the same model under different keys until all are
    // exhausted (SebConejo's first review point).
    //
    // The full (provider, authType, model[, keyLabel]) tuple goes onto the
    // route alongside the model name. Without the tuple, the backend can't
    // disambiguate when the same model id is offered by two of the user's
    // connected providers (e.g. OpenAI subscription + OpenAI API key both
    // expose gpt-4o), which causes unambiguousRoute() to return null and
    // silently drop the save.
    const effectiveAuth = authType ?? 'api_key';
    const newRoute: ModelRoute = providerKeyLabel
      ? {
          provider: providerId,
          authType: effectiveAuth,
          model: modelName,
          keyLabel: providerKeyLabel,
        }
      : { provider: providerId, authType: effectiveAuth, model: modelName };
    // Dedupe against existing fallbacks on the full route tuple. Same model
    // on a different (provider, authType, keyLabel) is intentionally still
    // allowed — the primary blocks one slot, fallbacks can fill the rest.
    const isDuplicate = currentRoutes.some(
      (r) =>
        r.provider.toLowerCase() === newRoute.provider.toLowerCase() &&
        r.authType === newRoute.authType &&
        r.model === newRoute.model &&
        (r.keyLabel ?? null) === (newRoute.keyLabel ?? null),
    );
    if (isDuplicate) return;
    const updatedRoutes = [...currentRoutes, newRoute];
    const updated = updatedRoutes.map((r) => r.model);
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
      toast.error('Could not add fallback');
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
    handlePinKey,
    handleResetAll,
    handleReset,
    handleAddFallback,
    handleFallbackUpdate,
  };
}
