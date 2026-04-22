import { createEffect, createSignal, onCleanup, Show, type Component } from 'solid-js';
import type {
  AuthType,
  AvailableModel,
  CustomProviderData,
  RoutingProvider,
} from '../services/api.js';
import {
  type HeaderTier,
  setHeaderTierFallbacks,
  clearHeaderTierFallbacks,
} from '../services/api/header-tiers.js';
import { providerIcon, customProviderLogo } from './ProviderIcon.js';
import { authBadgeFor } from './AuthBadge.js';
import { resolveProviderId, inferProviderFromModel, pricePerM } from '../services/routing-utils.js';
import { customProviderColor } from '../services/formatters.js';
import { PROVIDERS } from '../services/providers.js';
import FallbackList from './FallbackList.js';
import ModelPickerModal from './ModelPickerModal.js';
import HeaderTierSnippetModal from './HeaderTierSnippetModal.js';

function providerIdForModel(model: string, apiModels: AvailableModel[]): string | undefined {
  const m =
    apiModels.find((x) => x.model_name === model) ??
    apiModels.find((x) => x.model_name.startsWith(model + '-'));
  if (m) {
    const dbId = resolveProviderId(m.provider);
    if (dbId === 'ollama' || dbId === 'ollama-cloud') return dbId;
    const prefixId = inferProviderFromModel(m.model_name);
    if (prefixId && PROVIDERS.find((p) => p.id === prefixId)) return prefixId;
    return dbId ?? prefixId;
  }
  const prefix = inferProviderFromModel(model);
  if (prefix && PROVIDERS.find((p) => p.id === prefix)) return prefix;
  return undefined;
}

interface Props {
  agentName: string;
  tier: HeaderTier;
  ordinal: number;
  models: AvailableModel[];
  customProviders: CustomProviderData[];
  connectedProviders: RoutingProvider[];
  onOverride: (model: string, provider: string, authType?: AuthType) => void | Promise<void>;
  /** Clears the tier's primary model + fallbacks; surfaced via the kebab menu. */
  onReset: () => void | Promise<void>;
  /** Deletes the tier entirely; surfaced via the kebab menu (destructive). */
  onDelete: () => void | Promise<void>;
  /** Opens the shared HeaderTierModal in edit mode against this tier. */
  onEdit: () => void;
  onFallbacksUpdate: (fallbacks: string[]) => void;
}

const HeaderTierCard: Component<Props> = (props) => {
  type PickerMode = 'primary' | 'fallback' | null;
  const [pickerMode, setPickerMode] = createSignal<PickerMode>(null);
  const [snippetOpen, setSnippetOpen] = createSignal(false);
  const [kebabOpen, setKebabOpen] = createSignal(false);
  let kebabRef: HTMLDivElement | undefined;

  // Close the kebab menu when a pointerdown lands outside its container.
  createEffect(() => {
    if (!kebabOpen()) return;
    const handler = (e: PointerEvent) => {
      if (kebabRef && !kebabRef.contains(e.target as Node)) setKebabOpen(false);
    };
    document.addEventListener('pointerdown', handler, true);
    onCleanup(() => document.removeEventListener('pointerdown', handler, true));
  });

  const currentModel = (): string | null => props.tier.override_model;
  const fallbacks = (): string[] => props.tier.fallback_models ?? [];

  const providerId = (): string | undefined => {
    const m = currentModel();
    if (!m) return undefined;
    if (props.tier.override_provider) return props.tier.override_provider.toLowerCase();
    return providerIdForModel(m, props.models);
  };

  const modelInfo = (): AvailableModel | undefined => {
    const m = currentModel();
    if (!m) return undefined;
    return (
      props.models.find((x) => x.model_name === m) ??
      props.models.find((x) => x.model_name.startsWith(m + '-'))
    );
  };

  const modelLabel = (): string => modelInfo()?.display_name ?? currentModel() ?? '';

  const priceLabel = (): string => {
    const info = modelInfo();
    if (!info) return '';
    return `${pricePerM(Number(info.input_price_per_token ?? 0))} in · ${pricePerM(Number(info.output_price_per_token ?? 0))} out per 1M`;
  };

  const effectiveAuth = (): AuthType | null => {
    if (props.tier.override_auth_type) return props.tier.override_auth_type;
    const id = providerId();
    if (!id) return null;
    const provs = props.connectedProviders.filter(
      (p) => p.provider.toLowerCase() === id.toLowerCase(),
    );
    if (provs.some((p) => p.auth_type === 'subscription')) return 'subscription';
    if (provs.some((p) => p.auth_type === 'api_key')) return 'api_key';
    return null;
  };

  const customProviderForId = (id: string | undefined): CustomProviderData | undefined => {
    if (!id?.startsWith('custom:')) return undefined;
    return props.customProviders.find((p) => `custom:${p.id}` === id);
  };

  const handlePickerSelect = async (
    _tierId: string,
    model: string,
    provider: string,
    authType?: AuthType,
  ): Promise<void> => {
    const mode = pickerMode();
    setPickerMode(null);
    if (mode === 'primary') {
      await props.onOverride(model, provider, authType);
    } else if (mode === 'fallback') {
      const next = [...fallbacks(), model];
      try {
        await setHeaderTierFallbacks(props.agentName, props.tier.id, next);
        props.onFallbacksUpdate(next);
      } catch {
        // toast handled by FallbackList parent flow normally; keep silent here.
      }
    }
  };

  return (
    <div class="routing-card routing-card--header-tier">
      <div class="routing-card__header">
        <span class="routing-card__tier header-tier-card__title">
          <span class="header-tier-card__ordinal">#{props.ordinal + 1}</span>
          <span
            class="header-tier-card__dot"
            classList={{ [`tier-color--${props.tier.badge_color}`]: true }}
            aria-hidden="true"
          />
          <span class="header-tier-card__name">{props.tier.name}</span>
        </span>
        <span class="header-tier-card__actions">
          <Show when={!currentModel()}>
            <button class="routing-card__header-add" onClick={() => setPickerMode('primary')}>
              + Add model
            </button>
          </Show>
          <button
            type="button"
            class="routing-card__header-action"
            onClick={() => setSnippetOpen(true)}
            aria-label={`How to send the header for ${props.tier.name}`}
            title="How to send this header from your app"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              fill="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M9.4 16.6 4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4Zm5.2 0L19.2 12l-4.6-4.6L16 6l6 6-6 6-1.4-1.4Z" />
            </svg>
            Use
          </button>
          <button
            type="button"
            class="routing-card__header-action"
            onClick={() => props.onEdit()}
            aria-label={`Edit ${props.tier.name}`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              fill="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M3 17.46V20.5c0 .28.22.5.5.5h3.04a.5.5 0 0 0 .35-.15l10.92-10.92-3.74-3.74L3.15 17.11a.5.5 0 0 0-.15.35Zm17.71-10.21a1 1 0 0 0 0-1.41l-2.55-2.55a1 1 0 0 0-1.41 0l-1.83 1.83 3.96 3.96 1.83-1.83Z" />
            </svg>
            Edit
          </button>
          <div class="header-tier-card__kebab" ref={kebabRef}>
            <button
              type="button"
              class="header-tier-card__kebab-btn"
              aria-haspopup="menu"
              aria-expanded={kebabOpen()}
              aria-label="More actions"
              onClick={() => setKebabOpen((v) => !v)}
            >
              ⋯
            </button>
            <Show when={kebabOpen()}>
              <div class="header-tier-card__menu" role="menu">
                <Show when={currentModel()}>
                  <button
                    type="button"
                    role="menuitem"
                    class="header-tier-card__menu-item"
                    onClick={() => {
                      setKebabOpen(false);
                      props.onReset();
                    }}
                  >
                    Reset model
                  </button>
                </Show>
                <button
                  type="button"
                  role="menuitem"
                  class="header-tier-card__menu-item header-tier-card__menu-item--danger"
                  onClick={() => {
                    setKebabOpen(false);
                    if (confirm(`Delete tier "${props.tier.name}"?`)) props.onDelete();
                  }}
                >
                  Delete tier
                </button>
              </div>
            </Show>
          </div>
        </span>
      </div>

      <code
        class="header-tier-card__rule"
        title={`${props.tier.header_key}: ${props.tier.header_value}`}
      >
        {props.tier.header_key}: {props.tier.header_value}
      </code>

      <div class="routing-card__body">
        <Show when={currentModel()}>
          {(modelName) => (
            <div class="routing-card__model-chip" onClick={() => setPickerMode('primary')}>
              <div class="routing-card__chip-main">
                <div class="routing-card__override">
                  <Show
                    when={providerId()?.startsWith('custom:')}
                    fallback={
                      <Show when={providerId()}>
                        {(p) => (
                          <span class="routing-card__override-icon">
                            {providerIcon(p(), 14)}
                            {authBadgeFor(effectiveAuth(), 8)}
                          </span>
                        )}
                      </Show>
                    }
                  >
                    {(() => {
                      const cp = customProviderForId(providerId());
                      const color = customProviderColor(providerId()!.slice('custom:'.length));
                      return (
                        <span
                          class="routing-card__override-icon"
                          style={{
                            'background-color': color,
                            color: 'white',
                            display: 'inline-flex',
                            'align-items': 'center',
                            'justify-content': 'center',
                            width: '18px',
                            height: '18px',
                            'border-radius': '50%',
                            'font-size': '10px',
                            'font-weight': '600',
                          }}
                        >
                          {(() => {
                            const logo = cp ? customProviderLogo(cp.name, 14) : null;
                            return logo ?? (cp?.name ?? 'C').charAt(0).toUpperCase();
                          })()}
                        </span>
                      );
                    })()}
                  </Show>
                  <span class="routing-card__main">{modelLabel() || modelName()}</span>
                </div>
                <button
                  class="routing-card__chip-action"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPickerMode('primary');
                  }}
                  aria-label={`Change model for ${props.tier.name}`}
                >
                  <span class="routing-tooltip">Change</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="12"
                    height="12"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path d="M2.75 9h3.44c.67 0 1-.81.53-1.28l-.85-.85c.15-.18.31-.36.48-.52.73-.74 1.59-1.31 2.54-1.71 1.97-.83 4.26-.83 6.23 0 .95.4 1.81.98 2.54 1.72.74.73 1.31 1.59 1.71 2.54.3.72.5 1.46.58 2.23.05.5.48.88.99.88.6 0 1.07-.52 1-1.12-.11-.95-.35-1.88-.72-2.77-.5-1.19-1.23-2.26-2.14-3.18S17.09 3.3 15.9 2.8a10.12 10.12 0 0 0-7.79 0c-1.19.5-2.26 1.23-3.18 2.14-.17.17-.32.35-.48.52L3.28 4.29C2.81 3.82 2 4.15 2 4.82v3.44c0 .41.34.75.75.75ZM21.25 15h-3.44c-.67 0-1 .81-.53 1.28l.85.85c-.15.18-.31.36-.48.52-.73.74-1.59 1.31-2.54 1.71-1.97.83-4.26.83-6.23 0-.95-.4-1.81-.98-2.54-1.72a7.8 7.8 0 0 1-1.71-2.54c-.3-.72-.5-1.46-.58-2.23a.99.99 0 0 0-.99-.88c-.6 0-1.07.52-1 1.12.11.95.35 1.88.72 2.77.5 1.19 1.23 2.26 2.14 3.18S6.91 20.7 8.1 21.2c1.23.52 2.54.79 3.89.79s2.66-.26 3.89-.79c1.19-.5 2.26-1.23 3.18-2.14.17-.17.32-.35.48-.52l1.17 1.17c.47.47 1.28.14 1.28-.53v-3.44c0-.41-.34-.75-.75-.75Z" />
                  </svg>
                </button>
              </div>
              <div class="routing-card__chip-footer">
                <Show
                  when={effectiveAuth() !== 'subscription'}
                  fallback={<span class="routing-card__chip-price">Included in subscription</span>}
                >
                  <span class="routing-card__chip-price">{priceLabel()}</span>
                </Show>
              </div>
            </div>
          )}
        </Show>
      </div>

      <Show when={currentModel()}>
        <div class="routing-card__right">
          <FallbackList
            agentName={props.agentName}
            tier={props.tier.id}
            fallbacks={fallbacks()}
            models={props.models}
            customProviders={props.customProviders}
            connectedProviders={props.connectedProviders}
            onUpdate={(updated) => props.onFallbacksUpdate(updated)}
            onAddFallback={() => setPickerMode('fallback')}
            persistFallbacks={(_agent, tierId, models) =>
              setHeaderTierFallbacks(props.agentName, tierId, models)
            }
            persistClearFallbacks={(_agent, tierId) =>
              clearHeaderTierFallbacks(props.agentName, tierId)
            }
          />
        </div>
      </Show>

      <Show when={pickerMode() !== null}>
        <ModelPickerModal
          tierId={props.tier.id}
          models={props.models}
          tiers={[]}
          customProviders={props.customProviders}
          connectedProviders={props.connectedProviders}
          onClose={() => setPickerMode(null)}
          onSelect={handlePickerSelect}
        />
      </Show>

      <Show when={snippetOpen()}>
        <HeaderTierSnippetModal
          agentName={props.agentName}
          tier={props.tier}
          onClose={() => setSnippetOpen(false)}
        />
      </Show>
    </div>
  );
};

export default HeaderTierCard;
