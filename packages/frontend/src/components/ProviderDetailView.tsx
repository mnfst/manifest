import { Show, type Component, type Accessor, type Setter } from 'solid-js';
import { PROVIDERS } from '../services/providers.js';
import { providerIcon } from './ProviderIcon.js';
import {
  connectProvider,
  disconnectProvider,
  revokeOpenaiOAuth,
  type RoutingProvider,
  type AuthType,
} from '../services/api.js';
import { toast } from '../services/toast-store.js';
import { CopyButton } from './SetupStepInstall.js';
import ProviderKeyForm from './ProviderKeyForm.js';
import OAuthDetailView from './OAuthDetailView.js';
import DeviceCodeDetailView from './DeviceCodeDetailView.js';

export interface ProviderDetailViewProps {
  provId: string;
  agentName: string;
  providers: RoutingProvider[];
  selectedAuthType: Accessor<AuthType>;
  busy: Accessor<boolean>;
  setBusy: Setter<boolean>;
  keyInput: Accessor<string>;
  setKeyInput: Setter<string>;
  editing: Accessor<boolean>;
  setEditing: Setter<boolean>;
  validationError: Accessor<string | null>;
  setValidationError: Setter<string | null>;
  onBack: () => void;
  onUpdate: () => void;
  onClose: () => void;
}

const ProviderDetailView: Component<ProviderDetailViewProps> = (props) => {
  const provDef = PROVIDERS.find((p) => p.id === props.provId)!;

  const getProviderByAuth = (authType: AuthType) =>
    props.providers.find((p) => p.provider === props.provId && p.auth_type === authType);

  const isConnectedApiKey = (): boolean => {
    const p = getProviderByAuth('api_key');
    return !!p && p.is_active && p.has_api_key;
  };

  const isSubscriptionConnected = (): boolean => {
    const p = getProviderByAuth('subscription');
    return !!p && p.is_active;
  };

  const isSubscriptionWithToken = (): boolean => {
    const p = getProviderByAuth('subscription');
    return !!p && p.is_active && p.has_api_key;
  };

  const isNoKeyConnected = (): boolean => {
    const p = getProviderByAuth('api_key');
    return !!p && p.is_active && !!provDef.noKeyRequired;
  };

  const getKeyPrefixDisplay = (authType: AuthType): string => {
    const p = getProviderByAuth(authType);
    if (p?.key_prefix) return `${p.key_prefix}${'•'.repeat(8)}`;
    return '••••••••••••';
  };

  const isSubMode = () => props.selectedAuthType() === 'subscription';
  const subscriptionAuthMode = () =>
    provDef.subscriptionAuthMode ??
    (provDef.subscriptionOAuth ? 'popup_oauth' : undefined) ??
    (provDef.subscriptionKeyPlaceholder ? 'token' : undefined);
  const isPopupOAuthFlow = () => isSubMode() && subscriptionAuthMode() === 'popup_oauth';
  const isDeviceCodeFlow = () => isSubMode() && subscriptionAuthMode() === 'device_code';
  const shouldRevokeOpenaiOAuth = () => props.provId === 'openai' && isPopupOAuthFlow();
  const isCommandOnly = () =>
    isSubMode() &&
    !!provDef.subscriptionCommand &&
    !provDef.subscriptionKeyPlaceholder &&
    !subscriptionAuthMode();
  const connected = () =>
    isSubMode()
      ? isCommandOnly()
        ? isSubscriptionConnected()
        : subscriptionAuthMode() === 'token'
          ? isSubscriptionWithToken()
          : isSubscriptionConnected()
      : isConnectedApiKey() || isNoKeyConnected();
  const isOllama = provDef.noKeyRequired;

  const handleOllamaConnect = async () => {
    props.setBusy(true);
    try {
      await connectProvider(props.agentName, {
        provider: props.provId,
        authType: props.selectedAuthType(),
      });
      toast.success(`${provDef.name} connected`);
      props.onBack();
      props.onUpdate();
    } catch {
      // error toast from fetchMutate
    } finally {
      props.setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    props.setBusy(true);
    try {
      if (shouldRevokeOpenaiOAuth()) {
        await revokeOpenaiOAuth(props.agentName).catch(() => {});
      }
      const result = await disconnectProvider(
        props.agentName,
        props.provId,
        props.selectedAuthType(),
      );
      if (result?.notifications?.length) {
        for (const msg of result.notifications) {
          toast.error(msg);
        }
      }
      props.onBack();
      props.onUpdate();
    } catch {
      // error toast from fetchMutate
    } finally {
      props.setBusy(false);
    }
  };

  return (
    <div class="provider-detail">
      {/* Back arrow */}
      <button class="provider-detail__back" onClick={props.onBack} aria-label="Back to providers">
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
          <path d="m15 18-6-6 6-6" />
        </svg>
      </button>

      {/* Title */}
      <div class="routing-modal__header" style="border: none; padding: 0; margin-bottom: 20px;">
        <div>
          <div class="routing-modal__title">Connect providers</div>
          <div class="routing-modal__subtitle">
            {isSubMode()
              ? isPopupOAuthFlow()
                ? 'Log in to connect your subscription'
                : isDeviceCodeFlow()
                  ? 'Verify your account to connect your subscription'
                : isCommandOnly()
                  ? 'Log in via your browser to connect your subscription'
                  : 'Paste your setup-token to enable routing'
              : 'Add your API keys to enable routing through each provider'}
          </div>
        </div>
      </div>

      {/* Provider row */}
      <div class="provider-detail__header">
        <span class="provider-detail__icon">
          {providerIcon(props.provId, 28) ?? (
            <span
              class="provider-card__logo-letter"
              style={{
                background: provDef.color,
                width: '32px',
                height: '32px',
                'font-size': '13px',
              }}
            >
              {provDef.initial}
            </span>
          )}
        </span>
        <div class="provider-detail__title-group">
          <div class="provider-detail__name">{provDef.name}</div>
        </div>
      </div>

      {/* Subscription terminal instruction */}
      <Show when={isSubMode() && provDef.subscriptionCommand}>
        <p class="provider-detail__hint">
          {isCommandOnly()
            ? 'Run the command below to log in via your browser.'
            : 'Run the command below, then paste the token.'}
        </p>
        <div class="modal-terminal">
          <div class="modal-terminal__header">
            <div class="modal-terminal__dots">
              <span class="modal-terminal__dot modal-terminal__dot--red" />
              <span class="modal-terminal__dot modal-terminal__dot--yellow" />
              <span class="modal-terminal__dot modal-terminal__dot--green" />
            </div>
            <div class="modal-terminal__tabs">
              <span class="modal-terminal__tab modal-terminal__tab--active">Terminal</span>
            </div>
          </div>
          <div class="modal-terminal__body">
            <CopyButton text={provDef.subscriptionCommand!} />
            <div>
              <span class="modal-terminal__prompt">$</span>
              <span class="modal-terminal__code">{provDef.subscriptionCommand}</span>
            </div>
          </div>
        </div>
      </Show>

      {/* Command-only subscription */}
      <Show when={isCommandOnly()}>
        <p class="provider-detail__hint" style="margin-top: 16px;">
          A browser window will open for you to log in. Once authenticated, the connection will be
          detected automatically.
        </p>
        <Show when={connected()}>
          <button
            class="btn btn--outline provider-detail__action provider-detail__disconnect"
            disabled={props.busy()}
            onClick={handleDisconnect}
          >
            <Show when={!props.busy()} fallback={<span class="spinner" />}>
              Disconnect
            </Show>
          </button>
        </Show>
        <Show when={!connected()}>
          <button class="btn btn--primary provider-detail__action" onClick={props.onBack}>
            Done
          </button>
        </Show>
      </Show>

      {/* OAuth subscription */}
      <Show when={isPopupOAuthFlow()}>
        <OAuthDetailView
          provDef={provDef}
          provId={props.provId}
          agentName={props.agentName}
          connected={connected}
          selectedAuthType={props.selectedAuthType}
          busy={props.busy}
          setBusy={props.setBusy}
          onBack={props.onBack}
          onUpdate={props.onUpdate}
          onClose={props.onClose}
        />
      </Show>

      {/* Device-code subscription */}
      <Show when={isDeviceCodeFlow()}>
        <DeviceCodeDetailView
          provDef={provDef}
          provId={props.provId}
          agentName={props.agentName}
          connected={connected}
          selectedAuthType={props.selectedAuthType}
          busy={props.busy}
          setBusy={props.setBusy}
          onBack={props.onBack}
          onUpdate={props.onUpdate}
          onClose={props.onClose}
        />
      </Show>

      {/* Ollama (no key) */}
      <Show when={isOllama}>
        <div class="provider-detail__field">
          <span class="provider-detail__no-key">No API key required for local models</span>
        </div>
        <Show when={!connected()}>
          <button
            class="btn btn--primary provider-detail__action"
            disabled={props.busy()}
            onClick={handleOllamaConnect}
          >
            <Show when={!props.busy()} fallback={<span class="spinner" />}>
              Connect
            </Show>
          </button>
        </Show>
        <Show when={connected()}>
          <button
            class="btn btn--outline provider-detail__action provider-detail__disconnect"
            disabled={props.busy()}
            onClick={handleDisconnect}
          >
            <Show when={!props.busy()} fallback={<span class="spinner" />}>
              Disconnect
            </Show>
          </button>
        </Show>
      </Show>

      {/* API key / subscription token form (non-Ollama, non-command-only, non-OAuth) */}
      <Show when={!isOllama && !isCommandOnly() && !isPopupOAuthFlow() && !isDeviceCodeFlow()}>
        <ProviderKeyForm
          provDef={provDef}
          provId={props.provId}
          agentName={props.agentName}
          isSubMode={isSubMode}
          connected={connected}
          selectedAuthType={props.selectedAuthType}
          busy={props.busy}
          setBusy={props.setBusy}
          keyInput={props.keyInput}
          setKeyInput={props.setKeyInput}
          editing={props.editing}
          setEditing={props.setEditing}
          validationError={props.validationError}
          setValidationError={props.setValidationError}
          getKeyPrefixDisplay={getKeyPrefixDisplay}
          onBack={props.onBack}
          onUpdate={props.onUpdate}
        />
      </Show>
    </div>
  );
};

export default ProviderDetailView;
