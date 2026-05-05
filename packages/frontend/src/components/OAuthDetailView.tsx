import { createSignal, Show, type Component, type Accessor, type Setter } from 'solid-js';
import type { ProviderDef } from '../services/providers.js';
import {
  getOpenaiOAuthUrl,
  submitOpenaiOAuthCallback,
  revokeOpenaiOAuth,
  disconnectProvider,
  type AuthType,
} from '../services/api.js';
import { toast } from '../services/toast-store.js';
import { monitorOAuthPopup } from '../services/oauth-popup.js';

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
}

const OAuthDetailView: Component<Props> = (props) => {
  const [popupOpened, setPopupOpened] = createSignal(false);
  const [pasteUrl, setPasteUrl] = createSignal('');
  const [pasteError, setPasteError] = createSignal<string | null>(null);

  const handleOAuthLogin = async () => {
    props.setBusy(true);
    setPasteUrl('');
    setPasteError(null);
    try {
      const { url } = await getOpenaiOAuthUrl(props.agentName);
      const popup = window.open(url, 'manifest-oauth', 'width=500,height=700');
      if (!popup) {
        toast.error(
          'Popup was blocked by your browser. Allow popups for this site, then try again.',
        );
        props.setBusy(false);
        return;
      }

      setPopupOpened(true);
      props.setBusy(false);

      monitorOAuthPopup(popup, {
        onSuccess: () => {
          toast.success(`${props.provDef.name} subscription connected`);
          props.onUpdate();
          props.onClose();
        },
        onFailure: () => {
          // Popup closed without auto-redirect — user needs to paste the URL
        },
      });
    } catch {
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
      toast.success(`${props.provDef.name} subscription connected`);
      props.onUpdate();
      props.onClose();
    } catch {
      setPasteError('Failed to exchange token. The URL may have expired — try logging in again.');
    } finally {
      props.setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    props.setBusy(true);
    try {
      await revokeOpenaiOAuth(props.agentName).catch(() => {});
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
    <>
      <Show when={!props.connected()}>
        <Show
          when={popupOpened()}
          fallback={
            <>
              <p class="provider-detail__hint">
                Log in with your {props.provDef.name} account to connect your subscription.
              </p>
              <button
                class="btn btn--primary provider-detail__action"
                disabled={props.busy()}
                onClick={handleOAuthLogin}
              >
                <Show when={!props.busy()} fallback={<span class="spinner" />}>
                  Log in with {props.provDef.name}
                </Show>
              </button>
            </>
          }
        >
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
        </Show>
      </Show>
      <Show when={props.connected()}>
        <div class="provider-detail__field">
          <span class="provider-detail__no-key">
            Connected via {props.provDef.subscriptionLabel ?? 'subscription'}
          </span>
        </div>
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
    </>
  );
};

export default OAuthDetailView;
