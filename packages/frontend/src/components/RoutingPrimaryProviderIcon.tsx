import { Show, type Component } from 'solid-js';
import type { AuthType, CustomProviderData } from '../services/api.js';
import { providerIcon, customProviderLogo } from './ProviderIcon.js';
import { authBadgeFor } from './AuthBadge.js';
import { customProviderColor } from '../services/formatters.js';

interface Props {
  providerId: () => string | undefined;
  modelName: () => string;
  customProviders: CustomProviderData[];
  effectiveAuth: () => AuthType | null;
}

const RoutingPrimaryProviderIcon: Component<Props> = (props) => (
  <Show
    when={props.providerId()?.startsWith('custom:')}
    fallback={
      <Show when={props.providerId()}>
        {(p) => (
          <span class="routing-card__override-icon">
            {providerIcon(p(), 14)}
            {authBadgeFor(props.effectiveAuth(), 8)}
          </span>
        )}
      </Show>
    }
  >
    {(() => {
      const cp = () => props.customProviders.find((c) => `custom:${c.id}` === props.providerId());
      const logo = () => {
        const c = cp();
        return c ? customProviderLogo(c.name, 14, c.base_url, props.modelName()) : null;
      };
      return (
        <span class="routing-card__override-icon">
          <Show
            when={logo()}
            fallback={
              <span
                class="provider-card__logo-letter"
                style={{
                  background: customProviderColor(cp()?.name ?? 'C'),
                  width: '14px',
                  height: '14px',
                  'font-size': '8px',
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
    })()}
  </Show>
);

export default RoutingPrimaryProviderIcon;
