import { createSignal, For, Show, type Component } from 'solid-js';
import { PROVIDERS, validateApiKey } from '../services/providers.js';
import { providerIcon } from './ProviderIcon.js';
import {
  connectProvider,
  disconnectProvider,
  type RoutingProvider,
  type CustomProviderData,
} from '../services/api.js';
import { toast } from '../services/toast-store.js';
import { isLocalMode } from '../services/local-mode.js';
import CustomProviderForm from './CustomProviderForm.js';

interface Props {
  agentName: string;
  providers: RoutingProvider[];
  customProviders?: CustomProviderData[];
  onClose: () => void;
  onUpdate: () => void;
}

const ProviderSelectModal: Component<Props> = (props) => {
  const [selectedProvider, setSelectedProvider] = createSignal<string | null>(null);
  const [showCustomForm, setShowCustomForm] = createSignal(false);
  const [editingCustomProvider, setEditingCustomProvider] = createSignal<CustomProviderData | null>(
    null,
  );
  const [busy, setBusy] = createSignal(false);
  const [keyInput, setKeyInput] = createSignal('');
  const [editing, setEditing] = createSignal(false);
  const [validationError, setValidationError] = createSignal<string | null>(null);
  const [direction, setDirection] = createSignal<'forward' | 'back' | null>(null);

  const getProviderData = (provId: string) => props.providers.find((p) => p.provider === provId);

  const isConnected = (provId: string): boolean => {
    const p = getProviderData(provId);
    return !!p && p.is_active && p.has_api_key;
  };

  const isNoKeyConnected = (provId: string): boolean => {
    const p = getProviderData(provId);
    const provDef = PROVIDERS.find((pr) => pr.id === provId);
    return !!p && p.is_active && !!provDef?.noKeyRequired;
  };

  const getKeyPrefixDisplay = (provId: string): string => {
    const p = getProviderData(provId);
    if (p?.key_prefix) return `${p.key_prefix}${'•'.repeat(8)}`;
    return '••••••••••••';
  };

  const openDetail = (provId: string) => {
    setDirection('forward');
    setSelectedProvider(provId);
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

  const handleConnect = async (provId: string) => {
    const provDef = PROVIDERS.find((p) => p.id === provId)!;
    const isOllama = provDef.noKeyRequired;

    if (!isOllama) {
      const result = validateApiKey(provDef, keyInput());
      if (!result.valid) {
        setValidationError(result.error!);
        return;
      }
    }

    setBusy(true);
    try {
      await connectProvider(props.agentName, {
        provider: provId,
        apiKey: isOllama ? undefined : keyInput().trim(),
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
    const result = validateApiKey(provDef, keyInput());
    if (!result.valid) {
      setValidationError(result.error!);
      return;
    }

    setBusy(true);
    try {
      await connectProvider(props.agentName, {
        provider: provId,
        apiKey: keyInput().trim(),
      });
      toast.success(`${provDef.name} key updated`);
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
      const result = await disconnectProvider(props.agentName, provId);
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
        {/* ── Custom Provider Form View (create or edit) ── */}
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

        {/* ── List View ── */}
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
                  Add your API keys to enable routing through each provider
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

            <div class="provider-modal__list">
              <For
                each={
                  isLocalMode()
                    ? PROVIDERS
                    : [...PROVIDERS].sort((a, b) => (a.localOnly ? 1 : 0) - (b.localOnly ? 1 : 0))
                }
              >
                {(prov) => {
                  const connected = () => isConnected(prov.id) || isNoKeyConnected(prov.id);
                  const disabled = () => !!prov.localOnly && !isLocalMode();

                  return (
                    <button
                      class="provider-toggle"
                      disabled={disabled()}
                      onClick={() => !disabled() && openDetail(prov.id)}
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

            <div class="provider-modal__footer">
              <button class="btn btn--primary" onClick={props.onClose}>
                Done
              </button>
            </div>
          </div>
        </Show>

        {/* ── Detail View ── */}
        <Show when={selectedProvider() !== null && !showCustomForm() && !editingCustomProvider()}>
          <div class="provider-modal__view provider-modal__view--from-right">
            {(() => {
              const provId = selectedProvider()!;
              const provDef = PROVIDERS.find((p) => p.id === provId)!;
              const connected = () => isConnected(provId) || isNoKeyConnected(provId);
              const isOllama = provDef.noKeyRequired;

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
                        Add your API keys to enable routing through each provider
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
                        Connect
                      </button>
                    </Show>
                    <Show when={connected()}>
                      <button
                        class="btn btn--outline provider-detail__action provider-detail__disconnect"
                        disabled={busy()}
                        onClick={() => handleDisconnect(provId)}
                      >
                        Disconnect
                      </button>
                    </Show>
                  </Show>

                  {/* Non-Ollama: not yet connected */}
                  <Show when={!isOllama && !connected()}>
                    <div class="provider-detail__field">
                      <label class="provider-detail__label">API Key</label>
                      <input
                        class="provider-detail__input"
                        classList={{ 'provider-detail__input--error': !!validationError() }}
                        type="password"
                        placeholder={provDef.keyPlaceholder}
                        aria-label={`${provDef.name} API key`}
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
                      Connect
                    </button>
                  </Show>

                  {/* Non-Ollama: already connected */}
                  <Show when={!isOllama && connected()}>
                    <div class="provider-detail__field">
                      <label class="provider-detail__label">API Key</label>
                      <Show when={!editing()}>
                        <div class="provider-detail__key-row">
                          <input
                            class="provider-detail__input provider-detail__input--disabled"
                            type="text"
                            value={getKeyPrefixDisplay(provId)}
                            disabled
                            aria-label="Current API key (masked)"
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
                          </button>
                        </div>
                      </Show>
                      <Show when={editing()}>
                        <input
                          class="provider-detail__input"
                          classList={{ 'provider-detail__input--error': !!validationError() }}
                          type="password"
                          placeholder={provDef.keyPlaceholder}
                          aria-label={`New ${provDef.name} API key`}
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
