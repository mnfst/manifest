import { For, Show, createMemo, type Component } from 'solid-js';
import { PROVIDERS } from '../services/providers.js';
import { providerIcon, customProviderLogo } from '../components/ProviderIcon.js';
import { customProviderColor } from '../services/formatters.js';
import { authBadgeFor, authLabel } from '../components/AuthBadge.js';
import type { RoutingProvider, CustomProviderData } from '../services/api.js';

/** Skeleton placeholder rendered while routing data is loading. */
export const RoutingLoadingSkeleton: Component = () => (
  <>
    {/* Connections row */}
    <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 20px;">
      <div class="skeleton" style="width: 16px; height: 16px; border-radius: 50%;" />
      <div class="skeleton" style="width: 16px; height: 16px; border-radius: 50%;" />
      <div class="skeleton" style="width: 16px; height: 16px; border-radius: 50%;" />
      <div class="skeleton skeleton--text" style="width: 90px; margin-left: 4px;" />
    </div>

    {/* Tabs */}
    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
      <div class="skeleton" style="width: 76px; height: 30px; border-radius: var(--radius);" />
      <div class="skeleton" style="width: 96px; height: 30px; border-radius: var(--radius);" />
      <div class="skeleton" style="width: 68px; height: 30px; border-radius: var(--radius);" />
    </div>

    {/* Description + toggle */}
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;">
      <div class="skeleton skeleton--text" style="width: 260px;" />
      <div class="skeleton" style="width: 44px; height: 22px; border-radius: 11px;" />
    </div>

    {/* 4-column card grid */}
    <div class="routing-cards">
      <For each={[0, 1, 2, 3]}>
        {() => (
          <div class="routing-card">
            {/* Tier name */}
            <div style="padding: 12px 16px 10px;">
              <div class="skeleton skeleton--text" style="width: 65px; height: 15px;" />
            </div>

            {/* Primary model chip — full-width skeleton block */}
            <div style="margin: 0 12px 8px; padding: 10px 12px; border-radius: var(--radius); background: hsl(var(--muted-foreground) / 0.08);">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <div
                  class="skeleton"
                  style="width: 14px; height: 14px; border-radius: 50%; flex-shrink: 0;"
                />
                <div class="skeleton skeleton--text" style="width: 120px;" />
              </div>
              <div class="skeleton skeleton--text" style="width: 160px; height: 12px;" />
            </div>

            {/* Fallback rows — each is a skeleton row block */}
            <div style="padding: 0 12px; display: flex; flex-direction: column; gap: 6px;">
              <For each={[0, 1, 2, 3]}>
                {() => (
                  <div style="display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: var(--radius); background: hsl(var(--muted-foreground) / 0.08);">
                    <div
                      class="skeleton"
                      style="width: 14px; height: 14px; border-radius: 50%; flex-shrink: 0;"
                    />
                    <div class="skeleton skeleton--text" style="width: 90px;" />
                  </div>
                )}
              </For>
            </div>

            {/* Add fallback button */}
            <div style="padding: 10px 12px 14px;">
              <div
                class="skeleton"
                style="width: 110px; height: 28px; border-radius: var(--radius);"
              />
            </div>
          </div>
        )}
      </For>
    </div>

    {/* Footer */}
    <div class="routing-footer">
      <div class="skeleton" style="width: 105px; height: 32px; border-radius: var(--radius);" />
      <div style="flex: 1;" />
      <div class="skeleton skeleton--text" style="width: 115px;" />
    </div>
  </>
);

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
                      {keyCount} {authLabel(group.auth_type)} keys
                    </strong>
                    <For each={group.keys}>{(k) => <span>{k.label || 'Default'}</span>}</For>
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
        {props.activeProviders().length} connection
        {props.activeProviders().length !== 1 ? 's' : ''}
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
        {props.resettingAll() ? <span class="spinner" /> : 'Reset all to auto'}
      </button>
    </Show>
    <div style="flex: 1;" />
    <Show when={props.onShowHowRoutingWorks}>
      <button class="routing-footer__instructions" onClick={() => props.onShowHowRoutingWorks?.()}>
        How routing works
      </button>
      <span class="routing-footer__sep">|</span>
    </Show>
    <button class="routing-footer__instructions" onClick={() => props.onShowInstructions()}>
      Setup instructions
    </button>
  </div>
);
