import { For, Show, createMemo, type Component } from 'solid-js';
import { PROVIDERS } from '../services/providers.js';
import { providerIcon, customProviderLogo } from '../components/ProviderIcon.js';
import { customProviderColor } from '../services/formatters.js';
import { authBadgeFor, authLabel } from '../components/AuthBadge.js';
import type { RoutingProvider, CustomProviderData } from '../services/api.js';
import { t, tp } from '../i18n/index.js';

/** Skeleton placeholder rendered while routing data is loading. */
export const RoutingLoadingSkeleton: Component = () => {
  const bar =
    'background: hsl(var(--muted) / 0.45); border-radius: var(--radius); animation: skeleton-pulse 1.2s ease-in-out infinite;';
  return (
    <>
      {/* Provider icons + buttons row */}
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
        <div style={`width: 160px; height: 20px; ${bar}`} />
        <div style="display: flex; gap: 8px;">
          <div style={`width: 110px; height: 32px; ${bar}`} />
          <div style={`width: 170px; height: 32px; ${bar}`} />
        </div>
      </div>

      {/* Tabs row */}
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
        <div style={`width: 260px; height: 34px; ${bar}`} />
        <div
          style={`width: 140px; height: 22px; border-radius: 11px; background: hsl(var(--muted) / 0.45); animation: skeleton-pulse 1.2s ease-in-out infinite;`}
        />
      </div>

      {/* Description line */}
      <div style={`width: 320px; height: 14px; margin-bottom: 16px; ${bar}`} />

      {/* Content rectangle */}
      <div style={`width: 100%; height: 300px; ${bar}`} />
    </>
  );
};

export interface ActiveProviderIconsProps {
  activeProviders: () => RoutingProvider[];
  customProviders: () => CustomProviderData[];
}

interface ProviderGroup {
  provider: string;
  auth_type: string;
  keys: RoutingProvider[];
}

/** Renders the provider icons row and connection count above the tier cards. */
export const ActiveProviderIcons: Component<ActiveProviderIconsProps> = (props) => {
  const grouped = createMemo<ProviderGroup[]>(() => {
    const map = new Map<string, ProviderGroup>();
    for (const prov of props.activeProviders()) {
      const key = `${prov.provider}::${prov.auth_type}`;
      const existing = map.get(key);
      if (existing) {
        existing.keys.push(prov);
      } else {
        map.set(key, { provider: prov.provider, auth_type: prov.auth_type, keys: [prov] });
      }
    }
    return [...map.values()];
  });

  return (
    <div class="routing-providers-info">
      <span class="routing-providers-info__icons">
        <For each={grouped()}>
          {(group) => {
            if (group.provider.startsWith('custom:')) {
              const cp = createMemo(() =>
                props.customProviders()?.find((c) => `custom:${c.id}` === group.provider),
              );
              const logo = createMemo(() => {
                const c = cp();
                return c ? customProviderLogo(c.name, 16, c.base_url) : null;
              });
              return (
                <span class="routing-providers-info__icon" title={cp()?.name ?? group.provider}>
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
            const provDef = PROVIDERS.find((p) => p.id === group.provider);
            const provName = provDef?.name ?? group.provider;
            const keyCount = group.keys.length;
            return (
              <span class="routing-providers-info__icon routing-providers-info__icon--has-tooltip">
                {providerIcon(group.provider, 16)}
                {authBadgeFor(group.auth_type, 12)}
                <Show when={keyCount > 1}>
                  <span class="routing-providers-info__tooltip">
                    <strong>
                      {t('pages.routing.providerKeys', {
                        count: keyCount,
                        authType: authLabel(group.auth_type),
                      })}
                    </strong>
                    <For each={group.keys}>
                      {(k) => <span>{k.label || t('pages.routing.defaultKey')}</span>}
                    </For>
                  </span>
                </Show>
                <Show when={keyCount === 1}>
                  <span class="routing-providers-info__tooltip">
                    <strong>{provName}</strong>
                    <span>{authLabel(group.auth_type)}</span>
                  </span>
                </Show>
              </span>
            );
          }}
        </For>
      </span>
      <span class="routing-providers-info__label">
        {tp('pages.routing.connectionCount', props.activeProviders().length)}
      </span>
    </div>
  );
};

export interface RoutingFooterProps {
  hasOverrides: () => boolean;
  resettingAll: () => boolean;
  resettingTier: () => string | null;
  onResetAll: () => void;
  onShowInstructions: () => void;
  onShowHowRoutingWorks?: () => void;
}

/** Footer bar with reset-all and setup instructions buttons. */
export const RoutingFooter: Component<RoutingFooterProps> = (props) => (
  <div class="routing-footer">
    <Show when={props.hasOverrides()}>
      <button
        class="btn btn--outline btn--sm"
        onClick={() => props.onResetAll()}
        disabled={props.resettingAll() || props.resettingTier() !== null}
      >
        {props.resettingAll() ? <span class="spinner" /> : t('pages.routing.resetAll')}
      </button>
    </Show>
    <div style="flex: 1;" />
    <Show when={props.onShowHowRoutingWorks}>
      <button class="routing-footer__instructions" onClick={() => props.onShowHowRoutingWorks?.()}>
        {t('pages.routing.howItWorks')}
      </button>
      <span class="routing-footer__sep">|</span>
    </Show>
    <button class="routing-footer__instructions" onClick={() => props.onShowInstructions()}>
      {t('pages.routing.setupInstructions')}
    </button>
  </div>
);
