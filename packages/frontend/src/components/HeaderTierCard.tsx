import { createSignal, Show, type Component } from 'solid-js';
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
  models: AvailableModel[];
  customProviders: CustomProviderData[];
  connectedProviders: RoutingProvider[];
  onOverride: (model: string, provider: string, authType?: AuthType) => void | Promise<void>;
  onFallbacksUpdate: (fallbacks: string[]) => void;
}

const HeaderTierCard: Component<Props> = (props) => {
  type PickerMode = 'primary' | 'fallback' | null;
  const [pickerMode, setPickerMode] = createSignal<PickerMode>(null);
  const [snippetOpen, setSnippetOpen] = createSignal(false);

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
          <span class="header-tier-card__name">{props.tier.name}</span>
          <button
            type="button"
            class="header-tier-card__icon-btn"
            onClick={() => setSnippetOpen(true)}
            aria-label={`How to send the header for ${props.tier.name}`}
            title="How to send this header from your app"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              fill="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4m0 6c-1.08 0-2-.92-2-2s.92-2 2-2 2 .92 2 2-.92 2-2 2" />
              <path d="m20.42 13.4-.51-.29c.05-.37.08-.74.08-1.11s-.03-.74-.08-1.11l.51-.29c.96-.55 1.28-1.78.73-2.73l-1-1.73a2.006 2.006 0 0 0-2.73-.73l-.53.31c-.58-.46-1.22-.83-1.9-1.11v-.6c0-1.1-.9-2-2-2h-2c-1.1 0-2 .9-2 2v.6c-.67.28-1.31.66-1.9 1.11l-.53-.31c-.96-.55-2.18-.22-2.73.73l-1 1.73c-.55.96-.22 2.18.73 2.73l.51.29c-.05.37-.08.74-.08 1.11s.03.74.08 1.11l-.51.29c-.96.55-1.28 1.78-.73 2.73l1 1.73c.55.95 1.78 1.28 2.73.73l.53-.31c.58.46 1.22.83 1.9 1.11v.6c0 1.1.9 2 2 2h2c1.1 0 2-.9 2-2v-.6a8.7 8.7 0 0 0 1.9-1.11l.53.31c.95.55 2.18.22 2.73-.73l1-1.73c.55-.96.22-2.18-.73-2.73m-2.59-2.78c.11.45.17.92.17 1.38s-.06.92-.17 1.38a1 1 0 0 0 .47 1.11l1.12.65-1 1.73-1.14-.66c-.38-.22-.87-.16-1.19.14-.68.65-1.51 1.13-2.38 1.4-.42.13-.71.52-.71.96v1.3h-2v-1.3c0-.44-.29-.83-.71-.96-.88-.27-1.7-.75-2.38-1.4a1.01 1.01 0 0 0-1.19-.15l-1.14.66-1-1.73 1.12-.65c.39-.22.58-.68.47-1.11-.11-.45-.17-.92-.17-1.38s.06-.93.17-1.38A1 1 0 0 0 5.7 9.5l-1.12-.65 1-1.73 1.14.66c.38.22.87.16 1.19-.14.68-.65 1.51-1.13 2.38-1.4.42-.13.71-.52.71-.96v-1.3h2v1.3c0 .44.29.83.71.96.88.27 1.7.75 2.38 1.4.32.31.81.36 1.19.14l1.14-.66 1 1.73-1.12.65c-.39.22-.58.68-.47 1.11Z" />
            </svg>
          </button>
        </span>
        <Show when={!currentModel()}>
          <button class="routing-card__header-add" onClick={() => setPickerMode('primary')}>
            + Add model
          </button>
        </Show>
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
