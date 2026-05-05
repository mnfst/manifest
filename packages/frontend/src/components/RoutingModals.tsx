import { Show, createSignal, type Accessor, type Component } from 'solid-js';
import ModelPickerModal from './ModelPickerModal.js';
import ProviderSelectModal from './ProviderSelectModal.js';
import RoutingInstructionModal from './RoutingInstructionModal.js';
import KeyPickerModal from './KeyPickerModal.js';
import { PROVIDERS } from '../services/providers.js';
import type {
  TierAssignment,
  AuthType,
  CustomProviderData,
  AvailableModel,
  RoutingProvider,
  SpecificityAssignment,
} from '../services/api.js';
import type { CustomProviderPrefill, ProviderDeepLink } from '../services/routing-params.js';
import { usedKeyLabelsForModelInTier } from '../services/routing-utils.js';

interface RoutingModalsProps {
  agentName: () => string;
  dropdownTier: Accessor<string | null>;
  onDropdownClose: () => void;
  specificityDropdown?: Accessor<string | null>;
  onSpecificityDropdownClose?: () => void;
  onSpecificityOverride?: (
    category: string,
    model: string,
    provider: string,
    authType?: AuthType,
  ) => void;
  fallbackPickerTier: Accessor<string | null>;
  onFallbackPickerClose: () => void;
  showProviderModal: Accessor<boolean>;
  onProviderModalClose: () => void;
  customProviderPrefill?: CustomProviderPrefill | null;
  providerDeepLink?: ProviderDeepLink | null;
  instructionModal: Accessor<'enable' | 'disable' | null>;
  instructionProvider: Accessor<string | null>;
  onInstructionClose: () => void;
  models: () => AvailableModel[];
  tiers: () => TierAssignment[];
  specificityAssignments?: () => SpecificityAssignment[];
  customProviders: () => CustomProviderData[];
  connectedProviders: () => RoutingProvider[];
  getTier: (tierId: string) => TierAssignment | undefined;
  onOverride: (
    tierId: string,
    modelName: string,
    providerId: string,
    authType?: AuthType,
    providerKeyLabel?: string,
  ) => void;
  onAddFallback: (
    tierId: string,
    modelName: string,
    providerId: string,
    authType?: AuthType,
    providerKeyLabel?: string,
  ) => void;
  onProviderUpdate: () => Promise<void>;
  onOpenProviderModal: () => void;
}

interface PendingOverride {
  tierId: string;
  modelName: string;
  providerId: string;
  authType?: AuthType;
  keys: RoutingProvider[];
  isFallback?: boolean;
}

/**
 * All active credential rows for a (provider, auth_type) tuple, sorted by
 * priority. Used to decide whether to show the "Which key?" picker. Local
 * providers (Ollama) don't carry keys, so they're excluded — the chain
 * concept doesn't apply.
 */
function activeKeysFor(
  providers: RoutingProvider[],
  providerId: string,
  authType: AuthType,
): RoutingProvider[] {
  if (authType === 'local') return [];
  return providers
    .filter(
      (p) =>
        p.provider.toLowerCase() === providerId.toLowerCase() &&
        p.auth_type === authType &&
        p.is_active &&
        p.has_api_key,
    )
    .slice()
    .sort((a, b) => a.priority - b.priority);
}

function providerDisplayName(providerId: string, customProviders: CustomProviderData[]): string {
  if (providerId.startsWith('custom:')) {
    const id = providerId.slice('custom:'.length);
    const cp = customProviders.find((c) => c.id === id);
    if (cp) return cp.name;
  }
  return PROVIDERS.find((p) => p.id === providerId)?.name ?? providerId;
}

const RoutingModals: Component<RoutingModalsProps> = (props) => {
  const [pendingOverride, setPendingOverride] = createSignal<PendingOverride | null>(null);

  const handleSelect = (
    tierId: string,
    modelName: string,
    providerId: string,
    authType?: AuthType,
  ) => {
    const effectiveAuth = authType ?? 'api_key';
    const keys = activeKeysFor(props.connectedProviders(), providerId, effectiveAuth);
    if (keys.length <= 1) {
      props.onOverride(tierId, modelName, providerId, authType);
      return;
    }
    // 2+ keys → ask the user which one before persisting.
    setPendingOverride({ tierId, modelName, providerId, authType, keys });
  };

  const resolvePending = (label: string | null) => {
    const p = pendingOverride();
    if (!p) return;
    if (p.isFallback) {
      // Close the fallback picker so the user must re-open it — this ensures
      // the tier data is fresh and used-key filtering is accurate.
      props.onFallbackPickerClose();
      props.onAddFallback(p.tierId, p.modelName, p.providerId, p.authType, label ?? undefined);
    } else {
      props.onOverride(p.tierId, p.modelName, p.providerId, p.authType, label ?? undefined);
    }
    setPendingOverride(null);
  };

  return (
    <>
      <Show when={props.dropdownTier()}>
        {(tierId) => (
          <ModelPickerModal
            tierId={tierId()}
            models={props.models()}
            tiers={props.tiers()}
            customProviders={props.customProviders()}
            connectedProviders={props.connectedProviders()}
            onSelect={handleSelect}
            onClose={props.onDropdownClose}
            onConnectProviders={() => {
              props.onDropdownClose();
              props.onOpenProviderModal();
            }}
          />
        )}
      </Show>

      <Show when={props.specificityDropdown?.()}>
        {(category) => {
          const specificityTiers = (): TierAssignment[] =>
            (props.specificityAssignments?.() ?? [])
              .filter((a) => a.is_active)
              .map((a) => ({ ...a, tier: a.category }));
          return (
            <ModelPickerModal
              tierId={category()}
              models={props.models()}
              tiers={specificityTiers()}
              customProviders={props.customProviders()}
              connectedProviders={props.connectedProviders()}
              onSelect={(_, model, provider, authType) =>
                props.onSpecificityOverride?.(category(), model, provider, authType)
              }
              onClose={() => props.onSpecificityDropdownClose?.()}
              onConnectProviders={() => {
                props.onSpecificityDropdownClose?.();
                props.onOpenProviderModal();
              }}
            />
          );
        }}
      </Show>

      <Show when={props.fallbackPickerTier()}>
        {(tierId) => {
          const usedKeysForModel = (
            modelName: string,
            providerId?: string,
            authType?: AuthType,
          ) => {
            // The default key (priority 0) is implicitly used when the primary has no pin
            let defaultLabel: string | undefined;
            if (providerId) {
              const effectiveAuth = authType ?? 'api_key';
              const keys = activeKeysFor(props.connectedProviders(), providerId, effectiveAuth);
              defaultLabel = keys[0]?.label;
            }
            return usedKeyLabelsForModelInTier(
              props.getTier(tierId()),
              modelName,
              undefined,
              defaultLabel,
            );
          };

          const filteredModels = () => {
            return props.models().filter((m) => {
              // Find how many keys exist for this model's provider
              const providerId = m.provider;
              const authType = m.auth_type ?? 'api_key';
              const keys = activeKeysFor(props.connectedProviders(), providerId, authType);
              if (keys.length <= 1) {
                // Single-key model: hide if already used as primary or fallback
                // (matched on the full route tuple — same model on a different
                // (provider, auth) is intentionally NOT filtered).
                const tier = props.getTier(tierId());
                const primaryRoute = tier?.override_route ?? tier?.auto_assigned_route ?? null;
                if (
                  primaryRoute &&
                  primaryRoute.model === m.model_name &&
                  primaryRoute.provider.toLowerCase() === providerId.toLowerCase() &&
                  primaryRoute.authType === authType
                ) {
                  return false;
                }
                const routes = tier?.fallback_routes ?? [];
                return !routes.some(
                  (r) =>
                    r.model === m.model_name &&
                    r.provider.toLowerCase() === providerId.toLowerCase() &&
                    r.authType === authType,
                );
              }
              // Multi-key model: hide only if ALL keys are already used
              const used = usedKeysForModel(m.model_name, providerId, authType);
              return used.size < keys.length;
            });
          };

          const handleFallbackSelect = (
            tid: string,
            modelName: string,
            providerId: string,
            authType?: AuthType,
          ) => {
            const effectiveAuth = authType ?? 'api_key';
            const allKeys = activeKeysFor(props.connectedProviders(), providerId, effectiveAuth);
            if (allKeys.length <= 1) {
              // Single-key (or no-key) provider: add fallback without key selection
              props.onFallbackPickerClose();
              props.onAddFallback(tid, modelName, providerId, authType);
              return;
            }
            // Filter out keys already used for this model
            const used = usedKeysForModel(modelName, providerId, authType);
            const availableKeys = allKeys.filter((k) => !used.has(k.label.toLowerCase()));
            if (availableKeys.length === 0) {
              // All keys exhausted — shouldn't happen since filteredModels hides it
              return;
            }
            if (availableKeys.length === 1) {
              // Only one key left — auto-select it, close picker for fresh data
              props.onFallbackPickerClose();
              props.onAddFallback(tid, modelName, providerId, authType, availableKeys[0]!.label);
              return;
            }
            // 2+ keys available → ask which one
            setPendingOverride({
              tierId: tid,
              modelName,
              providerId,
              authType,
              keys: availableKeys,
              isFallback: true,
            });
          };
          return (
            <ModelPickerModal
              tierId={tierId()}
              models={filteredModels()}
              tiers={props.tiers()}
              customProviders={props.customProviders()}
              connectedProviders={props.connectedProviders()}
              onSelect={handleFallbackSelect}
              onClose={props.onFallbackPickerClose}
              onConnectProviders={() => {
                props.onFallbackPickerClose();
                props.onOpenProviderModal();
              }}
            />
          );
        }}
      </Show>

      <Show when={pendingOverride()}>
        {(p) => (
          <KeyPickerModal
            providerName={providerDisplayName(p().providerId, props.customProviders())}
            modelName={p().modelName}
            keys={p().keys}
            onPick={resolvePending}
            onClose={() => setPendingOverride(null)}
          />
        )}
      </Show>

      <Show when={props.showProviderModal()}>
        <ProviderSelectModal
          agentName={props.agentName()}
          providers={props.connectedProviders()}
          customProviders={props.customProviders()}
          customProviderPrefill={props.customProviderPrefill}
          providerDeepLink={props.providerDeepLink}
          onClose={props.onProviderModalClose}
          onUpdate={props.onProviderUpdate}
        />
      </Show>

      <RoutingInstructionModal
        open={props.instructionModal() !== null}
        mode={props.instructionModal() ?? 'enable'}
        agentName={props.agentName()}
        connectedProvider={props.instructionProvider()}
        onClose={props.onInstructionClose}
      />
    </>
  );
};

export default RoutingModals;
