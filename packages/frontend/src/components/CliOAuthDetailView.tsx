import { Show, type Accessor, type Component, type Setter } from 'solid-js';
import type { ProviderDef } from '../services/providers.js';
import {
  connectKiroCliOAuth,
  disconnectProvider,
  type AuthType,
  type RoutingProvider,
} from '../services/api.js';
import { toast } from '../services/toast-store.js';
import CopyButton from './CopyButton.js';

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
  activeKeys?: Accessor<RoutingProvider[]>;
}

const KIRO_LOGIN_COMMAND = 'kiro-cli login --use-device-flow';

const CliOAuthDetailView: Component<Props> = (props) => {
  const handleConnect = async () => {
    props.setBusy(true);
    try {
      await connectKiroCliOAuth(props.agentName);
      toast.success(`${props.provDef.name} subscription connected`);
      props.onUpdate();
    } catch {
      // error toast from fetchMutate
    } finally {
      props.setBusy(false);
    }
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
        for (const msg of result.notifications) toast.error(msg);
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
        <p class="provider-detail__hint">
          Uses your local Kiro CLI login. Run this once if Kiro CLI is not signed in, then connect.
        </p>
        <div class="modal-terminal">
          <div class="modal-terminal__header">
            <div class="modal-terminal__dots">
              <span class="modal-terminal__dot modal-terminal__dot--red" />
              <span class="modal-terminal__dot modal-terminal__dot--yellow" />
              <span class="modal-terminal__dot modal-terminal__dot--green" />
            </div>
            <div class="modal-terminal__tabs">
              <span class="modal-terminal__tab modal-terminal__tab--active">Terminal</span>
            </div>
          </div>
          <div class="modal-terminal__body">
            <CopyButton text={KIRO_LOGIN_COMMAND} />
            <div>
              <span class="modal-terminal__prompt">$</span>
              <span class="modal-terminal__code">{KIRO_LOGIN_COMMAND}</span>
            </div>
          </div>
        </div>
        <button
          class="btn btn--primary provider-detail__action"
          aria-label="Connect with Kiro CLI"
          disabled={props.busy()}
          onClick={handleConnect}
        >
          <Show when={!props.busy()} fallback={<span class="spinner" />}>
            Connect with Kiro CLI
          </Show>
        </button>
      </Show>

      <Show when={props.connected()}>
        <div class="provider-detail__field">
          <span class="provider-detail__no-key">Connected via local Kiro CLI login</span>
        </div>
        <button
          class="btn btn--outline provider-detail__action provider-detail__disconnect"
          aria-label="Disconnect Kiro CLI"
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

export default CliOAuthDetailView;
