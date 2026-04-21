import { createSignal, Show, type Component } from 'solid-js';
import type {
  AuthType,
  AvailableModel,
  CustomProviderData,
  RoutingProvider,
} from '../services/api.js';
import type { HeaderTier } from '../services/api/header-tiers.js';
import { providerIcon, customProviderLogo } from './ProviderIcon.js';
import { authBadgeFor } from './AuthBadge.js';
import { resolveProviderId, inferProviderFromModel, pricePerM } from '../services/routing-utils.js';
import { customProviderColor } from '../services/formatters.js';
import { PROVIDERS } from '../services/providers.js';
import ModelPickerModal from './ModelPickerModal.js';

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
  tier: HeaderTier;
  ordinal: number;
  models: AvailableModel[];
  customProviders: CustomProviderData[];
  connectedProviders: RoutingProvider[];
  onOverride: (model: string, provider: string, authType?: AuthType) => void | Promise<void>;
  onReset: () => void | Promise<void>;
  onDelete: () => void | Promise<void>;
}

const HeaderTierCard: Component<Props> = (props) => {
  const [pickerOpen, setPickerOpen] = createSignal(false);
  const [kebabOpen, setKebabOpen] = createSignal(false);

  const currentModel = (): string | null => props.tier.override_model;
  const providerId = (): string | undefined => {
    const m = currentModel();
    if (!m) return undefined;
    if (props.tier.override_provider) return props.tier.override_provider.toLowerCase();
    return providerIdForModel(m, props.models);
  };
  const modelLabel = (): string => {
    const m = currentModel();
    if (!m) return '';
    const row = props.models.find((x) => x.model_name === m);
    return row?.display_name ?? m;
  };
  const priceBadge = (): string | null => {
    const m = currentModel();
    if (!m) return null;
    const row = props.models.find((x) => x.model_name === m);
    if (!row) return null;
    return pricePerM(Number(row.input_price_per_token ?? 0));
  };

  return (
    <div class="header-tier-card" data-ordinal={props.ordinal}>
      <span class="header-tier-card__ordinal">#{props.ordinal + 1}</span>
      <span
        class="header-tier-card__dot"
        classList={{ [`tier-color--${props.tier.badge_color}`]: true }}
        aria-hidden="true"
      />
      <div class="header-tier-card__name">{props.tier.name}</div>
      <code
        class="header-tier-card__rule"
        title={`${props.tier.header_key}: ${props.tier.header_value}`}
      >
        {props.tier.header_key}: {props.tier.header_value}
      </code>

      <div class="header-tier-card__model-slot">
        <Show
          when={currentModel()}
          fallback={
            <button type="button" class="header-tier-card__add" onClick={() => setPickerOpen(true)}>
              + Add model
            </button>
          }
        >
          <button
            type="button"
            class="header-tier-card__model"
            onClick={() => setPickerOpen(true)}
            title="Change model"
          >
            <Show when={providerId() && !providerId()!.startsWith('custom:')}>
              <span class="header-tier-card__provider-icon">{providerIcon(providerId()!, 16)}</span>
            </Show>
            <Show when={providerId()?.startsWith('custom:')}>
              <span
                class="header-tier-card__provider-icon"
                style={{
                  'background-color': customProviderColor(providerId()!.slice('custom:'.length)),
                }}
              >
                {customProviderLogo(
                  props.customProviders.find((p) => `custom:${p.id}` === providerId())?.name ?? '?',
                  16,
                )}
              </span>
            </Show>
            <span class="header-tier-card__model-name">{modelLabel()}</span>
            <Show when={priceBadge()}>
              <span class="header-tier-card__price">{priceBadge()}</span>
            </Show>
            <Show when={props.tier.override_auth_type}>
              {authBadgeFor(props.tier.override_auth_type, 12)}
            </Show>
          </button>
        </Show>
      </div>

      <div class="header-tier-card__actions">
        <Show when={currentModel()}>
          <button
            type="button"
            class="header-tier-card__action-btn"
            onClick={() => props.onReset()}
            title="Remove model"
          >
            Reset
          </button>
        </Show>
        <div class="header-tier-card__kebab">
          <button
            type="button"
            class="header-tier-card__action-btn"
            aria-haspopup="menu"
            aria-expanded={kebabOpen()}
            aria-label="More actions"
            onClick={() => setKebabOpen((v) => !v)}
          >
            ⋯
          </button>
          <Show when={kebabOpen()}>
            <div
              class="header-tier-card__menu"
              role="menu"
              // Close the menu when focus leaves it so blur doesn't need to
              // race with the menu item's own click handler.
              onFocusOut={(e) => {
                const next = e.relatedTarget as HTMLElement | null;
                if (!e.currentTarget.contains(next)) setKebabOpen(false);
              }}
            >
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
      </div>

      <Show when={pickerOpen()}>
        <ModelPickerModal
          tierId={props.tier.id}
          models={props.models}
          tiers={[]}
          customProviders={props.customProviders}
          connectedProviders={props.connectedProviders}
          onClose={() => setPickerOpen(false)}
          onSelect={async (_tierId, model, provider, authType) => {
            await props.onOverride(model, provider, authType);
            setPickerOpen(false);
          }}
        />
      </Show>
    </div>
  );
};

export default HeaderTierCard;
