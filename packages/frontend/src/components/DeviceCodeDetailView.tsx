import {
  createEffect,
  createSignal,
  For,
  onCleanup,
  Show,
  type Accessor,
  type Component,
  type Setter,
} from 'solid-js';
import type { ProviderDef } from '../services/providers.js';
import {
  connectProvider,
  getDeviceCodeApi,
  renameProviderKey,
  type AuthType,
  type MinimaxOAuthRegion,
  type RoutingProvider,
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
  addKeyOpen?: Accessor<boolean>;
  setAddKeyOpen?: Setter<boolean>;
  activeKeys?: Accessor<RoutingProvider[]>;
}

const MAX_LABEL_LENGTH = 50;

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
  const [renamingId, setRenamingId] = createSignal<string | null>(null);
  const [renameValue, setRenameValue] = createSignal('');

  const api = () => getDeviceCodeApi(props.provId);
  const isMultiKey = () => (props.activeKeys?.() ?? []).length > 1;

  // When "Add another key" is clicked in the header, launch a new device code flow.
  createEffect(() => {
    if (props.addKeyOpen?.() && props.connected() && !props.busy()) {
      props.setAddKeyOpen?.(false);
      void handleStart();
    }
  });

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
      const result = await api().revoke(props.agentName);
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
      const result = await api().revoke(props.agentName, label);
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
      const result = await api().poll(current.flowId);
      if (isDisposed || flowGeneration !== activeFlowGeneration) return;
      const latest = flow();
      if (!latest || latest.flowId !== current.flowId) {
        return;
      }

      if (result.status === 'success') {
        clearPollTimer();
        toast.success(`${props.provDef.name} subscription connected`);
        props.onUpdate();
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
      const current = api();
      const nextFlow = await current.start(
        props.agentName,
        current.hasRegion ? selectedRegion() : undefined,
      );
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
                  <Show
                    when={api().hasRegion}
                    fallback="Open the authorization page in your browser to sign in and approve access."
                  >
                    Choose your MiniMax region, then open the authorization page in your browser to
                    sign in and approve access.
                  </Show>
                </p>
                <Show when={api().hasRegion}>
                  <div class="provider-detail__field">
                    <label class="provider-detail__label" for="minimax-region">
                      Region
                    </label>
                    <select
                      id="minimax-region"
                      class="provider-detail__input"
                      value={selectedRegion()}
                      disabled={props.busy()}
                      onChange={(e) =>
                        setSelectedRegion(e.currentTarget.value as MinimaxOAuthRegion)
                      }
                    >
                      <option value="global">Global (api.minimax.io)</option>
                      <option value="cn">China Mainland (api.minimaxi.com)</option>
                    </select>
                  </div>
                </Show>
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
        {/* Multi-key list */}
        <Show when={isMultiKey()}>
          <div class="provider-detail__field">
            <label class="provider-detail__label">Accounts</label>
            <ul
              role="list"
              aria-label={`Accounts for ${props.provDef.name}`}
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

export default DeviceCodeDetailView;
