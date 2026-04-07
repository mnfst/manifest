import { type Component } from 'solid-js';
import { type CustomProviderData, type RoutingProvider } from '../services/api.js';
import type { CustomProviderPrefill, ProviderDeepLink } from '../services/routing-params.js';
import ProviderSelectContent from './ProviderSelectContent.js';

interface Props {
  agentName: string;
  providers: RoutingProvider[];
  customProviders?: CustomProviderData[];
  customProviderPrefill?: CustomProviderPrefill | null;
  providerDeepLink?: ProviderDeepLink | null;
  onClose: () => void;
  onUpdate: () => void | Promise<void>;
}

const ProviderSelectModal: Component<Props> = (props) => {
  return (
    <div
      class="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') props.onClose();
      }}
    >
      <div
        class="modal-card"
        style="max-width: 480px; padding: 0; max-height: calc(100vh - 64px); overflow-y: auto;"
        role="dialog"
        aria-modal="true"
        aria-labelledby="provider-modal-title"
      >
        <ProviderSelectContent
          agentName={props.agentName}
          providers={props.providers}
          customProviders={props.customProviders}
          customProviderPrefill={props.customProviderPrefill}
          providerDeepLink={props.providerDeepLink}
          onUpdate={props.onUpdate}
          onClose={props.onClose}
        />
      </div>
    </div>
  );
};

export default ProviderSelectModal;
