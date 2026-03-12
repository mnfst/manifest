import { createSignal, For, Show, type Component } from 'solid-js';
import { PROVIDERS, validateApiKey, validateSubscriptionKey } from '../services/providers.js';
import { providerIcon } from './ProviderIcon.js';
import {
  connectProvider,
  disconnectProvider,
  type RoutingProvider,
  type CustomProviderData,
  type AuthType,
} from '../services/api.js';
import { toast } from '../services/toast-store.js';
import { isLocalMode } from '../services/local-mode.js';
import CustomProviderForm from './CustomProviderForm.js';
import { CopyButton } from './SetupStepInstall.js';

interface Props {
  agentName: string;
  providers: RoutingProvider[];
  customProviders?: CustomProviderData[];
  onClose: () => void;
  onUpdate: () => void;
}

const ProviderSelectModal: Component<Props> = (props) => {
  const [activeTab, setActiveTab] = createSignal<'subscription' | 'api_key'>('subscription');
  const [selectedProvider, setSelectedProvider] = createSignal<string | null>(null);
  const [selectedAuthType, setSelectedAuthType] = createSignal<AuthType>('api_key');
  const [showCustomForm, setShowCustomForm] = createSignal(false);
  const [editingCustomProvider, setEditingCustomProvider] = createSignal<CustomProviderData | null>(
    null,
  );
  const [busy, setBusy] = createSignal(false);
  const [keyInput, setKeyInput] = createSignal('');
  const [editing, setEditing] = createSignal(false);
  const [validationError, setValidationError] = createSignal<string | null>(null);
  const [direction, setDirection] = createSignal<'forward' | 'back' | null>(null);

  const subscriptionProviders = () => PROVIDERS.filter((p) => p.supportsSubscription);
  const apiKeyProviders = () =>
    isLocalMode()
      ? PROVIDERS
      : [...PROVIDERS].sort((a, b) => (a.localOnly ? 1 : 0) - (b.localOnly ? 1 : 0));

  const getProviderByAuth = (provId: string, authType: AuthType) =>
    props.providers.find((p) => p.provider === provId && p.auth_type === authType);

  const isConnected = (provId: string): boolean => {
    const p = getProviderByAuth(provId, 'api_key');
    return !!p && p.is_active && p.has_api_key;
  };

  const isSubscriptionConnected = (provId: string): boolean => {
    const p = getProviderByAuth(provId, 'subscription');
    return !!p && p.is_active;
  };

  const isSubscriptionWithToken = (provId: string): boolean => {
    const p = getProviderByAuth(provId, 'subscription');
    return !!p && p.is_active && p.has_api_key;
  };

  const isNoKeyConnected = (provId: string): boolean => {
    const p = getProviderByAuth(provId, 'api_key');
    const provDef = PROVIDERS.find((pr) => pr.id === provId);
    return !!p && p.is_active && !!provDef?.noKeyRequired;
  };

  const getKeyPrefixDisplay = (provId: string, authType: AuthType): string => {
    const p = getProviderByAuth(provId, authType);
    if (p?.key_prefix) return `${p.key_prefix}${'•'.repeat(8)}`;
    return '••••••••••••';
  };

  const openDetail = (provId: string, authType: AuthType) => {
    setDirection('forward');
    setSelectedProvider(provId);
    setSelectedAuthType(authType);
    setKeyInput('');
    setEditing(false);
    setValidationError(null);
  };

  const goBack = () => {
    setDirection('back');
    setSelectedProvider(null);
    setShowCustomForm(false);
    setEditingCustomProvider(null);
    setKeyInput('');
    setEditing(false);
    setValidationError(null);
  };

  const openCustomForm = () => {
    setDirection('forward');
    setShowCustomForm(true);
  };

  const openEditCustom = (cp: CustomProviderData) => {
    setDirection('forward');
    setEditingCustomProvider(cp);
  };

  const handleSubscriptionToggle = async (provId: string) => {
    const provDef = PROVIDERS.find((p) => p.id === provId)!;
    const connected = isSubscriptionConnected(provId);

    setBusy(true);
    try {
      if (connected) {
        const result = await disconnectProvider(props.agentName, provId, 'subscription');
        if (result?.notifications?.length) {
          for (const msg of result.notifications) toast.error(msg);
        }
        toast.success(`${provDef.name} subscription disconnected`);
      } else {
        await connectProvider(props.agentName, {
          provider: provId,
          authType: 'subscription',
        });
        toast.success(`${provDef.name} subscription connected`);
      }
      props.onUpdate();
    } catch {
      // error toast from fetchMutate
    } finally {
      setBusy(false);
    }
  };

  const handleConnect = async (provId: string) => {
    const provDef = PROVIDERS.find((p) => p.id === provId)!;
    const isOllama = provDef.noKeyRequired;
    const isSubMode = selectedAuthType() === 'subscription';

    if (!isOllama) {
      const result = isSubMode
        ? validateSubscriptionKey(provDef, keyInput())
        : validateApiKey(provDef, keyInput());
      if (!result.valid) {
        setValidationError(result.error!);
        return;
      }
    }

    setBusy(true);
    try {
      await connectProvider(props.agentName, {
        provider: provId,
        apiKey: isOllama ? undefined : keyInput().replace(/\s/g, ''),
        authType: selectedAuthType(),
      });
      toast.success(`${provDef.name} connected`);
      goBack();
      props.onUpdate();
    } catch {
      // error toast from fetchMutate
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateKey = async (provId: string) => {
    const provDef = PROVIDERS.find((p) => p.id === provId)!;
    const isSubMode = selectedAuthType() === 'subscription';
    const result = isSubMode
      ? validateSubscriptionKey(provDef, keyInput())
      : validateApiKey(provDef, keyInput());
    if (!result.valid) {
      setValidationError(result.error!);
      return;
    }

    setBusy(true);
    try {
      await connectProvider(props.agentName, {
        provider: provId,
        apiKey: keyInput().replace(/\s/g, ''),
        authType: selectedAuthType(),
      });
      const label = isSubMode ? 'token' : 'key';
      toast.success(`${provDef.name} ${label} updated`);
      goBack();
      props.onUpdate();
    } catch {
      // error toast from fetchMutate
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async (provId: string) => {
    setBusy(true);
    try {
      const result = await disconnectProvider(props.agentName, provId, selectedAuthType());
      if (result?.notifications?.length) {
        for (const msg of result.notifications) {
          toast.error(msg);
        }
      }
      goBack();
      props.onUpdate();
    } catch {
      // error toast from fetchMutate
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      class="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') props.onClose();
      }}
    >
      <div
        class="modal-card"
        style="max-width: 480px; padding: 0;"
        role="dialog"
        aria-modal="true"
        aria-labelledby="provider-modal-title"
      >
        {/* -- Custom Provider Form View (create or edit) -- */}
        <Show when={showCustomForm() || editingCustomProvider()}>
          <div class="provider-modal__view provider-modal__view--from-right">
            <CustomProviderForm
              agentName={props.agentName}
              initialData={editingCustomProvider() ?? undefined}
              onCreated={() => {
                goBack();
                props.onUpdate();
              }}
              onBack={goBack}
              onDeleted={() => {
                goBack();
                props.onUpdate();
              }}
            />
          </div>
        </Show>

        {/* -- List View -- */}
        <Show when={selectedProvider() === null && !showCustomForm() && !editingCustomProvider()}>
          <div
            class="provider-modal__view"
            classList={{ 'provider-modal__view--from-left': direction() === 'back' }}
          >
            <div class="routing-modal__header">
              <div>
                <div class="routing-modal__title" id="provider-modal-title">
                  Connect providers
                </div>
                <div class="routing-modal__subtitle">
                  Use your subscriptions or API keys to enable routing
                </div>
              </div>
              <button class="modal__close" onClick={props.onClose} aria-label="Close">
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
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            {/* -- Tabs -- */}
            <div class="provider-modal__tabs" role="tablist">
              <button
                role="tab"
                aria-selected={activeTab() === 'subscription'}
                class="provider-modal__tab"
                classList={{ 'provider-modal__tab--active': activeTab() === 'subscription' }}
                onClick={() => setActiveTab('subscription')}
              >
                <svg
                  class="provider-modal__tab-icon"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                  style="color: #22c55e"
                >
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                Subscription
              </button>
              <button
                role="tab"
                aria-selected={activeTab() === 'api_key'}
                class="provider-modal__tab"
                classList={{ 'provider-modal__tab--active': activeTab() === 'api_key' }}
                onClick={() => setActiveTab('api_key')}
              >
                <svg
                  class="provider-modal__tab-icon"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                  style="color: #f59e0b"
                >
                  <path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4" />
                </svg>
                API Keys
              </button>
            </div>

            {/* -- Subscription Tab -- */}
            <Show when={activeTab() === 'subscription'}>
              <div class="provider-modal__tab-hint">
                Use your Claude Max or Pro subscription instead of an API key. Paste your
                setup-token to connect.
              </div>
              <div class="provider-modal__list">
                <For each={subscriptionProviders()}>
                  {(prov) => {
                    const connected = () =>
                      prov.subscriptionKeyPlaceholder
                        ? isSubscriptionWithToken(prov.id)
                        : isSubscriptionConnected(prov.id);

                    return (
                      <button
                        class="provider-toggle"
                        disabled={busy()}
                        onClick={() =>
                          prov.subscriptionKeyPlaceholder
                            ? openDetail(prov.id, 'subscription')
                            : handleSubscriptionToggle(prov.id)
                        }
                      >
                        <span class="provider-toggle__icon">
                          {providerIcon(prov.id, 20) ?? (
                            <span
                              class="provider-card__logo-letter"
                              style={{ background: prov.color }}
                            >
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
            </Show>

            {/* -- API Keys Tab -- */}
            <Show when={activeTab() === 'api_key'}>
              <div class="provider-modal__tab-hint">
                Connect providers using your own API keys (BYOK).
              </div>
              <div class="provider-modal__list">
                <For each={apiKeyProviders()}>
                  {(prov) => {
                    const connected = () => isConnected(prov.id) || isNoKeyConnected(prov.id);
                    const disabled = () => !!prov.localOnly && !isLocalMode();

                    return (
                      <button
                        class="provider-toggle"
                        disabled={disabled()}
                        onClick={() => !disabled() && openDetail(prov.id, 'api_key')}
                      >
                        <span class="provider-toggle__icon">
                          {providerIcon(prov.id, 20) ?? (
                            <span
                              class="provider-card__logo-letter"
                              style={{ background: prov.color }}
                            >
                              {prov.initial}
                            </span>
                          )}
                        </span>
                        <span class="provider-toggle__info">
                          <span class="provider-toggle__name">{prov.name}</span>
                          <Show when={disabled()}>
                            <span class="provider-toggle__local-only">
                              Only available on Manifest Local
                            </span>
                          </Show>
                        </span>
                        <Show when={!disabled()}>
                          <span
                            class="provider-toggle__switch"
                            classList={{ 'provider-toggle__switch--on': connected() }}
                          >
                            <span class="provider-toggle__switch-thumb" />
                          </span>
                        </Show>
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
                  Request new model
                </a>
              </div>

              <div class="custom-provider-section">
                <div class="custom-provider-section__header">Custom providers</div>
                <For each={props.customProviders ?? []}>
                  {(cp) => (
                    <button class="provider-toggle" onClick={() => openEditCustom(cp)}>
                      <span class="provider-toggle__icon">
                        <span
                          class="provider-card__logo-letter"
                          style={{ background: 'var(--custom-provider-color)' }}
                        >
                          {cp.name.charAt(0).toUpperCase()}
                        </span>
                      </span>
                      <span class="provider-toggle__info">
                        <span class="provider-toggle__name">{cp.name}</span>
                        <span class="provider-toggle__local-only">
                          {cp.models.length} model{cp.models.length !== 1 ? 's' : ''}
                        </span>
                      </span>
                    </button>
                  )}
                </For>
                <button
                  class="provider-toggle"
                  onClick={openCustomForm}
                  style="color: hsl(var(--primary));"
                >
                  <span class="provider-toggle__icon" style="color: hsl(var(--primary));">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      aria-hidden="true"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 8v8" />
                      <path d="M8 12h8" />
                    </svg>
                  </span>
                  <span class="provider-toggle__info">
                    <span class="provider-toggle__name">Add custom provider</span>
                  </span>
                </button>
              </div>
            </Show>

            <div class="provider-modal__footer">
              <button class="btn btn--primary" onClick={props.onClose}>
                Done
              </button>
            </div>
          </div>
        </Show>

        {/* -- Detail View (API Key) -- */}
        <Show when={selectedProvider() !== null && !showCustomForm() && !editingCustomProvider()}>
          <div class="provider-modal__view provider-modal__view--from-right">
            {(() => {
              const provId = selectedProvider()!;
              const provDef = PROVIDERS.find((p) => p.id === provId)!;
              const isSubMode = () => selectedAuthType() === 'subscription';
              const connected = () =>
                isSubMode()
                  ? isSubscriptionWithToken(provId)
                  : isConnected(provId) || isNoKeyConnected(provId);
              const isOllama = provDef.noKeyRequired;
              const fieldLabel = () => (isSubMode() ? 'Setup Token' : 'API Key');
              const placeholder = () =>
                isSubMode()
                  ? (provDef.subscriptionKeyPlaceholder ?? 'Paste token')
                  : provDef.keyPlaceholder;
              const inputAriaLabel = () =>
                isSubMode() ? `${provDef.name} setup token` : `${provDef.name} API key`;
              const editAriaLabel = () =>
                isSubMode() ? `New ${provDef.name} setup token` : `New ${provDef.name} API key`;

              return (
                <div class="provider-detail">
                  {/* Back arrow */}
                  <button
                    class="provider-detail__back"
                    onClick={goBack}
                    aria-label="Back to providers"
                  >
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
                  <div
                    class="routing-modal__header"
                    style="border: none; padding: 0; margin-bottom: 20px;"
                  >
                    <div>
                      <div class="routing-modal__title">Connect providers</div>
                      <div class="routing-modal__subtitle">
                        {isSubMode()
                          ? 'Paste your setup-token to enable routing'
                          : 'Add your API keys to enable routing through each provider'}
                      </div>
                    </div>
                  </div>

                  {/* Provider row */}
                  <div class="provider-detail__header">
                    <span class="provider-detail__icon">
                      {providerIcon(provId, 28) ?? (
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
                      Run the command below, then paste the token.
                    </p>
                    <div class="modal-terminal">
                      <div class="modal-terminal__header">
                        <div class="modal-terminal__dots">
                          <span class="modal-terminal__dot modal-terminal__dot--red" />
                          <span class="modal-terminal__dot modal-terminal__dot--yellow" />
                          <span class="modal-terminal__dot modal-terminal__dot--green" />
                        </div>
                        <div class="modal-terminal__tabs">
                          <span class="modal-terminal__tab modal-terminal__tab--active">
                            Terminal
                          </span>
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

                  {/* Ollama (no key) */}
                  <Show when={isOllama}>
                    <div class="provider-detail__field">
                      <span class="provider-detail__no-key">
                        No API key required for local models
                      </span>
                    </div>
                    <Show when={!connected()}>
                      <button
                        class="btn btn--primary provider-detail__action"
                        disabled={busy()}
                        onClick={() => handleConnect(provId)}
                      >
                        <Show when={!busy()} fallback={<span class="spinner" />}>
                          Connect
                        </Show>
                      </button>
                    </Show>
                    <Show when={connected()}>
                      <button
                        class="btn btn--outline provider-detail__action provider-detail__disconnect"
                        disabled={busy()}
                        onClick={() => handleDisconnect(provId)}
                      >
                        <Show when={!busy()} fallback={<span class="spinner" />}>
                          Disconnect
                        </Show>
                      </button>
                    </Show>
                  </Show>

                  {/* Non-Ollama: not yet connected */}
                  <Show when={!isOllama && !connected()}>
                    <div class="provider-detail__field">
                      <label class="provider-detail__label">{fieldLabel()}</label>
                      <input
                        class="provider-detail__input"
                        classList={{ 'provider-detail__input--error': !!validationError() }}
                        type="password"
                        placeholder={placeholder()}
                        aria-label={inputAriaLabel()}
                        value={keyInput()}
                        onInput={(e) => {
                          setKeyInput(e.currentTarget.value);
                          setValidationError(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleConnect(provId);
                        }}
                      />
                      <Show when={validationError()}>
                        <div class="provider-detail__error">{validationError()}</div>
                      </Show>
                    </div>
                    <button
                      class="btn btn--primary provider-detail__action"
                      disabled={busy() || !keyInput().trim()}
                      onClick={() => handleConnect(provId)}
                    >
                      <Show when={!busy()} fallback={<span class="spinner" />}>
                        Connect
                      </Show>
                    </button>
                  </Show>

                  {/* Non-Ollama: already connected */}
                  <Show when={!isOllama && connected()}>
                    <div class="provider-detail__field">
                      <label class="provider-detail__label">{fieldLabel()}</label>
                      <Show when={!editing()}>
                        <div class="provider-detail__key-row">
                          <input
                            class="provider-detail__input provider-detail__input--disabled"
                            type="text"
                            value={getKeyPrefixDisplay(provId, selectedAuthType())}
                            disabled
                            aria-label={
                              isSubMode()
                                ? 'Current setup token (masked)'
                                : 'Current API key (masked)'
                            }
                          />
                          <button
                            class="btn btn--outline btn--sm"
                            onClick={() => {
                              setEditing(true);
                              setKeyInput('');
                              setValidationError(null);
                            }}
                          >
                            Change
                          </button>
                          <button
                            class="provider-detail__disconnect-icon"
                            disabled={busy()}
                            onClick={() => handleDisconnect(provId)}
                            aria-label="Disconnect provider"
                            title="Disconnect"
                          >
                            <Show when={!busy()} fallback={<span class="spinner" />}>
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
                      <Show when={editing()}>
                        <input
                          class="provider-detail__input"
                          classList={{ 'provider-detail__input--error': !!validationError() }}
                          type="password"
                          placeholder={placeholder()}
                          aria-label={editAriaLabel()}
                          value={keyInput()}
                          onInput={(e) => {
                            setKeyInput(e.currentTarget.value);
                            setValidationError(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleUpdateKey(provId);
                          }}
                        />
                        <Show when={validationError()}>
                          <div class="provider-detail__error">{validationError()}</div>
                        </Show>
                        <button
                          class="btn btn--primary provider-detail__action"
                          disabled={busy() || !keyInput().trim()}
                          onClick={() => handleUpdateKey(provId)}
                          style="margin-top: 12px;"
                        >
                          Save
                        </button>
                      </Show>
                    </div>
                  </Show>
                </div>
              );
            })()}
          </div>
        </Show>
      </div>
    </div>
  );
};

export default ProviderSelectModal;
