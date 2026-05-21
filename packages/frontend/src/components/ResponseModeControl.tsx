import { createSignal, type Accessor, type Component } from 'solid-js';
import type { ResponseMode } from '../services/api.js';

interface Props {
  value: Accessor<ResponseMode>;
  onChange: (mode: ResponseMode) => void | Promise<void>;
  disabled?: Accessor<boolean>;
  label?: string;
  compact?: boolean;
}

const OPTIONS: Array<{ value: ResponseMode; label: string }> = [
  { value: 'buffered', label: 'Buffered' },
  { value: 'stream', label: 'Stream' },
];

const ResponseModeControl: Component<Props> = (props) => {
  const [saving, setSaving] = createSignal<ResponseMode | null>(null);
  const disabled = () => saving() !== null || (props.disabled?.() ?? false);

  const handleChange = async (mode: ResponseMode) => {
    if (mode === props.value() || disabled()) return;
    setSaving(mode);
    try {
      await props.onChange(mode);
    } finally {
      setSaving(null);
    }
  };

  return (
    <div
      class="response-mode-control"
      classList={{ 'response-mode-control--compact': !!props.compact }}
    >
      <span class="response-mode-control__label">{props.label ?? 'Response mode'}</span>
      <div class="response-mode-control__segments" role="group" aria-label="Response mode">
        {OPTIONS.map((option) => (
          <button
            type="button"
            class="response-mode-control__segment"
            classList={{
              'response-mode-control__segment--active': props.value() === option.value,
              'response-mode-control__segment--loading': saving() === option.value,
            }}
            disabled={disabled()}
            onClick={() => void handleChange(option.value)}
          >
            {saving() === option.value ? <span class="spinner" /> : option.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default ResponseModeControl;
