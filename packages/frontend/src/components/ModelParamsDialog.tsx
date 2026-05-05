import { createSignal, createEffect, Show, type Component } from 'solid-js';
import type { RequestParamDefaults } from '../services/api.js';

type ThinkingState = 'enabled' | 'disabled';

const stateFromDefaults = (
  d: RequestParamDefaults | null,
  providerDefault: ThinkingState,
): ThinkingState => d?.thinking?.type ?? providerDefault;

interface Props {
  open: boolean;
  /** Display name for the slot, e.g. "Standard tier" or "Coding category". */
  slotLabel: string;
  /** Currently configured defaults; null when none set. */
  current: RequestParamDefaults | null;
  /** What the upstream provider does by default for the thinking field. */
  providerDefault: ThinkingState;
  /**
   * Persist new defaults. Called with `null` when the chosen state matches
   * the provider's default (no override needed) and with `{ thinking }`
   * otherwise. Returns once the save completes.
   */
  onSave: (paramDefaults: RequestParamDefaults | null) => Promise<unknown>;
  onClose: () => void;
}

const ModelParamsDialog: Component<Props> = (props) => {
  const [thinking, setThinking] = createSignal<ThinkingState>(
    stateFromDefaults(props.current, props.providerDefault),
  );
  const [saving, setSaving] = createSignal(false);

  // Reset local state every time the dialog opens, so re-opening reflects
  // the persisted value (or the provider default) rather than the previous
  // draft.
  createEffect(() => {
    if (props.open) setThinking(stateFromDefaults(props.current, props.providerDefault));
  });

  const handleSave = async () => {
    if (saving()) return;
    setSaving(true);
    try {
      const next: RequestParamDefaults | null =
        thinking() === props.providerDefault ? null : { thinking: { type: thinking() } };
      await props.onSave(next);
      props.onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && !saving()) props.onClose();
  };

  return (
    <Show when={props.open}>
      <div
        class="modal-overlay"
        onClick={(e) => {
          if (e.target === e.currentTarget && !saving()) props.onClose();
        }}
      >
        <div
          class="modal-card"
          style="max-width: 460px;"
          role="dialog"
          aria-modal="true"
          aria-labelledby="model-params-dialog-title"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={handleKeyDown}
        >
          <h2 class="modal-card__title" id="model-params-dialog-title">
            Model parameters
          </h2>
          <p class="modal-card__desc">
            Defaults Manifest applies to outgoing requests for {props.slotLabel}. Clients can
            override by passing the field in their request body.
          </p>

          <div class="model-params__row">
            <div class="model-params__label">
              <div class="model-params__label-title">Thinking mode</div>
              <div class="model-params__label-hint">Provider default: {props.providerDefault}</div>
            </div>
            <button
              type="button"
              class="model-params__toggle"
              aria-pressed={thinking() === 'enabled'}
              aria-label={`Thinking mode: ${thinking()}`}
              disabled={saving()}
              onClick={() => setThinking(thinking() === 'enabled' ? 'disabled' : 'enabled')}
            >
              <span class="model-params__toggle-label">
                {thinking() === 'enabled' ? 'Enabled' : 'Disabled'}
              </span>
              <span
                class="provider-toggle__switch"
                classList={{ 'provider-toggle__switch--on': thinking() === 'enabled' }}
              >
                <span class="provider-toggle__switch-thumb" />
              </span>
            </button>
          </div>
          <p class="modal-card__desc" style="margin-top: 8px;">
            Disabling thinking is useful for DeepSeek models, where reasoning tokens otherwise
            consume the response budget.
          </p>

          <div class="modal-card__footer">
            <button
              class="btn btn--ghost btn--sm"
              onClick={props.onClose}
              disabled={saving()}
              type="button"
            >
              Cancel
            </button>
            <button
              class="btn btn--primary btn--sm"
              onClick={handleSave}
              disabled={saving()}
              type="button"
            >
              {saving() ? <span class="spinner" /> : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
};

export default ModelParamsDialog;
