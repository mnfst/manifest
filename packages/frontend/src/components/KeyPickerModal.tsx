import { For, type Component } from 'solid-js';
import type { RoutingProvider } from '../services/api.js';
import { t } from '../i18n/index.js';

export interface KeyPickerModalProps {
  /** Display name of the provider (e.g. "Google"). */
  providerName: string;
  /** Display name of the model the user just picked (e.g. "Gemini 2.5 Pro"). */
  modelName: string;
  /** Active api_key chain for the provider, sorted by priority ASC. */
  keys: RoutingProvider[];
  /**
   * Called when the user picks a key. Pass `null` to leave the tier on Auto
   * (proxy resolves to the priority-0 / Primary key at request time).
   */
  onPick: (label: string | null) => void;
  onClose: () => void;
}

const KeyPickerModal: Component<KeyPickerModalProps> = (props) => (
  <div
    class="modal-overlay"
    role="dialog"
    aria-modal="true"
    aria-labelledby="key-picker-modal-title"
    onClick={(e) => {
      if (e.target === e.currentTarget) props.onClose();
    }}
  >
    <div class="modal" style="max-width: 420px;" onClick={(e) => e.stopPropagation()}>
      <header
        class="modal__header"
        style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;"
      >
        <div>
          <h2 id="key-picker-modal-title" style="margin: 0; font-size: var(--font-size-lg);">
            {t('keyPicker.title', { provider: props.providerName })}
          </h2>
          <p style="margin: 4px 0 0; font-size: var(--font-size-sm); color: hsl(var(--muted-foreground));">
            {t('keyPicker.descriptionPrefix')} <strong>{props.modelName}</strong>
          </p>
        </div>
        <button
          class="modal__close"
          aria-label={t('components.close')}
          onClick={props.onClose}
          style="background: none; border: none; cursor: pointer; font-size: 18px; padding: 4px;"
        >
          ×
        </button>
      </header>
      <div class="modal__body" style="padding: 12px 16px 16px;">
        <ul
          role="list"
          aria-label={t('keyPicker.choose', { provider: props.providerName })}
          style="list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px;"
        >
          <For each={props.keys}>
            {(k) => (
              <li>
                <button
                  type="button"
                  class="key-picker-modal__option"
                  onClick={() => props.onPick(k.label)}
                  style="width: 100%; text-align: left; padding: 10px 12px; border: 1px solid hsl(var(--border)); border-radius: 6px; background: hsl(var(--background)); color: hsl(var(--foreground)); cursor: pointer;"
                >
                  <div style="font-weight: 500;">{k.label}</div>
                  <div style="font-size: var(--font-size-xs); color: hsl(var(--muted-foreground));">
                    {k.key_prefix ? `${k.key_prefix}${'•'.repeat(8)}` : '••••••••••••'}
                  </div>
                </button>
              </li>
            )}
          </For>
        </ul>
      </div>
    </div>
  </div>
);

export default KeyPickerModal;
