import {
  createSignal,
  onCleanup,
  Show,
  type Accessor,
  type Component,
  type Setter,
} from 'solid-js';
import type { ProviderDef } from '../services/providers.js';
import {
  connectProvider,
  disconnectProvider,
  pollMinimaxOAuth,
  startMinimaxOAuth,
  type AuthType,
  type MinimaxOAuthRegion,
} from '../services/api.js';
import { validateSubscriptionKey } from '../services/provider-utils.js';
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

interface DeviceCodeFlow {
  flowId: string;
  userCode: string;
  verificationUri: string;
  expiresAt: number;
  pollIntervalMs: number;
}

const DEFAULT_POLL_INTERVAL_MS = 2000;

const DeviceCodeDetailView: Component<Props> = (props) => {
  const [flow, setFlow] = createSignal<DeviceCodeFlow | null>(null);
  const [statusMessage, setStatusMessage] = createSignal<string | null>(null);
  const [selectedRegion, setSelectedRegion] = createSignal<MinimaxOAuthRegion>('global');
  const [altToken, setAltToken] = createSignal('');
  const [altError, setAltError] = createSignal<string | null>(null);

  const handleAltConnect = async () => {
    const trimmed = altToken().replace(/\s/g, '');
    const result = validateSubscriptionKey(props.provDef, trimmed);
    if (!result.valid) {
      setAltError(result.error!);
      return;
    }
    props.setBusy(true);
    try {
      await connectProvider(props.agentName, {
        provider: props.provId,
        apiKey: trimmed,
        authType: 'subscription',
        // Region is OAuth-flow state, but a pasted Coding Plan token still
        // needs to route to the right MiniMax host (api.minimax.io vs
        // api.minimaxi.com). Stick the picker's current value on the row so
        // the proxy fallback honors CN tokens.
        region: selectedRegion(),
      });
      toast.success(`${props.provDef.name} subscription connected`);
      props.onUpdate();
      props.onClose();
    } catch {
      // error toast from fetchMutate
    } finally {
      props.setBusy(false);
    }
  };
  let pollTimer: number | undefined;
  let isDisposed = false;
  let activeFlowGeneration = 0;

  const clearPollTimer = () => {
    if (pollTimer !== undefined) {
      window.clearTimeout(pollTimer);
      pollTimer = undefined;
    }
  };

  const schedulePoll = (delayMs: number, flowGeneration = activeFlowGeneration) => {
    clearPollTimer();
    if (isDisposed || flowGeneration !== activeFlowGeneration) return;
    pollTimer = window.setTimeout(() => {
      if (isDisposed || flowGeneration !== activeFlowGeneration) return;
      void runPoll(flowGeneration);
    }, delayMs);
  };

  const handleDisconnect = async () => {
    props.setBusy(true);
    try {
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

  const runPoll = async (flowGeneration = activeFlowGeneration) => {
    if (isDisposed || flowGeneration !== activeFlowGeneration) return;
    const current = flow();
    if (!current) return;

    if (Date.now() >= current.expiresAt) {
      clearPollTimer();
      setStatusMessage(null);
      setFlow(null);
      toast.error('This verification code expired. Start again to generate a new one.');
      return;
    }

    try {
      const result = await pollMinimaxOAuth(current.flowId);
      if (isDisposed || flowGeneration !== activeFlowGeneration) return;
      const latest = flow();
      if (!latest || latest.flowId !== current.flowId) {
        return;
      }

      if (result.status === 'success') {
        clearPollTimer();
        toast.success(`${props.provDef.name} subscription connected`);
        props.onUpdate();
        props.onClose();
        return;
      }

      if (result.status === 'error') {
        clearPollTimer();
        setStatusMessage(null);
        setFlow(null);
        toast.error(result.message ?? `${props.provDef.name} login failed. Start again to retry.`);
        return;
      }

      setStatusMessage(result.message ?? 'Waiting for approval…');
      schedulePoll(
        result.pollIntervalMs ?? latest.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
        flowGeneration,
      );
    } catch {
      if (isDisposed || flowGeneration !== activeFlowGeneration) return;
      clearPollTimer();
      setStatusMessage(null);
      setFlow(null);
      toast.error('Failed to check approval status. Start again to retry.');
    }
  };

  const handleStart = async () => {
    // Open the popup synchronously inside the click handler to keep the
    // user-gesture flag alive; without this, browsers block the post-await
    // window.open as a "programmatic popup". noopener can't be used here
    // because Chrome returns null with it set, and we need the popup ref
    // to redirect it later — we null `popup.opener` ourselves instead.
    const popup = window.open('about:blank', '_blank');
    if (!popup) {
      toast.error('Popup was blocked by your browser. Allow popups for this site, then try again.');
      return;
    }
    // Defang the opener-attack vector that noopener would normally prevent;
    // the popup is about:blank (same-origin) so this assignment can't throw.
    popup.opener = null;

    props.setBusy(true);
    const flowGeneration = ++activeFlowGeneration;
    clearPollTimer();
    setStatusMessage(null);
    try {
      const nextFlow = await startMinimaxOAuth(props.agentName, selectedRegion());
      if (isDisposed || flowGeneration !== activeFlowGeneration) {
        popup.close();
        return;
      }
      popup.location.replace(nextFlow.verificationUri);
      setFlow(nextFlow);
      schedulePoll(nextFlow.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS, flowGeneration);
    } catch {
      popup.close();
      if (isDisposed || flowGeneration !== activeFlowGeneration) return;
      setFlow(null);
    } finally {
      if (isDisposed || flowGeneration !== activeFlowGeneration) return;
      props.setBusy(false);
    }
  };

  onCleanup(() => {
    isDisposed = true;
    activeFlowGeneration += 1;
    clearPollTimer();
  });

  return (
    <>
      <Show when={!props.connected()}>
        <Show
          when={flow()}
          fallback={
            <>
              <div class="subscription-detail__primary">
                <p class="provider-detail__hint" style="margin-bottom: 0;">
                  Choose your MiniMax region, then open the authorization page in your browser to
                  sign in and approve access.
                </p>
                <div class="provider-detail__field">
                  <label class="provider-detail__label" for="minimax-region">
                    Region
                  </label>
                  <select
                    id="minimax-region"
                    class="provider-detail__input"
                    value={selectedRegion()}
                    disabled={props.busy()}
                    onChange={(e) => setSelectedRegion(e.currentTarget.value as MinimaxOAuthRegion)}
                  >
                    <option value="global">Global (api.minimax.io)</option>
                    <option value="cn">China Mainland (api.minimaxi.com)</option>
                  </select>
                </div>
                <button
                  class="btn btn--primary subscription-detail__btn"
                  disabled={props.busy()}
                  onClick={handleStart}
                >
                  <Show when={!props.busy()} fallback={<span class="spinner" />}>
                    Connect with {props.provDef.name}
                  </Show>
                </button>
              </div>
              <Show when={props.provDef.subscriptionTokenAlternative}>
                {(alt) => (
                  <div class="subscription-detail__alt">
                    <div class="subscription-detail__alt-divider">
                      <span>{alt().dividerLabel}</span>
                    </div>
                    <input
                      id="minimax-alt-token"
                      class="provider-detail__input provider-detail__input--masked"
                      classList={{ 'provider-detail__input--error': !!altError() }}
                      type="text"
                      autocomplete="off"
                      placeholder={alt().placeholder}
                      aria-label={`${props.provDef.name} Coding Plan token`}
                      value={altToken()}
                      disabled={props.busy()}
                      onInput={(e) => {
                        setAltToken(e.currentTarget.value);
                        setAltError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAltConnect();
                      }}
                    />
                    <Show when={altError()}>
                      <div class="provider-detail__error">{altError()}</div>
                    </Show>
                    <button
                      class="btn btn--outline subscription-detail__btn"
                      disabled={props.busy() || !altToken().trim()}
                      onClick={handleAltConnect}
                    >
                      <Show when={!props.busy()} fallback={<span class="spinner" />}>
                        Connect with token
                      </Show>
                    </button>
                  </div>
                )}
              </Show>
            </>
          }
        >
          <>
            <p class="provider-detail__hint">
              A new tab opened with the {props.provDef.name} authorization page. Approve the request
              there to finish connecting.
            </p>
            <Show when={statusMessage()}>
              <p class="provider-detail__hint" style="margin-top: 12px;">
                {statusMessage()}
              </p>
            </Show>
          </>
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

export default DeviceCodeDetailView;
