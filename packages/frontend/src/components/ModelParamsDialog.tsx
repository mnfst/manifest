import { createSignal, createEffect, For, Show, type Component } from 'solid-js';
import { getProviderParamSpecs, type ProviderParamSpec } from 'manifest-shared';
import type { RequestParamDefaults } from '../services/api.js';

interface Props {
  open: boolean;
  /** Display name for the slot, e.g. "deepseek-v4-flash". */
  slotLabel: string;
  /** Currently configured params for this route; null when none set. */
  current: RequestParamDefaults | null;
  /** The provider this route resolves to — drives which spec entries render. */
  provider: string;
  /**
   * Persist new defaults. Called with `null` when every chosen value
   * matches the provider's natural default (no override needed) and with a
   * `RequestParamDefaults` object otherwise. Returns once the save
   * completes.
   */
  onSave: (paramDefaults: RequestParamDefaults | null) => Promise<unknown>;
  onClose: () => void;
}

/**
 * Local-state shape: one string per spec key. The dialog is fully driven
 * by `getProviderParamSpecs(provider)` — adding a new provider knob is
 * one entry in `PROVIDER_PARAM_SPECS`, and (provided its control kind has
 * a renderer below) the dialog picks it up automatically.
 */
type DraftState = Record<string, string>;

const readValue = (spec: ProviderParamSpec, current: RequestParamDefaults | null): string => {
  const stored = (current as Record<string, unknown> | null)?.[spec.key];
  // Today every control has its value at `{ <key>: { type: <value> } }`.
  // When a graded knob (e.g. reasoning_effort) lands with a different wire
  // shape (`{ reasoning_effort: 'medium' }`), broaden this reader to
  // accept both shapes — the renderer below stays identical.
  if (stored && typeof stored === 'object' && 'type' in stored) {
    const v = (stored as { type: unknown }).type;
    if (typeof v === 'string') return v;
  }
  return spec.control.default;
};

const stateFromCurrent = (
  specs: readonly ProviderParamSpec[],
  current: RequestParamDefaults | null,
): DraftState => {
  const draft: DraftState = {};
  for (const spec of specs) draft[spec.key] = readValue(spec, current);
  return draft;
};

const ModelParamsDialog: Component<Props> = (props) => {
  const specs = () => getProviderParamSpecs(props.provider);
  const [draft, setDraft] = createSignal<DraftState>(stateFromCurrent(specs(), props.current));
  const [saving, setSaving] = createSignal(false);

  // Reset local state every time the dialog opens, so re-opening reflects
  // the persisted value (or the natural defaults) rather than the previous
  // unsaved draft.
  createEffect(() => {
    if (props.open) setDraft(stateFromCurrent(specs(), props.current));
  });

  const setKey = (key: string, value: string) => {
    setDraft({ ...draft(), [key]: value });
  };

  const handleSave = async () => {
    if (saving()) return;
    setSaving(true);
    try {
      // Build the persisted payload from every spec entry whose chosen
      // value differs from the provider's natural default. When everything
      // matches the defaults, pass `null` so the parent deletes the row
      // and the dashboard snapshot reflects the provider default, not an
      // explicit override.
      const out: Record<string, unknown> = {};
      for (const spec of specs()) {
        const value = draft()[spec.key];
        if (value !== spec.control.default) {
          out[spec.key] = { type: value };
        }
      }
      const next: RequestParamDefaults | null =
        Object.keys(out).length === 0 ? null : (out as RequestParamDefaults);
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
          <p class="modal-card__desc">Defaults for {props.slotLabel}. Client requests override.</p>

          <For each={specs()}>
            {(spec) => (
              <div class="model-params__row">
                <div class="model-params__label">
                  <div class="model-params__label-title">{spec.control.label}</div>
                  <div class="model-params__label-hint">
                    Provider default: {spec.control.default}
                  </div>
                </div>
                <Show when={spec.control.kind === 'toggle'}>
                  {(() => {
                    const [onValue, offValue] = spec.control.values;
                    const currentValue = () => draft()[spec.key];
                    const isOn = () => currentValue() === onValue;
                    return (
                      <button
                        type="button"
                        class="model-params__toggle"
                        aria-pressed={isOn()}
                        aria-label={`${spec.control.label}: ${currentValue()}`}
                        disabled={saving()}
                        onClick={() => setKey(spec.key, isOn() ? offValue : onValue)}
                      >
                        <span
                          class="provider-toggle__switch"
                          classList={{ 'provider-toggle__switch--on': isOn() }}
                        >
                          <span class="provider-toggle__switch-thumb" />
                        </span>
                      </button>
                    );
                  })()}
                </Show>
              </div>
            )}
          </For>

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
