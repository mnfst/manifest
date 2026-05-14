import { createSignal, onMount, Show, type Component, type Accessor, type Setter } from 'solid-js';
import type { ProviderDef } from '../services/providers.js';
import {
  startAnthropicOAuth,
  submitAnthropicOAuth,
  revokeAnthropicOAuth,
  getAnthropicOAuthPending,
  disconnectProvider,
  type AuthType,
} from '../services/api.js';
import { toast } from '../services/toast-store.js';

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

/**
 * Anthropic subscription connect view. Sign in with Claude opens an OAuth
 * popup; the user pastes the resulting `<code>#<state>` payload back into
 * the input. Tokens are stored as refreshable JSON blobs and rotated by
 * the proxy automatically on every request.
 */
const AnthropicOAuthDetailView: Component<Props> = (props) => {
  const [state, setState] = createSignal<string | null>(null);
  const [input, setInput] = createSignal('');
  const [error, setError] = createSignal<string | null>(null);

  // Restore any pending OAuth flow so the paste field still works after the
  // modal was closed mid-dance.
  onMount(async () => {
    if (props.connected()) return;
    try {
      const { state: pending } = await getAnthropicOAuthPending(props.agentName);
      if (pending) setState(pending);
    } catch {
      // Missing pending state just means the user hasn't started a flow yet.
    }
  });

  const handleSignIn = async () => {
    props.setBusy(true);
    setError(null);
    try {
      const { url, state: authState } = await startAnthropicOAuth(props.agentName);
      setState(authState);
      const opened = window.open(url, 'manifest-anthropic-oauth', 'noopener,noreferrer');
      if (!opened) {
        toast.error(
          'Popup was blocked by your browser. Allow popups for this site, then try again.',
        );
        setState(null);
      }
    } catch {
      // error toast from fetchMutate
    } finally {
      props.setBusy(false);
    }
  };

  const handleSubmit = async () => {
    const raw = input().trim().replace(/\s/g, '');
    if (!raw) return;

    if (!raw.includes('#')) {
      setError(
        "That doesn't look like an authorization code. Make sure you copied the full string from the redirect page.",
      );
      return;
    }

    props.setBusy(true);
    setError(null);
    try {
      // The local `state` signal may have been lost (modal close). Hydrate
      // from the backend so the user can finish without restarting the flow.
      let authState = state();
      if (!authState) {
        try {
          const pending = await getAnthropicOAuthPending(props.agentName);
          if (pending.state) {
            setState(pending.state);
            authState = pending.state;
          }
        } catch {
          // fall through to the error below
        }
      }
      if (!authState) {
        setError('Click "Sign in with Claude" first, then paste the authorization code.');
        return;
      }
      const code = raw.slice(0, raw.indexOf('#'));
      await submitAnthropicOAuth(props.agentName, code, authState);
      toast.success(`${props.provDef.name} subscription connected`);
      props.onUpdate();
      props.onClose();
    } catch {
      setError('Failed to exchange code. The code may have expired — sign in again to retry.');
    } finally {
      props.setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    props.setBusy(true);
    try {
      await revokeAnthropicOAuth(props.agentName).catch(() => {});
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
        <div class="anthropic-detail__primary">
          <p class="provider-detail__hint">
            Sign in with your Claude Pro or Max account — Manifest will route through your
            subscription with auto-refreshing tokens.
          </p>
          <button
            class="btn btn--primary anthropic-detail__btn"
            disabled={props.busy()}
            onClick={handleSignIn}
          >
            <Show when={!props.busy()} fallback={<span class="spinner" />}>
              Sign in with Claude
            </Show>
          </button>
        </div>

        <div class="anthropic-detail__alt">
          <div class="anthropic-detail__alt-divider">
            <span>Paste the authorization code</span>
          </div>
          <p class="anthropic-detail__alt-hint">
            After signing in, Anthropic's redirect page shows a code. Copy the full string and paste
            it below.
          </p>
          <input
            class="provider-detail__input provider-detail__input--masked"
            classList={{ 'provider-detail__input--error': !!error() }}
            type="text"
            autocomplete="off"
            placeholder="Authorization code"
            aria-label="Anthropic authorization code"
            value={input()}
            onInput={(e) => {
              setInput(e.currentTarget.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmit();
            }}
          />
          <Show when={error()}>
            <div class="provider-detail__error">{error()}</div>
          </Show>
          <button
            class="btn btn--primary anthropic-detail__btn"
            disabled={props.busy() || !input().trim()}
            onClick={handleSubmit}
          >
            <Show when={!props.busy()} fallback={<span class="spinner" />}>
              Connect
            </Show>
          </button>
        </div>
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

export default AnthropicOAuthDetailView;
