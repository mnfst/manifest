import {
  createEffect,
  createSignal,
  For,
  Show,
  type Component,
  type Accessor,
  type Setter,
} from 'solid-js';
import type { ProviderDef } from '../services/providers.js';
import {
  getOpenaiOAuthUrl,
  submitOpenaiOAuthCallback,
  revokeOpenaiOAuth,
  renameProviderKey,
  type AuthType,
  type RoutingProvider,
} from '../services/api.js';
import { toast } from '../services/toast-store.js';
import { monitorOAuthPopup } from '../services/oauth-popup.js';

const MAX_LABEL_LENGTH = 50;

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
  onClose: () => void;
  addKeyOpen?: Accessor<boolean>;
  setAddKeyOpen?: Setter<boolean>;
  activeKeys?: Accessor<RoutingProvider[]>;
}

const OAuthDetailView: Component<Props> = (props) => {
  const [popupOpened, setPopupOpened] = createSignal(false);
  const [pasteUrl, setPasteUrl] = createSignal('');
  const [pasteError, setPasteError] = createSignal<string | null>(null);
  const [pendingRenewLabel, setPendingRenewLabel] = createSignal<string | null>(null);
  const [renamingId, setRenamingId] = createSignal<string | null>(null);
  const [renameValue, setRenameValue] = createSignal('');

  const isMultiKey = () => (props.activeKeys?.() ?? []).length > 1;

  // When "Add another key" is clicked in the header, launch a new OAuth popup.
  createEffect(() => {
    if (props.addKeyOpen?.() && props.connected() && !props.busy()) {
      props.setAddKeyOpen?.(false);
      void handleOAuthLogin();
    }
  });

  const successMessage = (label?: string | null) =>
    label
      ? `${props.provDef.name} auth token renewed`
      : `${props.provDef.name} subscription connected`;

  const handleOAuthLogin = async (label?: string) => {
    props.setBusy(true);
    setPasteUrl('');
    setPasteError(null);
    setPendingRenewLabel(label ?? null);
    try {
      const { url } = label
        ? await getOpenaiOAuthUrl(props.agentName, label)
        : await getOpenaiOAuthUrl(props.agentName);
      const popup = window.open(url, 'manifest-oauth', 'width=500,height=700');
      if (!popup) {
        toast.error(
          'Popup was blocked by your browser. Allow popups for this site, then try again.',
        );
        setPendingRenewLabel(null);
        props.setBusy(false);
        return;
      }

      setPopupOpened(true);
      props.setBusy(false);

      monitorOAuthPopup(popup, {
        onSuccess: () => {
          toast.success(successMessage(label));
          setPopupOpened(false);
          setPendingRenewLabel(null);
          props.onUpdate();
        },
        onFailure: () => {
          // Popup closed without auto-redirect — user needs to paste the URL
        },
      });
    } catch {
      setPendingRenewLabel(null);
      props.setBusy(false);
    }
  };

  const handlePasteSubmit = async () => {
    const raw = pasteUrl().trim();
    if (!raw) return;

    try {
      const url = new URL(raw);
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      if (!code || !state) {
        setPasteError('URL is missing the authorization code. Make sure you copied the full URL.');
        return;
      }

      props.setBusy(true);
      setPasteError(null);
      await submitOpenaiOAuthCallback(code, state);
      toast.success(successMessage(pendingRenewLabel()));
      setPopupOpened(false);
      setPendingRenewLabel(null);
      props.onUpdate();
    } catch {
      setPasteError('Failed to exchange token. The URL may have expired — try logging in again.');
    } finally {
      props.setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    props.setBusy(true);
    try {
      const result = await revokeOpenaiOAuth(props.agentName);
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
      const result = await revokeOpenaiOAuth(props.agentName, label);
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
      toast.success(`Renamed to "${newLabel}"`);
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
      <Show when={!props.connected() && !popupOpened()}>
        <p class="provider-detail__hint">
          Log in with your {props.provDef.name} account to connect your subscription.
        </p>
        <button
          class="btn btn--primary provider-detail__action"
          disabled={props.busy()}
          onClick={() => handleOAuthLogin()}
        >
          <Show when={!props.busy()} fallback={<span class="spinner" />}>
            Log in with {props.provDef.name}
          </Show>
        </button>
      </Show>
      <Show when={popupOpened()}>
        <>
          <p class="provider-detail__hint">
            A login window has opened. After you sign in, the popup will show a "can't be reached"
            page. This is expected.
          </p>
          <p class="provider-detail__hint" style="margin-top: 8px;">
            Copy the full URL from the{' '}
            <span style="color: hsl(var(--foreground)); font-weight: 500;">
              popup's address bar
            </span>{' '}
            and paste it below:
          </p>
          <video
            src="/images/oauth-callback-example.mp4"
            autoplay
            loop
            muted
            playsinline
            style="width: 100%; border-radius: var(--radius); border: 1px solid hsl(var(--border)); margin-top: 12px;"
          />
          <div class="provider-detail__field" style="margin-top: 12px;">
            <input
              class="provider-detail__input"
              classList={{ 'provider-detail__input--error': !!pasteError() }}
              type="text"
              autocomplete="off"
              placeholder="http://localhost:1455/auth/callback?code=..."
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
                Connect
              </Show>
            </button>
          </div>
        </>
      </Show>
      <Show when={props.connected()}>
        {/* Multi-key list */}
        <Show when={isMultiKey()}>
          <div class="provider-detail__field">
            <label class="provider-detail__label">Accounts</label>
            <ul
              role="list"
              aria-label={`OAuth accounts for ${props.provDef.name}`}
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
                              Connected via {props.provDef.subscriptionLabel ?? 'subscription'}
                            </div>
                          </div>
                          <button
                            class="btn btn--outline btn--sm"
                            style="flex-shrink: 0;"
                            disabled={props.busy()}
                            onClick={() => handleOAuthLogin(k.label)}
                            aria-label={`Renew auth token for ${k.label}`}
                            title="Renew auth token"
                          >
                            Renew
                          </button>
                          <button
                            class="btn btn--outline btn--sm"
                            style="flex-shrink: 0;"
                            disabled={props.busy()}
                            onClick={() => startRename(k)}
                          >
                            Rename
                          </button>
                          <button
                            class="provider-detail__disconnect-icon"
                            disabled={props.busy()}
                            onClick={() => handleDeleteKey(k.label)}
                            aria-label={`Delete account ${k.label}`}
                            title="Delete account"
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
                        aria-label={`Rename ${k.label}`}
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
                        Save
                      </button>
                      <button
                        class="btn btn--outline btn--sm"
                        disabled={props.busy()}
                        onClick={() => setRenamingId(null)}
                      >
                        Cancel
                      </button>
                    </Show>
                  </li>
                )}
              </For>
            </ul>
          </div>
          <button
            class="btn btn--outline provider-detail__action provider-detail__disconnect"
            disabled={props.busy()}
            onClick={handleDisconnect}
          >
            <Show when={!props.busy()} fallback={<span class="spinner" />}>
              Disconnect all
            </Show>
          </button>
        </Show>
        {/* Single key — original view */}
        <Show when={!isMultiKey()}>
          <div class="provider-detail__field">
            <span class="provider-detail__no-key">
              Connected via {props.provDef.subscriptionLabel ?? 'subscription'}
            </span>
          </div>
          <button
            class="btn btn--outline provider-detail__action"
            disabled={props.busy()}
            onClick={() => handleOAuthLogin((props.activeKeys?.() ?? [])[0]?.label ?? 'Default')}
          >
            <Show when={!props.busy()} fallback={<span class="spinner" />}>
              Renew auth token
            </Show>
          </button>
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
    </>
  );
};

export default OAuthDetailView;
