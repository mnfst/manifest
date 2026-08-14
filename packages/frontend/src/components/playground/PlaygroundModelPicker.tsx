import type { Component } from 'solid-js';
import type {
  AuthType,
  AvailableModel,
  CustomProviderData,
  RoutingProvider,
} from '../../services/api.js';
import ModelPickerModal from '../ModelPickerModal.jsx';

interface Props {
  /** Unique-per-column id so we know which column the selection is for. */
  columnId: string;
  models: AvailableModel[];
  customProviders?: CustomProviderData[];
  connectedProviders?: RoutingProvider[];
  onSelect: (columnId: string, model: string, provider: string, authType?: AuthType) => void;
  onClose: () => void;
}

/**
 * Thin wrapper around `ModelPickerModal` for the Playground page. Hides the
 * `tierId` convention (the underlying modal was designed for routing tiers) so
 * callers work with a clean `(model, provider, authType)` callback.
 */
const PlaygroundModelPicker: Component<Props> = (props) => (
  <ModelPickerModal
    tierId={`playground:${props.columnId}`}
    models={props.models}
    tiers={[]}
    customProviders={props.customProviders}
    connectedProviders={props.connectedProviders}
    onSelect={(_tierId, model, provider, authType) =>
      props.onSelect(props.columnId, model, provider, authType)
    }
    onClose={props.onClose}
  />
);

export default PlaygroundModelPicker;
