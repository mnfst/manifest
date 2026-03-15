import { Show, type Component, type Accessor, type Setter } from 'solid-js';
import type { ProviderDef } from '../services/providers.js';
import {
  getOpenaiOAuthUrl,
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
  const handleOAuthLogin = async () => {
    props.setBusy(true);
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

      monitorOAuthPopup(popup, {
        onSuccess: () => {
          toast.success(`${props.provDef.name} subscription connected`);
          props.onUpdate();
          props.onClose();
          props.setBusy(false);
        },
        onFailure: () => {
          toast.error('OAuth login failed. Please try again.');
          props.setBusy(false);
        },
      });
    } catch {
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
      <p class="provider-detail__hint">
        Log in with your {props.provDef.name} account to connect your subscription.
      </p>
      <Show when={!props.connected()}>
        <button
          class="btn btn--primary provider-detail__action"
          disabled={props.busy()}
          onClick={handleOAuthLogin}
        >
          <Show when={!props.busy()} fallback={<span class="spinner" />}>
            Log in with {props.provDef.name}
          </Show>
        </button>
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
