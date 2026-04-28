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
      // Auto-remove any fallback that conflicts with the new primary's (model, key).
      // A fallback conflicts if:
      //   - Same model + same key label (exact match)
      //   - Same model + fallback has no label (bare entry uses the default/primary key)
      if (updated.fallback_models?.length) {
        const cleaned = updated.fallback_models.filter((fb) => {
          const sep = fb.indexOf('||');
          const fbModel = sep === -1 ? fb : fb.substring(0, sep);
          const fbLabel = sep === -1 ? null : fb.substring(sep + 2).trim();
          if (fbModel !== modelName) return true; // different model, keep
          // Same model: remove if labels match or fallback has no label
          if (!fbLabel) return false; // bare entry = same model, remove
          if (providerKeyLabel && fbLabel.toLowerCase() === providerKeyLabel.toLowerCase())
            return false;
          return true; // different key label, keep
        });
        if (cleaned.length < updated.fallback_models.length) {
          await setFallbacks(input.agentName(), tierId, cleaned);
          updated.fallback_models = cleaned;
        }
      }
      input.mutateTiers((prev) => prev?.map((t) => (t.tier === tierId ? updated : t)));
      toast.success('Routing updated');
    } catch {
      // error toast from fetchMutate
    } finally {
      setChangingTier(null);
    }
  };

  /**
   * Pin a tier to a specific provider key label.
   * Re-uses the existing PUT /tiers/:tier endpoint by re-sending the current
   * model — the only delta is the new providerKeyLabel. The caller supplies
   * the resolved providerId because tiers in `auto` mode have a null
   * override_provider, and the DTO requires a non-empty value.
   */
  const handlePinKey = async (
    tierId: string,
    providerId: string,
    providerKeyLabel: string | null,
    authType?: AuthType,
  ) => {
    const tier = getTier(tierId);
    const model = tier?.override_model ?? tier?.auto_assigned_model;
    if (!tier || !model || !providerId) return;
    setChangingTier(tierId);
    try {
      const updated = await overrideTier(
        input.agentName(),
        tierId,
        model,
        providerId,
        authType ?? tier.override_auth_type ?? undefined,
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
    providerKeyLabel?: string,
  ) => {
    const tier = getTier(tierId);
    const current = tier?.fallback_models ?? [];
    // Use the explicitly picked key label if provided (from KeyPickerModal).
    // Do NOT inherit the primary's key — that would create a duplicate.
    const label = providerKeyLabel ?? null;
    const newEntry = label ? `${modelName}||${label}` : modelName;
    // Dedupe on the encoded entry so a user can still pin the same model on
    // two different keys (foo||Personal + foo||Work), but the exact same
    // model+label combo can't appear twice.
    if (current.includes(newEntry)) return;
    const updated = [...current, newEntry];
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
    handlePinKey,
    handleResetAll,
    handleReset,
    handleAddFallback,
    handleFallbackUpdate,
  };
}
