import { createSignal, Show, type Component } from 'solid-js';
import { getProviderParamSpecs, type ProviderParamSpecCatalog } from 'manifest-shared';
import type { AuthType, RequestParamDefaults } from '../services/api.js';
import ModelParamsDialog from './ModelParamsDialog.jsx';

interface Props {
  provider: string | undefined;
  authType: AuthType | undefined;
  model: string;
  slotLabel: string;
  scope: string;
  specCatalog: ProviderParamSpecCatalog;
  getParams: (
    scope: string,
    provider: string,
    authType: AuthType,
    model: string,
  ) => RequestParamDefaults | null;
  setParams: (
    scope: string,
    provider: string,
    authType: AuthType,
    model: string,
    params: RequestParamDefaults | null,
  ) => Promise<unknown>;
  disabled?: boolean;
}

const ModelParamsAffordance: Component<Props> = (props) => {
  const [dialogOpen, setDialogOpen] = createSignal(false);

  const specs = () =>
    getProviderParamSpecs(props.specCatalog, props.provider, props.authType, props.model);
  const canOpen = () =>
    props.provider !== undefined && props.authType !== undefined && props.authType !== 'local';

  const current = () => {
    if (!props.provider || !props.authType) return null;
    return props.getParams(props.scope, props.provider, props.authType, props.model);
  };

  const configured = () => current() !== null;

  const requestUrl = () => {
    if (!props.provider || !props.authType) return undefined;
    const authTypeLabel = props.authType === 'subscription' ? 'Subscription' : 'API key';
    const params = new URLSearchParams({
      template: 'parameter-request.yml',
      title: `${props.provider}/${props.model}: parameter coverage`,
      provider: props.provider,
      model: props.model,
      'auth-type': authTypeLabel,
    });
    return `https://github.com/mnfst/modelparams.dev/issues/new?${params.toString()}`;
  };

  return (
    <Show when={canOpen()}>
      <button
        type="button"
        class="routing-card__chip-action"
        classList={{
          'routing-card__chip-action--configured': configured(),
          'routing-card__chip-action--dialog-open': dialogOpen(),
        }}
        onClick={(e) => {
          e.stopPropagation();
          setDialogOpen(true);
        }}
        disabled={props.disabled}
        aria-label={`Configure model parameters for ${props.slotLabel}`}
      >
        <span class="routing-tooltip">Parameters</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="12"
          height="12"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <line x1="4" y1="21" x2="4" y2="14" />
          <line x1="4" y1="10" x2="4" y2="3" />
          <line x1="12" y1="21" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12" y2="3" />
          <line x1="20" y1="21" x2="20" y2="16" />
          <line x1="20" y1="12" x2="20" y2="3" />
          <line x1="1" y1="14" x2="7" y2="14" />
          <line x1="9" y1="8" x2="15" y2="8" />
          <line x1="17" y1="16" x2="23" y2="16" />
        </svg>
      </button>
      <Show when={dialogOpen() && props.provider && props.authType}>
        <ModelParamsDialog
          open={dialogOpen()}
          slotLabel={props.slotLabel}
          current={current()}
          specs={specs()}
          requestParamsUrl={requestUrl()}
          onSave={(next) =>
            props.setParams(props.scope, props.provider!, props.authType!, props.model, next)
          }
          onClose={() => setDialogOpen(false)}
        />
      </Show>
    </Show>
  );
};

export default ModelParamsAffordance;
