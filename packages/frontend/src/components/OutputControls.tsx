import { createSignal, For, type Accessor, type Component } from 'solid-js';
import type { ResponseMode } from '../services/api.js';
import { t } from '../i18n/index.js';

interface Props {
  responseMode: Accessor<ResponseMode>;
  onResponseModeChange: (mode: ResponseMode) => void | Promise<void>;
  disabled?: Accessor<boolean>;
  compact?: boolean;
}

const OutputControls: Component<Props> = (props) => {
  const [saving, setSaving] = createSignal<ResponseMode | null>(null);
  const disabled = () => saving() !== null || (props.disabled?.() ?? false);

  const handleResponseChange = async (mode: ResponseMode) => {
    if (mode === props.responseMode() || disabled()) return;
    setSaving(mode);
    try {
      await props.onResponseModeChange(mode);
    } finally {
      setSaving(null);
    }
  };

  return (
    <div class="output-controls" classList={{ 'output-controls--compact': !!props.compact }}>
      <div class="output-controls__field">
        <span class="output-controls__label">{t('responseMode.title')}</span>
        <div class="output-controls__segments" role="group" aria-label={t('responseMode.title')}>
          <For
            each={[
              { value: 'buffered' as ResponseMode, label: t('responseMode.buffered') },
              { value: 'stream' as ResponseMode, label: t('responseMode.stream') },
            ]}
          >
            {(option) => (
              <button
                type="button"
                class="output-controls__segment"
                classList={{
                  'output-controls__segment--active': props.responseMode() === option.value,
                  'output-controls__segment--loading': saving() === option.value,
                }}
                disabled={disabled()}
                onClick={() => void handleResponseChange(option.value)}
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
