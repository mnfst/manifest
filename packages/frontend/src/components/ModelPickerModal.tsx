import { createSignal, For, Show, type Component } from 'solid-js';
import type {
  AuthType,
  AvailableModel,
  CustomProviderData,
  RoutingProvider,
  TierAssignment,
} from '../services/api.js';
import { PROVIDERS, STAGES, SPECIFICITY_STAGES } from '../services/providers.js';
import { customProviderColor } from '../services/formatters.js';
import { inferProviderFromModel, pricePerM, resolveProviderId } from '../services/routing-utils.js';
import { providerIcon, customProviderLogo } from './ProviderIcon.js';

interface Props {
  tierId: string;
  models: AvailableModel[];
  tiers: TierAssignment[];
  customProviders?: CustomProviderData[];
  connectedProviders?: RoutingProvider[];
  onSelect: (tierId: string, modelName: string, providerId: string, authType?: AuthType) => void;
  onClose: () => void;
}

/** Resolve a display label for a model name, handling vendor-prefixed IDs. */
function labelForModel(name: string, labels: Map<string, string>): string {
  const direct = labels.get(name);
  if (direct) return direct;
  const slash = name.indexOf('/');
  if (slash !== -1) {
    const bare = name.substring(slash + 1);
    const found = labels.get(bare);
    if (found) return found;
    return bare;
  }
  return name;
}

const isFreeModel = (m: AvailableModel): boolean =>
  m.input_price_per_token != null &&
  m.output_price_per_token != null &&
  Number(m.input_price_per_token) === 0 &&
  Number(m.output_price_per_token) === 0;

const ModelPickerModal: Component<Props> = (props) => {
  const hasSubscription = () =>
    (props.connectedProviders ?? []).some((p) => p.is_active && p.auth_type === 'subscription');
  const hasApiKey = () =>
    (props.connectedProviders ?? []).some((p) => p.is_active && p.auth_type === 'api_key');
  const showTabs = () => hasSubscription() && hasApiKey();

  const [activeTab, setActiveTab] = createSignal<AuthType>(
    hasSubscription() ? 'subscription' : 'api_key',
  );
  const [search, setSearch] = createSignal('');
  const [showFreeOnly, setShowFreeOnly] = createSignal(false);

  const providerLabelMap = (): Map<string, string> => {
    const map = new Map<string, string>();
    for (const prov of PROVIDERS) {
      for (const m of prov.models) map.set(m.value, m.label);
    }
    return map;
  };

  const customProviderNameMap = (): Map<string, string> => {
    const map = new Map<string, string>();
    for (const cp of props.customProviders ?? []) {
      map.set(`custom:${cp.id}`, cp.name);
    }
    return map;
  };

  /** Provider IDs that have an active connection of the given auth type. */
  const providerIdsForTab = (authType: AuthType): Set<string> => {
    const ids = new Set<string>();
    for (const p of props.connectedProviders ?? []) {
      if (p.is_active && p.auth_type === authType) {
        ids.add(p.provider.toLowerCase());
        const resolved = resolveProviderId(p.provider);
        if (resolved) ids.add(resolved);
      }
    }
    return ids;
  };

  const groupedModels = () => {
    const q = search().toLowerCase().trim();
    const labels = providerLabelMap();
    const cpNames = customProviderNameMap();
    const tab = activeTab();
    const hasConnectedProviders = (props.connectedProviders ?? []).length > 0;

    type ModalModel = { value: string; label: string; pricing: AvailableModel };
    const groupMap = new Map<string, { provId: string; name: string; models: ModalModel[] }>();

    const freeOnly = tab === 'api_key' && showFreeOnly();
    const allowedProviders = hasConnectedProviders ? providerIdsForTab(tab) : undefined;

    for (const m of props.models) {
      // Filter by the model's own auth_type to prevent subscription models
      // from leaking into the API Keys tab and vice versa (e.g. when the
      // same provider is connected with both auth types and they have
      // different model access levels).
      if (showTabs() && m.auth_type && m.auth_type !== tab) continue;
      if (freeOnly && !isFreeModel(m)) continue;
      const dbProvId = resolveProviderId(m.provider);
      const prefixProvId = inferProviderFromModel(m.model_name);
      // Prefer prefix-inferred provider (e.g. "anthropic" from "anthropic/claude-sonnet-4")
      // over the DB provider (e.g. "openrouter" when all models come from OpenRouter).
      // Exception: Ollama providers keep their DB id because Ollama model names
      // (e.g. "gemma4:31b") would otherwise be mis-inferred as local Ollama
      // via the colon-suffix heuristic in inferProviderFromModel.
      const provId =
        dbProvId === 'ollama' || dbProvId === 'ollama-cloud'
          ? dbProvId
          : prefixProvId && PROVIDERS.find((p) => p.id === prefixProvId)
            ? prefixProvId
            : (dbProvId ?? prefixProvId);
      if (!provId) continue;
      if (allowedProviders && !allowedProviders.has(provId)) continue;
      if (!groupMap.has(provId)) {
        const isCustom = provId.startsWith('custom:');
        const provDef = PROVIDERS.find((p) => p.id === provId);
        const name = isCustom
          ? (m.provider_display_name ?? cpNames.get(provId) ?? m.provider)
          : (provDef?.name ?? m.provider);
        groupMap.set(provId, { provId, name, models: [] });
      }
      const label = m.display_name || labelForModel(m.model_name, labels);
      groupMap.get(provId)!.models.push({ value: m.model_name, label, pricing: m });
    }

    const groups: { provId: string; name: string; models: ModalModel[] }[] = [];
    for (const group of groupMap.values()) {
      group.models.sort((a, b) => {
        if (a.value === 'openrouter/free') return -1;
        if (b.value === 'openrouter/free') return 1;
        return a.label.localeCompare(b.label);
      });
      if (q) {
        const nameMatch = group.name.toLowerCase().includes(q);
        const filtered = nameMatch
          ? group.models
          : group.models.filter(
              (m) => m.label.toLowerCase().includes(q) || m.value.toLowerCase().includes(q),
            );
        if (filtered.length > 0) groups.push({ ...group, models: filtered });
      } else if (group.models.length > 0) {
        groups.push(group);
      }
    }
    groups.sort((a, b) => a.name.localeCompare(b.name));
    return groups;
  };

  const isRecommended = (modelName: string): boolean => {
    const t = props.tiers.find((r) => r.tier === props.tierId);
    return t?.auto_assigned_model === modelName;
  };

  /** Returns the role of a model in the current tier: "Primary", "Fallback 1", etc. or null */
  const modelRole = (modelName: string): string | null => {
    const t = props.tiers.find((r) => r.tier === props.tierId);
    if (!t) return null;
    const primary = t.override_model ?? t.auto_assigned_model;
    if (primary === modelName) return 'Primary';
    const fb = t.fallback_models ?? [];
    const fbIndex = fb.indexOf(modelName);
    if (fbIndex !== -1) return `Fallback ${fbIndex + 1}`;
    return null;
  };

  const totalVisibleModels = () => groupedModels().reduce((sum, g) => sum + g.models.length, 0);

  /** Total models available (ignoring search) — used to decide whether to show search bar */
  const totalAvailableModels = () => {
    const saved = search();
    if (!saved) return totalVisibleModels();
    // Count all models without applying search filter
    return props.models.length;
  };

  const isSub = () => activeTab() === 'subscription';

  return (
    <div
      class="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') props.onClose();
      }}
    >
      <div
        class="modal-card"
        style="max-width: 600px; padding: 0; display: flex; flex-direction: column; max-height: 80vh;"
        role="dialog"
        aria-modal="true"
        aria-labelledby="model-picker-title"
      >
        <div class="routing-modal__header">
          <div>
            <div class="routing-modal__title" id="model-picker-title">
              Select a model
            </div>
            <div class="routing-modal__subtitle">
              {
                (
                  STAGES.find((s) => s.id === props.tierId) ??
                  SPECIFICITY_STAGES.find((s) => s.id === props.tierId)
                )?.label
              }{' '}
              tier
            </div>
          </div>
          <button class="modal__close" onClick={() => props.onClose()} aria-label="Close">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        <Show when={showTabs()}>
          <div class="provider-modal__tabs-wrapper">
            <div class="panel__tabs" role="tablist">
              <button
                role="tab"
                aria-selected={activeTab() === 'subscription'}
                class="panel__tab"
                classList={{ 'panel__tab--active': activeTab() === 'subscription' }}
                onClick={() => {
                  setActiveTab('subscription');
                  setShowFreeOnly(false);
                }}
              >
                <svg
                  class="provider-modal__tab-icon"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                  style="color: #1cc4bf"
                >
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                Subscription
              </button>
              <button
                role="tab"
                aria-selected={activeTab() === 'api_key'}
                class="panel__tab"
                classList={{ 'panel__tab--active': activeTab() === 'api_key' }}
                onClick={() => setActiveTab('api_key')}
              >
                <svg
                  class="provider-modal__tab-icon"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                  style="color: #e59d55"
                >
                  <path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4" />
                </svg>
                API Keys
              </button>
            </div>
          </div>
        </Show>

        <Show when={totalAvailableModels() > 5}>
          <div class="routing-modal__search-wrap">
            <svg
              class="routing-modal__search-icon"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              class="routing-modal__search"
              type="text"
              placeholder="Search models or providers..."
              aria-label="Search models or providers"
              value={search()}
              onInput={(e) => setSearch(e.currentTarget.value)}
              autofocus
            />
          </div>
        </Show>

        <Show when={!isSub()}>
          <div class="routing-modal__filter-bar">
            <button
              type="button"
              class="routing-modal__filter-pill"
              classList={{ 'routing-modal__filter-pill--active': showFreeOnly() }}
              onClick={() => setShowFreeOnly(!showFreeOnly())}
            >
              <svg
                class="routing-modal__filter-check"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <Show
                  when={showFreeOnly()}
                  fallback={<rect x="3" y="3" width="18" height="18" rx="3" stroke-width="2" />}
                >
                  <rect
                    x="3"
                    y="3"
                    width="18"
                    height="18"
                    rx="3"
                    stroke-width="2"
                    fill="currentColor"
                  />
                  <path d="m9 12 2 2 4-4" stroke="hsl(var(--card))" />
                </Show>
              </svg>
              Free models only
            </button>
          </div>
        </Show>

        <div class="routing-modal__list">
          <For each={groupedModels()}>
            {(group) => (
              <div class="routing-modal__group">
                <div class="routing-modal__group-header">
                  <span class="routing-modal__group-icon">
                    {group.provId.startsWith('custom:')
                      ? (() => {
                          const cp = (props.customProviders ?? []).find(
                            (c) => `custom:${c.id}` === group.provId,
                          );
                          return (
                            customProviderLogo(group.name, 16, cp?.base_url) ?? (
                              <span
                                class="provider-card__logo-letter"
                                style={{
                                  background: customProviderColor(group.name),
                                  width: '16px',
                                  height: '16px',
                                  'font-size': '9px',
                                  'border-radius': '50%',
                                }}
                              >
                                {group.name.charAt(0).toUpperCase()}
                              </span>
                            )
                          );
                        })()
                      : providerIcon(group.provId, 16)}
                  </span>
                  <span class="routing-modal__group-name">{group.name}</span>
                </div>
                <For each={group.models}>
                  {(model) => (
                    <button
                      class="routing-modal__model"
                      onClick={() =>
                        props.onSelect(props.tierId, model.value, group.provId, activeTab())
                      }
                    >
                      <span class="routing-modal__model-label">
                        {model.label}
                        <Show when={isRecommended(model.value)}>
                          <span class="routing-modal__recommended"> (recommended)</span>
                        </Show>
                        <Show when={modelRole(model.value)}>
                          {(role) => <span class="routing-modal__role-tag">{role()}</span>}
                        </Show>
                      </span>
                      <Show
                        when={!isSub()}
                        fallback={
                          <span class="routing-modal__model-id routing-modal__model-id--subscription">
                            Included in subscription
                          </span>
                        }
                      >
                        <Show when={model.pricing}>
                          {(p) => (
                            <span class="routing-modal__model-id">
                              {pricePerM(p().input_price_per_token)} in ·{' '}
                              {pricePerM(p().output_price_per_token)} out per 1M
                            </span>
                          )}
                        </Show>
                      </Show>
                    </button>
                  )}
                </For>
              </div>
            )}
          </For>
          <Show when={groupedModels().length === 0}>
            <div class="routing-modal__empty">
              {search().trim()
                ? 'No models match your search.'
                : showFreeOnly()
                  ? 'No free models available from your connected providers.'
                  : isSub()
                    ? 'No subscription providers connected. Connect a provider to see models.'
                    : 'No API key providers connected. Connect a provider to see models.'}
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
};

export default ModelPickerModal;
