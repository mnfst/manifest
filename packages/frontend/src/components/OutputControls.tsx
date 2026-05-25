import { createSignal, For, type Accessor, type Component } from 'solid-js';
import type { DeliveryMode } from '../services/api.js';

interface Props {
  deliveryMode: Accessor<DeliveryMode>;
  onDeliveryModeChange: (mode: DeliveryMode) => void | Promise<void>;
  disabled?: Accessor<boolean>;
  compact?: boolean;
}

const DELIVERY_OPTIONS: Array<{ value: DeliveryMode; label: string }> = [
  { value: 'buffered', label: 'Buffered' },
  { value: 'stream', label: 'Stream' },
];

const OutputControls: Component<Props> = (props) => {
  const [saving, setSaving] = createSignal<DeliveryMode | null>(null);
  const disabled = () => saving() !== null || (props.disabled?.() ?? false);

  const handleDeliveryChange = async (mode: DeliveryMode) => {
    if (mode === props.deliveryMode() || disabled()) return;
    setSaving(mode);
    try {
      await props.onDeliveryModeChange(mode);
    } finally {
      setSaving(null);
    }
  };

  return (
    <div class="output-controls" classList={{ 'output-controls--compact': !!props.compact }}>
      <div class="output-controls__field">
        <span class="output-controls__label">Responses</span>
        <div class="output-controls__segments" role="group" aria-label="Responses">
          <For each={DELIVERY_OPTIONS}>
            {(option) => (
              <button
                type="button"
                class="output-controls__segment"
                classList={{
                  'output-controls__segment--active': props.deliveryMode() === option.value,
                  'output-controls__segment--loading': saving() === option.value,
                }}
                disabled={disabled()}
                onClick={() => void handleDeliveryChange(option.value)}
              >
                {saving() === option.value ? <span class="spinner" /> : option.label}
              </button>
            )}
          </For>
        </div>
      </div>
    </div>
  );
};

export default OutputControls;
