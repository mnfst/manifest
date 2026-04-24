import { For, Show, createMemo, type Component } from 'solid-js';
import { STAGES, PROVIDERS } from '../services/providers.js';
import { providerIcon, customProviderLogo } from '../components/ProviderIcon.js';
import { customProviderColor } from '../services/formatters.js';
import { authBadgeFor } from '../components/AuthBadge.js';
import type { RoutingProvider, CustomProviderData } from '../services/api.js';

/** Skeleton placeholder rendered while providers are loading with cached data visible. */
export const RoutingLoadingSkeleton: Component = () => (
  <>
    <div class="routing-providers-info">
      <span class="routing-providers-info__icons">
        <span class="routing-providers-info__icon">
          <div class="skeleton" style="width: 16px; height: 16px; border-radius: 50%;" />
        </span>
        <span class="routing-providers-info__icon">
          <div class="skeleton" style="width: 16px; height: 16px; border-radius: 50%;" />
        </span>
      </span>
      <span class="routing-providers-info__label">
        <div class="skeleton skeleton--text" style="width: 80px;" />
      </span>
    </div>
    <div class="routing-cards">
      <For each={STAGES}>
        {(stage) => (
          <div class="routing-card">
            <div class="routing-card__header">
              <span class="routing-card__tier">{stage.label}</span>
              <span class="routing-card__desc">{stage.desc}</span>
            </div>
            <div class="routing-card__body">
              <div class="routing-card__override">
                <span class="routing-card__override-icon">
                  <div class="skeleton" style="width: 16px; height: 16px; border-radius: 50%;" />
                </span>
                <div class="skeleton skeleton--text" style="width: 140px; height: 14px;" />
              </div>
              <div
                class="skeleton skeleton--text"
                style="width: 200px; height: 12px; margin-top: 6px;"
              />
            </div>
            <div class="routing-card__right">
              <div class="routing-card__actions">
                <div class="skeleton skeleton--text" style="width: 50px; height: 14px;" />
              </div>
            </div>
          </div>
        )}
      </For>
    </div>
    <div class="routing-footer">
      <div
        class="skeleton skeleton--text"
        style="width: 120px; height: 32px; border-radius: var(--radius);"
      />
      <div style="flex: 1;" />
      <div class="skeleton skeleton--text" style="width: 130px; height: 14px;" />
    </div>
  </>
);

export interface EnableRoutingCardProps {
  onEnable: () => void;
}

/** CTA card shown when routing is not yet enabled. */
export const EnableRoutingCard: Component<EnableRoutingCardProps> = (props) => (
  <div class="routing-enable-card">
    <div class="routing-enable-card__icon">
      <svg
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    </div>
    <h2 class="routing-enable-card__title">Smart model routing</h2>
    <p class="routing-enable-card__desc">
      Route each request to the right model based on complexity, task type, or custom rules. Connect
      your LLM providers to get started.
    </p>
    <button class="btn btn--primary" onClick={() => props.onEnable()}>
      Enable Routing
    </button>
  </div>
);

export interface ActiveProviderIconsProps {
  activeProviders: () => RoutingProvider[];
  customProviders: () => CustomProviderData[];
}

/** Renders the provider icons row and connection count above the tier cards. */
export const ActiveProviderIcons: Component<ActiveProviderIconsProps> = (props) => (
  <div class="routing-providers-info">
    <span class="routing-providers-info__icons">
      <For each={props.activeProviders()}>
        {(prov) => {
          if (prov.provider.startsWith('custom:')) {
            const cp = createMemo(() =>
              props.customProviders()?.find((c) => `custom:${c.id}` === prov.provider),
            );
            const logo = createMemo(() => {
              const c = cp();
              return c ? customProviderLogo(c.name, 16, c.base_url) : null;
            });
            return (
              <span class="routing-providers-info__icon" title={cp()?.name ?? prov.provider}>
                <Show
                  when={logo()}
                  fallback={
                    <span
                      class="provider-card__logo-letter"
                      style={{
                        background: customProviderColor(cp()?.name ?? 'C'),
                        width: '16px',
                        height: '16px',
                        'font-size': '9px',
                        'border-radius': '50%',
                      }}
                    >
                      {(cp()?.name ?? 'C').charAt(0).toUpperCase()}
                    </span>
                  }
                >
                  {logo()}
                </Show>
              </span>
            );
          }
          const provDef = PROVIDERS.find((p) => p.id === prov.provider);
          const authLabel = prov.auth_type === 'subscription' ? 'Subscription' : 'API Key';
          return (
            <span
              class="routing-providers-info__icon"
              title={`${provDef?.name ?? prov.provider} (${authLabel})`}
            >
              {providerIcon(prov.provider, 16)}
              {authBadgeFor(prov.auth_type, 12)}
            </span>
          );
        }}
      </For>
    </span>
    <span class="routing-providers-info__label">
      {props.activeProviders().length} connection
      {props.activeProviders().length !== 1 ? 's' : ''}
    </span>
  </div>
);

export interface RoutingFooterProps {
  disabling: () => boolean;
  hasOverrides: () => boolean;
  resettingAll: () => boolean;
  resettingTier: () => string | null;
  onDisable: () => void;
  onResetAll: () => void;
  onShowInstructions: () => void;
}

/** Footer bar with disable, reset-all, and setup instructions buttons. */
export const RoutingFooter: Component<RoutingFooterProps> = (props) => (
  <div class="routing-footer">
    <button
      class="routing-disable-btn"
      onClick={() => props.onDisable()}
      disabled={props.disabling()}
    >
      {props.disabling() ? <span class="spinner" /> : 'Disable Routing'}
    </button>
    <Show when={props.hasOverrides()}>
      <button
        class="btn btn--outline"
        style="font-size: var(--font-size-sm);"
        onClick={() => props.onResetAll()}
        disabled={props.resettingAll() || props.resettingTier() !== null}
      >
        {props.resettingAll() ? <span class="spinner" /> : 'Reset all to auto'}
      </button>
    </Show>
    <div style="flex: 1;" />
    <button class="routing-footer__instructions" onClick={() => props.onShowInstructions()}>
      Setup instructions
    </button>
  </div>
);

export interface DisableRoutingModalProps {
  open: boolean;
  disabling: () => boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/** Confirmation dialog shown before deactivating all routing providers. */
export const DisableRoutingModal: Component<DisableRoutingModalProps> = (props) => (
  <Show when={props.open}>
    <div
      class="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onCancel();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') props.onCancel();
      }}
    >
      <div
        class="modal-card"
        style="max-width: 420px;"
        role="dialog"
        aria-modal="true"
        aria-labelledby="disable-routing-modal-title"
      >
        <h2
          id="disable-routing-modal-title"
          style="margin: 0 0 12px; font-size: var(--font-size-lg); font-weight: 600;"
        >
          Disable routing?
        </h2>
        <p style="margin: 0 0 20px; font-size: var(--font-size-sm); color: hsl(var(--muted-foreground)); line-height: 1.5;">
          All provider API keys and tier-to-model assignments will be permanently removed. If you
          re-enable routing later, you will need to reconnect your providers and reconfigure each
          tier.
        </p>
        <div style="display: flex; justify-content: flex-end; gap: 8px;">
          <button class="btn btn--outline" onClick={() => props.onCancel()}>
            Cancel
          </button>
          <button
            class="btn btn--danger"
            disabled={props.disabling()}
            onClick={() => props.onConfirm()}
          >
            {props.disabling() ? <span class="spinner" /> : 'Disable'}
          </button>
        </div>
      </div>
    </div>
  </Show>
);
