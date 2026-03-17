import { For, type Component, type Accessor } from 'solid-js';
import type { ProviderDef } from '../services/providers.js';
import { providerIcon } from './ProviderIcon.js';
import type { AuthType } from '../services/api.js';

interface Props {
  subscriptionProviders: ProviderDef[];
  busy: Accessor<boolean>;
  isSubscriptionConnected: (provId: string) => boolean;
  isSubscriptionWithToken: (provId: string) => boolean;
  onOpenDetail: (provId: string, authType: AuthType) => void;
  onToggle: (provId: string) => void;
}

const ProviderSubscriptionTab: Component<Props> = (props) => {
  const getSubscriptionAuthMode = (prov: ProviderDef) =>
    prov.subscriptionAuthMode ??
    (prov.subscriptionOAuth ? 'popup_oauth' : undefined) ??
    (prov.subscriptionKeyPlaceholder ? 'token' : undefined);

  return (
    <>
      <div class="provider-modal__tab-hint">
        Use your existing subscription instead of an API key. Connect via OpenClaw or paste a
        setup-token.
      </div>
      <div class="provider-modal__list">
        <For each={props.subscriptionProviders}>
          {(prov) => {
            const hasDetailView = () =>
              !!prov.subscriptionKeyPlaceholder ||
              !!prov.subscriptionCommand ||
              !!getSubscriptionAuthMode(prov);
            const requiresStoredToken = () => getSubscriptionAuthMode(prov) === 'token';
            const connected = () =>
              requiresStoredToken()
                ? props.isSubscriptionWithToken(prov.id)
                : props.isSubscriptionConnected(prov.id);

            return (
              <button
                class="provider-toggle"
                disabled={props.busy()}
                onClick={() =>
                  hasDetailView()
                    ? props.onOpenDetail(prov.id, 'subscription')
                    : props.onToggle(prov.id)
                }
              >
                <span class="provider-toggle__icon">
                  {providerIcon(prov.id, 20) ?? (
                    <span class="provider-card__logo-letter" style={{ background: prov.color }}>
                      {prov.initial}
                    </span>
                  )}
                </span>
                <span class="provider-toggle__info">
                  <span class="provider-toggle__name">{prov.name}</span>
                  <span class="provider-toggle__local-only">
                    {prov.subscriptionLabel ?? 'Subscription'}
                  </span>
                </span>
                <span
                  class="provider-toggle__switch"
                  classList={{ 'provider-toggle__switch--on': connected() }}
                >
                  <span class="provider-toggle__switch-thumb" />
                </span>
              </button>
            );
          }}
        </For>
        <a
          class="provider-modal__request-link"
          href="https://github.com/mnfst/manifest/discussions/973"
          target="_blank"
          rel="noopener noreferrer"
        >
          Request new subscription model
        </a>
      </div>
    </>
  );
};

export default ProviderSubscriptionTab;
