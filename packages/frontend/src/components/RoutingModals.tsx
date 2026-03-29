import { Show, type Accessor, type Component } from 'solid-js';
import ModelPickerModal from './ModelPickerModal.js';
import ProviderSelectModal from './ProviderSelectModal.js';
import RoutingInstructionModal from './RoutingInstructionModal.js';
import { DisableRoutingModal } from '../pages/RoutingPanels.js';
import type {
  TierAssignment,
  AuthType,
  CustomProviderData,
  AvailableModel,
  RoutingProvider,
} from '../services/api.js';

interface RoutingModalsProps {
  agentName: () => string;
  dropdownTier: Accessor<string | null>;
  onDropdownClose: () => void;
  fallbackPickerTier: Accessor<string | null>;
  onFallbackPickerClose: () => void;
  showProviderModal: Accessor<boolean>;
  onProviderModalClose: () => void;
  instructionModal: Accessor<'enable' | 'disable' | null>;
  instructionProvider: Accessor<string | null>;
  onInstructionClose: () => void;
  confirmDisable: Accessor<boolean>;
  disabling: Accessor<boolean>;
  onDisableCancel: () => void;
  onDisableConfirm: () => Promise<void>;
  models: () => AvailableModel[];
  tiers: () => TierAssignment[];
  customProviders: () => CustomProviderData[];
  connectedProviders: () => RoutingProvider[];
  getTier: (tierId: string) => TierAssignment | undefined;
  onOverride: (tierId: string, modelName: string, providerId: string, authType?: AuthType) => void;
  onAddFallback: (
    tierId: string,
    modelName: string,
    providerId: string,
    authType?: AuthType,
  ) => void;
  onProviderUpdate: () => Promise<void>;
}

const RoutingModals: Component<RoutingModalsProps> = (props) => (
  <>
    <Show when={props.dropdownTier()}>
      {(tierId) => (
        <ModelPickerModal
          tierId={tierId()}
          models={props.models()}
          tiers={props.tiers()}
          customProviders={props.customProviders()}
          connectedProviders={props.connectedProviders()}
          onSelect={props.onOverride}
          onClose={props.onDropdownClose}
        />
      )}
    </Show>

    <Show when={props.fallbackPickerTier()}>
      {(tierId) => {
        const currentFallbacks = () => props.getTier(tierId())?.fallback_models ?? [];
        const effectiveModel = () => {
          const t = props.getTier(tierId());
          return t ? (t.override_model ?? t.auto_assigned_model) : null;
        };
        const filteredModels = () =>
          props
            .models()
            .filter(
              (m) =>
                m.model_name !== effectiveModel() && !currentFallbacks().includes(m.model_name),
            );
        return (
          <ModelPickerModal
            tierId={tierId()}
            models={filteredModels()}
            tiers={props.tiers()}
            customProviders={props.customProviders()}
            connectedProviders={props.connectedProviders()}
            onSelect={props.onAddFallback}
            onClose={props.onFallbackPickerClose}
          />
        );
      }}
    </Show>

    <Show when={props.showProviderModal()}>
      <ProviderSelectModal
        agentName={props.agentName()}
        providers={props.connectedProviders()}
        customProviders={props.customProviders()}
        onClose={props.onProviderModalClose}
        onUpdate={props.onProviderUpdate}
      />
    </Show>

    <RoutingInstructionModal
      open={props.instructionModal() !== null}
      mode={props.instructionModal() ?? 'enable'}
      agentName={props.agentName()}
      connectedProvider={props.instructionProvider()}
      onClose={props.onInstructionClose}
    />

    <DisableRoutingModal
      open={props.confirmDisable()}
      disabling={props.disabling}
      onCancel={props.onDisableCancel}
      onConfirm={props.onDisableConfirm}
    />
  </>
);

export default RoutingModals;
