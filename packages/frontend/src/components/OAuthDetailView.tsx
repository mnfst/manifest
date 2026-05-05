import { createSignal, Show, type Component, type Accessor, type Setter } from 'solid-js';
import type { ProviderDef } from '../services/providers.js';
import {
  getOpenaiOAuthUrl,
  revokeOpenaiOAuth,
  getGeminiOAuthUrl,
  revokeGeminiOAuth,
  disconnectProvider,
  type AuthType,
} from '../services/api.js';
import { toast } from '../services/toast-store.js';
import { monitorOAuthPopup } from '../services/oauth-popup.js';

interface OAuthDispatch {
  authorize: (agentName: string) => Promise<{ url: string }>;
  revoke: (agentName: string) => Promise<{ ok: boolean }>;
  /**
   * Provider-specific hint shown above the "Log in" button. Lets us be
   * precise about which account the user should pick — for OpenAI a generic
   * "your OpenAI account" is fine, but for Google we need to call out that
   * it must be the account that owns the AI Pro / Ultra subscription so
   * users don't sign in with a personal Google account that can't route.
   */
  loginHint: string;
  /**
   * Optional link to the provider's plans/pricing page so users without an
   * active subscription can sign up before retrying the OAuth flow.
   */
  plansUrl?: string;
  plansLabel?: string;
}

// Each `popup_oauth` provider supplies its own authorize/revoke endpoints.
// Wrapping the imports in thunks keeps the dispatch lazy so any test harness
// that mocks `services/api.js` without re-exporting every OAuth helper
// doesn't blow up during module evaluation.
const OPENAI_DISPATCH: OAuthDispatch = {
  authorize: (agentName) => getOpenaiOAuthUrl(agentName),
  revoke: (agentName) => revokeOpenaiOAuth(agentName),
  loginHint: 'Log in with your ChatGPT account to connect your subscription.',
  plansUrl: 'https://openai.com/chatgpt/pricing/',
  plansLabel: 'View ChatGPT plans',
};

const GEMINI_DISPATCH: OAuthDispatch = {
  authorize: (agentName) => getGeminiOAuthUrl(agentName),
  revoke: (agentName) => revokeGeminiOAuth(agentName),
  loginHint: 'Log in with the Google account that owns your AI Pro or Ultra subscription.',
  plansUrl: 'https://one.google.com/about/google-ai-plans/',
  plansLabel: 'View Google AI plans',
};

function getOAuthDispatch(providerId: string): OAuthDispatch {
  if (providerId === 'gemini') return GEMINI_DISPATCH;
  return OPENAI_DISPATCH;
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
  onClose: () => void;
}

const OAuthDetailView: Component<Props> = (props) => {
  const [popupOpened, setPopupOpened] = createSignal(false);
  const dispatch = () => getOAuthDispatch(props.provId);

  const handleOAuthLogin = async () => {
    props.setBusy(true);
    try {
      const { url } = await dispatch().authorize(props.agentName);
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
          // Popup closed without completing — reset so the user can retry.
          setPopupOpened(false);
          toast.error('Sign-in was cancelled. Try again.');
        },
      });
    } catch {
      props.setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    props.setBusy(true);
    try {
      await dispatch()
        .revoke(props.agentName)
        .catch(() => {});
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
              <p class="provider-detail__hint">{dispatch().loginHint}</p>
              <button
                class="btn btn--primary provider-detail__action"
                disabled={props.busy()}
                onClick={handleOAuthLogin}
              >
                <Show when={!props.busy()} fallback={<span class="spinner" />}>
                  Log in with {props.provDef.name}
                </Show>
              </button>
              <Show when={dispatch().plansUrl}>
                <p class="provider-detail__plans-hint">
                  No subscription yet?{' '}
                  <a href={dispatch().plansUrl} target="_blank" rel="noopener noreferrer">
                    {dispatch().plansLabel}
                  </a>
                </p>
              </Show>
            </>
          }
        >
          <p class="provider-detail__hint">
            A sign-in window has opened. Complete the flow there — this panel will update
            automatically once your subscription is connected.
          </p>
          <div class="provider-detail__waiting">
            <span class="spinner" aria-hidden="true" />
            <span>Waiting for sign-in to complete…</span>
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
          aria-label={`Disconnect ${props.provDef.subscriptionLabel ?? 'subscription'}`}
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
