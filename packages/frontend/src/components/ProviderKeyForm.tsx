import { Show, onMount, type Component, type Accessor, type Setter } from 'solid-js';
import type { ProviderDef } from '../services/providers.js';
import { validateApiKey, validateSubscriptionKey } from '../services/provider-utils.js';
import {
  connectProvider,
  disconnectProvider,
  revokeOpenaiOAuth,
  type AuthType,
} from '../services/api.js';
import {
  getRoutingProviderApiKeyUrl,
  getSubscriptionProviderKeyUrl,
} from '../services/provider-api-key-urls.js';
import { toast } from '../services/toast-store.js';

export interface ProviderKeyFormProps {
  provDef: ProviderDef;
  provId: string;
  agentName: string;
  isSubMode: Accessor<boolean>;
  connected: Accessor<boolean>;
  selectedAuthType: Accessor<AuthType>;
  busy: Accessor<boolean>;
  setBusy: Setter<boolean>;
  keyInput: Accessor<string>;
  setKeyInput: Setter<string>;
  editing: Accessor<boolean>;
  setEditing: Setter<boolean>;
  validationError: Accessor<string | null>;
  setValidationError: Setter<string | null>;
  getKeyPrefixDisplay: (authType: AuthType) => string;
  onBack: () => void;
  onUpdate: () => void;
}

const ProviderKeyForm: Component<ProviderKeyFormProps> = (props) => {
  const isPopupOAuth = () =>
    props.provDef.subscriptionAuthMode === 'popup_oauth' || !!props.provDef.subscriptionOAuth;
  const shouldRevokeOpenaiOAuth = () =>
    props.provId === 'openai' && isPopupOAuth() && props.selectedAuthType() === 'subscription';
  const isApiKeyCredential = () =>
    !props.isSubMode() || props.provDef.subscriptionCredentialKind === 'api-key';
  const fieldLabel = () => (isApiKeyCredential() ? 'API Key' : 'Setup Token');
  const placeholder = () =>
    props.isSubMode()
      ? (props.provDef.subscriptionKeyPlaceholder ?? 'Paste token')
      : props.provDef.keyPlaceholder;
  const credentialNoun = () => (isApiKeyCredential() ? 'API key' : 'setup token');
  const inputAriaLabel = () => `${props.provDef.name} ${credentialNoun()}`;
  const editAriaLabel = () => `New ${props.provDef.name} ${credentialNoun()}`;
  const whereToGetUrl = () =>
    props.isSubMode()
      ? getSubscriptionProviderKeyUrl(props.provId)
      : getRoutingProviderApiKeyUrl(props.provId);

  const handleConnect = async () => {
    const result = props.isSubMode()
      ? validateSubscriptionKey(props.provDef, props.keyInput())
      : validateApiKey(props.provDef, props.keyInput());
    if (!result.valid) {
      props.setValidationError(result.error!);
      return;
    }

    props.setBusy(true);
    try {
      await connectProvider(props.agentName, {
        provider: props.provId,
        apiKey: props.keyInput().replace(/\s/g, ''),
        authType: props.selectedAuthType(),
      });
      toast.success(`${props.provDef.name} connected`);
      props.onBack();
      props.onUpdate();
    } catch {
      // error toast from fetchMutate
    } finally {
      props.setBusy(false);
    }
  };

  const handleUpdateKey = async () => {
    const result = props.isSubMode()
      ? validateSubscriptionKey(props.provDef, props.keyInput())
      : validateApiKey(props.provDef, props.keyInput());
    if (!result.valid) {
      props.setValidationError(result.error!);
      return;
    }

    props.setBusy(true);
    try {
      await connectProvider(props.agentName, {
        provider: props.provId,
        apiKey: props.keyInput().replace(/\s/g, ''),
        authType: props.selectedAuthType(),
      });
      const label = props.isSubMode() && !isApiKeyCredential() ? 'token' : 'key';
      toast.success(`${props.provDef.name} ${label} updated`);
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

  let connectInputRef: HTMLInputElement | undefined;
  onMount(() => {
    if (connectInputRef && !props.connected()) {
      connectInputRef.focus();
    }
  });

  return (
    <>
      {/* Not yet connected */}
      <Show when={!props.connected()}>
        <div class="provider-detail__field">
          <label class="provider-detail__label">{fieldLabel()}</label>
          <input
            ref={connectInputRef}
            class="provider-detail__input provider-detail__input--masked"
            classList={{ 'provider-detail__input--error': !!props.validationError() }}
            type="text"
            autocomplete="off"
            placeholder={placeholder()}
            aria-label={inputAriaLabel()}
            value={props.keyInput()}
            onInput={(e) => {
              props.setKeyInput(e.currentTarget.value);
              props.setValidationError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleConnect();
            }}
          />
          <Show when={props.validationError()}>
            <div class="provider-detail__error">{props.validationError()}</div>
          </Show>
          <Show when={whereToGetUrl()}>
            <p class="provider-detail__key-help">
              <a
                class="provider-detail__key-help-link"
                href={whereToGetUrl()}
                target="_blank"
                rel="noopener noreferrer"
              >
                Get {props.provDef.name} {credentialNoun()}
              </a>
            </p>
          </Show>
        </div>
        <button
          class="btn btn--primary provider-detail__action"
          disabled={props.busy() || !props.keyInput().trim()}
          onClick={handleConnect}
        >
          <Show when={!props.busy()} fallback={<span class="spinner" />}>
            Connect
          </Show>
        </button>
      </Show>

      {/* Already connected */}
      <Show when={props.connected()}>
        <div class="provider-detail__field">
          <label class="provider-detail__label">{fieldLabel()}</label>
          <Show when={!props.editing()}>
            <div class="provider-detail__key-row">
              <input
                class="provider-detail__input provider-detail__input--disabled"
                type="text"
                value={props.getKeyPrefixDisplay(props.selectedAuthType())}
                disabled
                aria-label={
                  isApiKeyCredential() ? 'Current API key (masked)' : 'Current setup token (masked)'
                }
              />
              <button
                class="btn btn--outline btn--sm"
                onClick={() => {
                  props.setEditing(true);
                  props.setKeyInput('');
                  props.setValidationError(null);
                }}
              >
                Change
              </button>
              <button
                class="provider-detail__disconnect-icon"
                disabled={props.busy()}
                onClick={handleDisconnect}
                aria-label="Disconnect provider"
                title="Disconnect"
              >
                <Show when={!props.busy()} fallback={<span class="spinner" />}>
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
                    <path d="M3 6h18" />
                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                  </svg>
                </Show>
              </button>
            </div>
          </Show>
          <Show when={props.editing()}>
            <input
              class="provider-detail__input provider-detail__input--masked"
              classList={{ 'provider-detail__input--error': !!props.validationError() }}
              type="text"
              autocomplete="off"
              placeholder={placeholder()}
              aria-label={editAriaLabel()}
              value={props.keyInput()}
              onInput={(e) => {
                props.setKeyInput(e.currentTarget.value);
                props.setValidationError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleUpdateKey();
              }}
            />
            <Show when={props.validationError()}>
              <div class="provider-detail__error">{props.validationError()}</div>
            </Show>
            <Show when={whereToGetUrl()}>
              <p class="provider-detail__key-help">
                <a
                  class="provider-detail__key-help-link"
                  href={whereToGetUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Get {props.provDef.name} {credentialNoun()}
                </a>
              </p>
            </Show>
            <button
              class="btn btn--primary provider-detail__action"
              disabled={props.busy() || !props.keyInput().trim()}
              onClick={handleUpdateKey}
              style="margin-top: 12px;"
            >
              Save
            </button>
          </Show>
        </div>
      </Show>
    </>
  );
};

export default ProviderKeyForm;
