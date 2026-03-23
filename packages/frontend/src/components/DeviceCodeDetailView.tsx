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
  disconnectProvider,
  pollMinimaxOAuth,
  startMinimaxOAuth,
  type AuthType,
  type MinimaxOAuthRegion,
} from '../services/api.js';
import { toast } from '../services/toast-store.js';
import { CopyButton } from './SetupStepInstall.js';

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
  const [flowError, setFlowError] = createSignal<string | null>(null);
  const [selectedRegion, setSelectedRegion] = createSignal<MinimaxOAuthRegion>('global');
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

  const openVerificationPage = () => {
    const current = flow();
    if (!current) return;
    window.open(current.verificationUri, '_blank', 'noopener,noreferrer');
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
      setFlowError('This verification code expired. Start again to generate a new one.');
      setStatusMessage(null);
      clearPollTimer();
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
        setFlowError(result.message ?? 'MiniMax login failed. Start again to retry.');
        setStatusMessage(null);
        return;
      }

      setFlowError(null);
      setStatusMessage(result.message ?? 'Waiting for approval…');
      schedulePoll(
        result.pollIntervalMs ?? latest.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
        flowGeneration,
      );
    } catch {
      if (isDisposed || flowGeneration !== activeFlowGeneration) return;
      if (flow()?.flowId !== current.flowId) {
        return;
      }
      clearPollTimer();
      setFlowError('Failed to check approval status. Start again to retry.');
      setStatusMessage(null);
    }
  };

  const handleStart = async () => {
    props.setBusy(true);
    const flowGeneration = ++activeFlowGeneration;
    clearPollTimer();
    setFlowError(null);
    setStatusMessage(null);
    try {
      const nextFlow = await startMinimaxOAuth(props.agentName, selectedRegion());
      if (isDisposed || flowGeneration !== activeFlowGeneration) return;
      setFlow(nextFlow);
      window.open(nextFlow.verificationUri, '_blank', 'noopener,noreferrer');
      schedulePoll(nextFlow.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS, flowGeneration);
    } catch {
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
              <p class="provider-detail__hint">
                Choose your MiniMax region, then open the authorization page in your browser to sign
                in and approve access.
              </p>
              <div class="provider-detail__field" style="margin-top: 12px;">
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
                class="btn btn--primary provider-detail__action"
                style="margin-top: 12px;"
                disabled={props.busy()}
                onClick={handleStart}
              >
                <Show when={!props.busy()} fallback={<span class="spinner" />}>
                  Connect with {props.provDef.name}
                </Show>
              </button>
            </>
          }
        >
          {(activeFlow) => (
            <>
              <p class="provider-detail__hint">
                Your browser should open to the MiniMax authorization page. If MiniMax asks for a
                one-time code, enter the code shown below.
              </p>
              <div class="provider-detail__field" style="margin-top: 12px;">
                <label class="provider-detail__label">Verification Code</label>
                <div class="provider-detail__key-row">
                  <input
                    class="provider-detail__input provider-detail__input--disabled"
                    type="text"
                    value={activeFlow().userCode}
                    readonly
                    aria-label={`${props.provDef.name} verification code`}
                  />
                  <CopyButton text={activeFlow().userCode} />
                </div>
              </div>
              <div class="provider-detail__field" style="margin-top: 12px;">
                <label class="provider-detail__label">Verification Link</label>
                <div class="provider-detail__key-row">
                  <input
                    class="provider-detail__input provider-detail__input--disabled"
                    type="text"
                    value={activeFlow().verificationUri}
                    readonly
                    aria-label={`${props.provDef.name} verification link`}
                  />
                  <CopyButton text={activeFlow().verificationUri} />
                </div>
              </div>
              <div class="provider-detail__field" style="margin-top: 12px;">
                <button class="btn btn--outline btn--sm" onClick={openVerificationPage}>
                  Open verification page
                </button>
                <button
                  class="btn btn--ghost btn--sm"
                  style="margin-left: 8px;"
                  disabled={props.busy()}
                  onClick={handleStart}
                >
                  Start over
                </button>
              </div>
              <Show when={statusMessage()}>
                <p class="provider-detail__hint" style="margin-top: 12px;">
                  {statusMessage()}
                </p>
              </Show>
              <Show when={flowError()}>
                <div class="provider-detail__error" style="margin-top: 12px;">
                  {flowError()}
                </div>
              </Show>
            </>
          )}
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
