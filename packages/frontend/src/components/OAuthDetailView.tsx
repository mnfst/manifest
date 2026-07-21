import {
  createEffect,
  onCleanup,
  createSignal,
  For,
  Show,
  type Component,
  type Accessor,
  type Setter,
} from 'solid-js';
import type { ProviderDef } from '../services/providers.js';
import {
  getPopupOauthApi,
  renameProviderKey,
  type AuthType,
  type RoutingProvider,
} from '../services/api.js';
import { toast } from '../services/toast-store.js';
import { monitorOAuthPopup } from '../services/oauth-popup.js';
import { t } from '../i18n/index.js';

const MAX_LABEL_LENGTH = 50;

function parseOAuthCallbackInput(raw: string, fallbackState: string | null) {
  let code: string | null = null;
  let state: string | null = fallbackState;
  const parts = raw.split(/\s+/).filter(Boolean);

  for (const part of parts) {
    try {
      const url = new URL(part);
      code = code ?? url.searchParams.get('code');
      state = state ?? url.searchParams.get('state');
    } catch {
      if (!code && /^[A-Za-z0-9._~-]{20,}$/.test(part)) {
        code = part;
      }
    }
  }

  return { code, state };
}

interface Props {
  provDef: ProviderDef;
  provId: string;
  agentName: string;
  connected: Accessor<boolean>;
  selectedAuthType: Accessor<AuthType>;
  busy: Accessor<boolean>;
  setBusy: Setter<boolean>;
  onBack: () => void;
  onUpdate: () => void;
  onPollProviders?: () => void | Promise<void>;
  onClose: () => void;
  addKeyOpen?: Accessor<boolean>;
  setAddKeyOpen?: Setter<boolean>;
  activeKeys?: Accessor<RoutingProvider[]>;
}

const OAuthDetailView: Component<Props> = (props) => {
  const [pasteFlowActive, setPasteFlowActive] = createSignal(false);
  const [flowKeyCount, setFlowKeyCount] = createSignal<number | null>(null);
  const [successHandled, setSuccessHandled] = createSignal(false);
  const [pasteUrl, setPasteUrl] = createSignal('');
  const [pasteError, setPasteError] = createSignal<string | null>(null);
  const [oauthState, setOauthState] = createSignal<string | null>(null);
  const [renamingId, setRenamingId] = createSignal<string | null>(null);
  const [renameValue, setRenameValue] = createSignal('');
  const [addingAccount, setAddingAccount] = createSignal(false);

  // Dispose the OAuth popup monitor if the view unmounts mid-flow, otherwise its
  // 300ms URL poll keeps running after the component is gone.
  let disposeOAuthMonitor: (() => void) | null = null;
  onCleanup(() => disposeOAuthMonitor?.());

  const isMultiKey = () => (props.activeKeys?.() ?? []).length > 1;
  const isXaiProvider = () => props.provId === 'xai';
  const isOpenAiProvider = () => props.provId === 'openai';
  const callbackPlaceholder = () =>
    isXaiProvider() ? t('oauth.xaiPlaceholder') : 'http://localhost:1455/auth/callback?code=...';
  const showConnectFlow = () => !props.connected() || addingAccount() || pasteFlowActive();
  const showConnectedFlow = () => props.connected() && !addingAccount() && !pasteFlowActive();
  const activeKeyCount = () => (props.activeKeys?.() ?? []).length;
  const flowHasConnected = () => {
    const baseline = flowKeyCount();
    if (baseline === null) return false;
    return baseline > 0 ? activeKeyCount() > baseline : props.connected();
  };

  const finishOAuthSuccess = () => {
    if (successHandled()) return;
    setSuccessHandled(true);
    setPasteFlowActive(false);
    setFlowKeyCount(null);
    setPasteUrl('');
    setPasteError(null);
    setOauthState(null);
    setAddingAccount(false);
    toast.success(t('oauth.subscriptionConnected', { provider: props.provDef.name }));
    props.onUpdate();
  };

  // When "Add another key" is clicked in the header, launch a new OAuth popup.
  createEffect(() => {
    if (props.addKeyOpen?.() && props.connected() && !props.busy()) {
      setAddingAccount(true);
      props.setAddKeyOpen?.(false);
      void handleOAuthLogin();
    }
  });

  const oauthApi = () => getPopupOauthApi(props.provId);

  createEffect(() => {
    if (!pasteFlowActive()) return;
    const poll = props.onPollProviders ?? props.onUpdate;
    const interval = window.setInterval(() => {
      poll();
    }, 2000);
    onCleanup(() => window.clearInterval(interval));
  });

  createEffect(() => {
    if (pasteFlowActive() && flowHasConnected()) finishOAuthSuccess();
  });

  const handleOAuthLogin = async () => {
    props.setBusy(true);
    setPasteUrl('');
    setPasteError(null);
    try {
      const { url } = await oauthApi().getUrl(props.agentName);
      try {
        setOauthState(new URL(url).searchParams.get('state'));
      } catch {
        setOauthState(null);
      }
      const popup = window.open(url, 'manifest-oauth', 'width=500,height=700');
      if (!popup) {
        toast.error(t('oauth.popupBlocked'));
        if (props.connected()) setAddingAccount(false);
        setOauthState(null);
        props.setBusy(false);
        return;
      }

      setPasteFlowActive(true);
      setFlowKeyCount(activeKeyCount());
      setSuccessHandled(false);
      props.setBusy(false);

      // Dispose any in-flight monitor from a previous start before replacing it,
      // so repeated logins don't orphan the earlier poll/listener handle.
      disposeOAuthMonitor?.();
      disposeOAuthMonitor = monitorOAuthPopup(
        popup,
        {
          onSuccess: finishOAuthSuccess,
          onFailure: () => {
            // Popup closed without auto-redirect — user needs to paste the URL
          },
        },
        `/oauth/${props.provId}/done`,
      );
    } catch {
      if (props.connected()) setAddingAccount(false);
      props.setBusy(false);
    }
  };

  const handlePasteSubmit = async () => {
    const raw = pasteUrl().trim();
    if (!raw) return;

    try {
      const { code, state } = parseOAuthCallbackInput(raw, oauthState());
      if (!code || !state) {
        setPasteError(props.provId === 'xai' ? t('oauth.xaiMissingCode') : t('oauth.missingCode'));
        return;
      }

      props.setBusy(true);
      setPasteError(null);
      await oauthApi().submitCallback(code, state);
      finishOAuthSuccess();
    } catch {
      setPasteError(t('oauth.exchangeFailed'));
    } finally {
      props.setBusy(false);
    }
  };

  const cancelAddAccount = () => {
    setAddingAccount(false);
    setPasteFlowActive(false);
    setFlowKeyCount(null);
    setSuccessHandled(false);
    setPasteUrl('');
    setPasteError(null);
    setOauthState(null);
  };

  const handleDisconnect = async () => {
    props.setBusy(true);
    try {
      const result = await oauthApi().revoke(props.agentName);
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

  const handleDeleteKey = async (label: string) => {
    props.setBusy(true);
    try {
      const result = await oauthApi().revoke(props.agentName, label);
      if (result?.notifications?.length) {
        for (const msg of result.notifications) {
          toast.error(msg);
        }
      }
      props.onUpdate();
    } catch {
      // error toast from fetchMutate
    } finally {
      props.setBusy(false);
    }
  };

  const startRename = (k: RoutingProvider) => {
    setRenamingId(k.id);
    setRenameValue(k.label);
  };

  const commitRename = async (k: RoutingProvider) => {
    const newLabel = renameValue().trim();
    if (!newLabel || newLabel === k.label) {
      setRenamingId(null);
      return;
    }
    props.setBusy(true);
    try {
      await renameProviderKey(
        props.agentName,
        props.provId,
        k.label,
        newLabel,
        props.selectedAuthType(),
      );
      toast.success(t('account.renamed', { name: newLabel }));
      setRenamingId(null);
      props.onUpdate();
    } catch {
      // toast handled upstream
    } finally {
      props.setBusy(false);
    }
  };

  return (
    <>
      <Show when={showConnectFlow()}>
        <Show
          when={pasteFlowActive()}
          fallback={
            <>
              <p class="provider-detail__hint">
                {t('oauth.loginHint', { provider: props.provDef.name })}
              </p>
              <button
                class="btn btn--primary provider-detail__action"
                disabled={props.busy()}
                onClick={handleOAuthLogin}
              >
                <Show when={!props.busy()} fallback={<span class="spinner" />}>
                  {t('oauth.loginWith', { provider: props.provDef.name })}
                </Show>
              </button>
            </>
          }
        >
          <Show
            when={isXaiProvider()}
            fallback={
              <>
                <p class="provider-detail__hint">{t('oauth.popupInstructions')}</p>
                <Show when={isOpenAiProvider()}>
                  <p class="provider-detail__hint" style="margin-top: 8px;">
                    {t('oauth.copyPopupUrlPrefix')}{' '}
                    <span style="color: hsl(var(--foreground)); font-weight: 500;">
                      {t('oauth.popupAddressBar')}
                    </span>{' '}
                    {t('oauth.copyPopupUrlSuffix')}
                  </p>
                  <video
                    src="/images/oauth-callback-example.mp4"
                    poster="/images/oauth-callback-example.png"
                    preload="auto"
                    autoplay
                    loop
                    muted
                    playsinline
                    style="width: 100%; border-radius: var(--radius); border: 1px solid hsl(var(--border)); margin-top: 12px;"
                  />
                </Show>
              </>
            }
          >
            <p class="provider-detail__hint">{t('oauth.xaiInstructions')}</p>
          </Show>
          <div class="provider-detail__field" style="margin-top: 12px;">
            <input
              type="text"
              class="provider-detail__input"
              classList={{ 'provider-detail__input--error': !!pasteError() }}
              autocomplete="off"
              placeholder={callbackPlaceholder()}
              value={pasteUrl()}
              onInput={(e) => {
                setPasteUrl(e.currentTarget.value);
                setPasteError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handlePasteSubmit();
              }}
            />
            <Show when={pasteError()}>
              <div class="provider-detail__error">{pasteError()}</div>
            </Show>
            <button
              class="btn btn--primary btn--sm provider-detail__action"
              style="margin-top: 8px;"
              disabled={props.busy() || !pasteUrl().trim()}
              onClick={handlePasteSubmit}
            >
              <Show when={!props.busy()} fallback={<span class="spinner" />}>
                {t('components.connect')}
              </Show>
            </button>
          </div>
        </Show>
        <Show when={addingAccount()}>
          <button
            class="btn btn--outline provider-detail__action"
            disabled={props.busy()}
            onClick={cancelAddAccount}
          >
            {t('components.cancel')}
          </button>
        </Show>
      </Show>
      <Show when={showConnectedFlow()}>
        {/* Multi-key list */}
        <Show when={isMultiKey()}>
          <div class="provider-detail__field">
            <label class="provider-detail__label">{t('account.accounts')}</label>
            <ul
              role="list"
              aria-label={t('account.oauthAccountsFor', { provider: props.provDef.name })}
              style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px;"
            >
              <For each={props.activeKeys!()}>
                {(k) => (
                  <li style="display: flex; align-items: center; gap: 8px; padding: 8px 10px; border: 1px solid hsl(var(--border)); border-radius: 6px; background: hsl(var(--muted) / 0.3);">
                    <Show
                      when={renamingId() === k.id}
                      fallback={
                        <>
                          <div style="flex: 1; min-width: 0;">
                            <div style="font-weight: 500; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                              {k.label}
                            </div>
                            <div style="font-size: var(--font-size-xs); color: hsl(var(--muted-foreground));">
                              {t('account.connectedVia', {
                                method:
                                  props.provDef.subscriptionLabel ?? t('provider.subscription'),
                              })}
                            </div>
                          </div>
                          <button
                            class="btn btn--outline btn--sm"
                            style="flex-shrink: 0;"
                            disabled={props.busy()}
                            onClick={() => startRename(k)}
                          >
                            {t('account.rename')}
                          </button>
                          <button
                            class="provider-detail__disconnect-icon"
                            disabled={props.busy()}
                            onClick={() => handleDeleteKey(k.label)}
                            aria-label={t('account.deleteNamed', { name: k.label })}
                            title={t('account.delete')}
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
                        </>
                      }
                    >
                      <input
                        class="provider-detail__input"
                        type="text"
                        maxlength={MAX_LABEL_LENGTH}
                        aria-label={t('account.renameNamed', { name: k.label })}
                        value={renameValue()}
                        onInput={(e) => setRenameValue(e.currentTarget.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitRename(k);
                          if (e.key === 'Escape') setRenamingId(null);
                        }}
                      />
                      <button
                        class="btn btn--primary btn--sm"
                        disabled={props.busy()}
                        onClick={() => commitRename(k)}
                      >
                        {t('components.save')}
                      </button>
                      <button
                        class="btn btn--outline btn--sm"
                        disabled={props.busy()}
                        onClick={() => setRenamingId(null)}
                      >
                        {t('components.cancel')}
                      </button>
                    </Show>
                  </li>
                )}
              </For>
            </ul>
          </div>
          <div class="provider-detail__footer">
            <button
              class="btn btn--outline provider-detail__disconnect"
              disabled={props.busy()}
              onClick={handleDisconnect}
            >
              <Show when={!props.busy()} fallback={<span class="spinner" />}>
                {t('account.disconnectAll')}
              </Show>
            </button>
            <div style="flex: 1;" />
            <button class="btn btn--primary btn--sm" onClick={() => props.onClose()}>
              {t('components.done')}
            </button>
          </div>
        </Show>
        {/* Single key — original view */}
        <Show when={!isMultiKey()}>
          <div class="provider-detail__field">
            <span class="provider-detail__no-key">
              {t('account.connectedVia', {
                method: props.provDef.subscriptionLabel ?? t('provider.subscription'),
              })}
            </span>
          </div>
          <div class="provider-detail__footer">
            <button
              class="btn btn--outline provider-detail__disconnect"
              disabled={props.busy()}
              onClick={handleDisconnect}
            >
              <Show when={!props.busy()} fallback={<span class="spinner" />}>
                {t('components.disconnect')}
              </Show>
            </button>
            <div style="flex: 1;" />
            <button class="btn btn--primary btn--sm" onClick={() => props.onClose()}>
              {t('components.done')}
            </button>
          </div>
        </Show>
      </Show>
    </>
  );
};

export default OAuthDetailView;
