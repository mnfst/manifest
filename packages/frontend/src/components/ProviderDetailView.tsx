import { Show, createSignal, type Component, type Accessor, type Setter } from 'solid-js';
import { Portal as SolidPortal } from 'solid-js/web';
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
import CopyButton from './CopyButton.js';
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
    provDef.subscriptionAuthMode ?? (provDef.subscriptionKeyPlaceholder ? 'token' : undefined);
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
      <div class="routing-modal__header" style="border: none; padding: 0; margin-bottom: 15px;">
        <div>
          <div class="routing-modal__title">Connect providers</div>
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
          <div class="provider-detail__name">
            {provDef.name}
            <Show when={provDef.beta}>
              <span class="provider-detail__beta-badge">beta</span>
            </Show>
          </div>
        </div>
        <Show when={props.provId === 'anthropic'}>
          <AnthropicCreditsLink />
        </Show>
      </div>

      {/* Subscription sign-in URL instruction (token mode with external sign-in) */}
      <Show when={isSubMode() && provDef.subscriptionSignInUrl}>
        <p class="provider-detail__hint">
          {provDef.subscriptionSignInHint ??
            `Sign in to your ${provDef.name} account to get your API key, then paste it below.`}
        </p>
        <a
          class="btn btn--primary btn--sm provider-detail__signin-btn"
          href={provDef.subscriptionSignInUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${provDef.subscriptionSignInLabel ?? 'Sign in'} (opens in a new tab)`}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
          {provDef.subscriptionSignInLabel ?? 'Sign in'}
        </a>
      </Show>

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

const AnthropicCreditsLink: Component = () => {
  const [showTooltip, setShowTooltip] = createSignal(false);
  const [tooltipPos, setTooltipPos] = createSignal({ top: 0, left: 0 });
  let hideTimer: ReturnType<typeof setTimeout> | undefined;

  const scheduleHide = () => {
    hideTimer = setTimeout(() => setShowTooltip(false), 150);
  };

  const cancelHide = () => {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = undefined;
    }
  };

  const handleEnter = (e: MouseEvent) => {
    cancelHide();
    const el = e.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    const tooltipWidth = 280;
    let left = rect.left + rect.width / 2 - tooltipWidth / 2;
    if (left + tooltipWidth > window.innerWidth - 8) left = window.innerWidth - tooltipWidth - 8;
    if (left < 8) left = 8;
    setTooltipPos({ top: rect.bottom + 4, left });
    setShowTooltip(true);
  };

  return (
    <div class="anthropic-credits">
      <a
        href="https://claude.ai/settings/usage"
        target="_blank"
        rel="noopener noreferrer"
        class="anthropic-credits__btn"
      >
        <svg
          class="anthropic-credits__btn-icon"
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          fill="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path d="m19,7h-.21c.13-.41.21-.9.21-1.5,0-1.93-1.57-3.5-3.5-3.5-1.62,0-2.7,1.48-3.4,3.09-.69-1.51-1.83-3.09-3.6-3.09-1.93,0-3.5,1.57-3.5,3.5,0,.6.08,1.09.21,1.5h-.21c-1.65,0-3,1.35-3,3,0,1.3.84,2.4,2,2.82v6.18c0,1.65,1.35,3,3,3h10c1.65,0,3-1.35,3-3v-6.18c1.16-.41,2-1.51,2-2.82,0-1.65-1.35-3-3-3Zm-3.5-3c.83,0,1.5.67,1.5,1.5,0,1.5-.63,1.5-1,1.5h-2.48c.51-1.58,1.25-3,1.98-3Zm-8.5,1.5c0-.83.67-1.5,1.5-1.5.89,0,1.71,1.53,2.2,3h-2.7c-.37,0-1,0-1-1.5Zm-2,3.5h6v2h-6c-.55,0-1-.45-1-1s.45-1,1-1Zm2,11c-.55,0-1-.45-1-1v-6h5v7h-4Zm10,0h-4v-7h5v6c0,.55-.45,1-1,1Zm2-9h-6v-1.92s.01-.06.02-.08h5.98c.55,0,1,.45,1,1s-.45,1-1,1Z" />
        </svg>
        Claim your credits on Claude
      </a>
      <div
        class="anthropic-credits__info-wrapper"
        onMouseEnter={handleEnter}
        onMouseLeave={scheduleHide}
      >
        <svg
          class="anthropic-credits__info-icon"
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
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4" />
          <path d="M12 8h.01" />
        </svg>
        <Show when={showTooltip()}>
          <SolidPortal>
            <div
              class="anthropic-credits__tooltip"
              style={{ top: `${tooltipPos().top}px`, left: `${tooltipPos().left}px` }}
              onMouseEnter={cancelHide}
              onMouseLeave={scheduleHide}
            >
              <p>
                Anthropic offers extra API credits to eligible Pro, Max, and Team plan subscribers.
                Click the link to check your eligibility and available credits.
              </p>
              <p>
                If you're not eligible, the page may not be accessible.{' '}
                <a
                  href="https://support.claude.com/en/articles/14246053-extra-usage-credit-for-pro-max-and-team-plans"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Learn more about eligibility
                </a>
              </p>
            </div>
          </SolidPortal>
        </Show>
      </div>
    </div>
  );
};

export default ProviderDetailView;
