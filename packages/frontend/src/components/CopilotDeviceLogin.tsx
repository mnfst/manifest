import { createSignal, onCleanup, Show, type Component } from 'solid-js';
import { providerIcon } from './ProviderIcon.js';
import {
  copilotDeviceCode,
  copilotPollToken,
  disconnectProvider,
  type CopilotPollStatus,
} from '../services/api.js';
import { toast } from '../services/toast-store.js';

type Phase = 'idle' | 'loading' | 'awaiting' | 'success' | 'error';

interface Props {
  agentName: string;
  connected: boolean;
  onBack: () => void;
  onConnected: () => void;
  onDisconnected: () => void;
}

const SLOW_DOWN_INCREASE = 5;
const MAX_POLL_ERRORS = 5;

const CopilotDeviceLogin: Component<Props> = (props) => {
  const [phase, setPhase] = createSignal<Phase>('idle');
  const [userCode, setUserCode] = createSignal('');
  const [verificationUri, setVerificationUri] = createSignal('');
  const [deviceCode, setDeviceCode] = createSignal('');
  const [error, setError] = createSignal('');
  const [busy, setBusy] = createSignal(false);
  let pollTimeout: ReturnType<typeof setTimeout> | undefined;
  let cancelled = false;

  onCleanup(() => {
    cancelled = true;
    if (pollTimeout) clearTimeout(pollTimeout);
  });

  const startLogin = async () => {
    setPhase('loading');
    setError('');
    cancelled = false;
    try {
      const result = await copilotDeviceCode(props.agentName);
      setUserCode(result.user_code);
      setVerificationUri(result.verification_uri);
      setDeviceCode(result.device_code);
      setPhase('awaiting');
      schedulePoll(result.device_code, Math.max(result.interval, 5));
    } catch {
      setError('Failed to start GitHub login. Please try again.');
      setPhase('error');
    }
  };

  const schedulePoll = (code: string, delaySec: number, errorCount = 0) => {
    if (cancelled) return;
    pollTimeout = setTimeout(async () => {
      if (cancelled) return;
      try {
        const result = await copilotPollToken(props.agentName, code);
        if (cancelled) return;
        const next = handlePollResult(result.status, delaySec);
        if (next > 0) schedulePoll(code, next, 0);
      } catch {
        if (cancelled) return;
        const nextErrors = errorCount + 1;
        if (nextErrors >= MAX_POLL_ERRORS) {
          setError('Connection lost. Please try again.');
          setPhase('error');
        } else {
          schedulePoll(code, delaySec, nextErrors);
        }
      }
    }, delaySec * 1000);
  };

  /** Returns next delay (seconds), or 0 to stop. */
  const handlePollResult = (status: CopilotPollStatus, currentDelay: number): number => {
    if (status === 'complete') {
      setPhase('success');
      toast.success('GitHub Copilot connected');
      props.onConnected();
      return 0;
    }
    if (status === 'expired') {
      setError('Device code expired. Please try again.');
      setPhase('error');
      return 0;
    }
    if (status === 'denied') {
      setError('Authorization was denied.');
      setPhase('error');
      return 0;
    }
    if (status === 'slow_down') {
      return currentDelay + SLOW_DOWN_INCREASE;
    }
    return currentDelay;
  };

  const stopPolling = () => {
    cancelled = true;
    if (pollTimeout) {
      clearTimeout(pollTimeout);
      pollTimeout = undefined;
    }
  };

  const handleDisconnect = async () => {
    setBusy(true);
    try {
      const result = await disconnectProvider(props.agentName, 'copilot', 'subscription');
      if (result?.notifications?.length) {
        for (const msg of result.notifications) toast.error(msg);
      }
      props.onDisconnected();
    } catch {
      /* error toast from fetchMutate */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div class="provider-detail">
      <button class="provider-detail__back" onClick={props.onBack} aria-label="Back to providers">
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

      <div class="routing-modal__header" style="border: none; padding: 0; margin-bottom: 20px;">
        <div>
          <div class="routing-modal__title">Connect providers</div>
          <div class="routing-modal__subtitle">Sign in with GitHub to connect Copilot</div>
        </div>
      </div>

      <div class="provider-detail__header">
        <span class="provider-detail__icon">{providerIcon('copilot', 28)}</span>
        <div class="provider-detail__title-group">
          <div class="provider-detail__name">GitHub Copilot</div>
        </div>
      </div>

      {/* Connected state */}
      <Show when={props.connected && phase() !== 'success'}>
        <p class="provider-detail__hint" style="color: var(--success-color, #22c55e);">
          Connected via GitHub device login.
        </p>
        <button
          class="btn btn--outline provider-detail__action provider-detail__disconnect"
          disabled={busy()}
          onClick={handleDisconnect}
        >
          <Show when={!busy()} fallback={<span class="spinner" />}>
            Disconnect
          </Show>
        </button>
      </Show>

      {/* Idle / Error — show start button */}
      <Show when={!props.connected && (phase() === 'idle' || phase() === 'error')}>
        <p class="provider-detail__hint">
          Requires an active GitHub Copilot subscription. This will open a GitHub device login.
        </p>
        <Show when={error()}>
          <div class="provider-detail__error">{error()}</div>
        </Show>
        <button class="btn btn--primary provider-detail__action" onClick={startLogin}>
          Sign in with GitHub
        </button>
      </Show>

      {/* Loading — fetching device code */}
      <Show when={phase() === 'loading'}>
        <div class="provider-detail__field" style="text-align: center; padding: 24px 0;">
          <span class="spinner" />
        </div>
      </Show>

      {/* Awaiting — show code + URL */}
      <Show when={phase() === 'awaiting'}>
        <div class="copilot-device-login__code-box">
          <p class="provider-detail__hint" style="margin-bottom: 12px;">
            Open GitHub and enter this code:
          </p>
          <div class="copilot-device-login__code" aria-label="Device code">
            {userCode()}
          </div>
          <a
            class="btn btn--primary provider-detail__action"
            href={verificationUri()}
            target="_blank"
            rel="noopener noreferrer"
            style="display: inline-block; text-align: center; text-decoration: none; margin-top: 16px;"
          >
            Open GitHub
          </a>
          <p class="copilot-device-login__waiting">
            <span class="spinner" style="width: 14px; height: 14px; margin-right: 8px;" />
            Waiting for authorization...
          </p>
        </div>
      </Show>

      {/* Success */}
      <Show when={phase() === 'success'}>
        <p class="provider-detail__hint" style="color: var(--success-color, #22c55e);">
          GitHub Copilot connected successfully.
        </p>
      </Show>
    </div>
  );
};

export default CopilotDeviceLogin;
