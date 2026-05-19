import { createSignal, createEffect, For, Show, type Component } from 'solid-js';
import type { ParamControl, ProviderParamSpec } from 'manifest-shared';
import type { JsonValue, RequestParamDefaults } from '../services/api.js';
import Select from './Select.jsx';

interface Props {
  open: boolean;
  /** Display name for the slot, e.g. "deepseek-v4-flash". */
  slotLabel: string;
  /** Currently configured params for this route; null when none set. */
  current: RequestParamDefaults | null;
  /** Provider/auth/model-resolved specs loaded from the backend registry. */
  specs: readonly ProviderParamSpec[];
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
 * Local-state shape: one UI/storage value per spec key. The dialog is fully
 * driven by backend-loaded provider param specs — adding a new provider
 * knob is one database row, and the matching control kind below renders it
 * automatically.
 */
type DraftState = Record<string, JsonValue>;

const readValue = (spec: ProviderParamSpec, current: RequestParamDefaults | null): JsonValue => {
  const stored = (current as Record<string, unknown> | null)?.[spec.key];
  return stored === undefined ? spec.control.default : (stored as JsonValue);
};

const stateFromCurrent = (
  specs: readonly ProviderParamSpec[],
  current: RequestParamDefaults | null,
): DraftState => {
  const draft: DraftState = {};
  for (const spec of specs) draft[spec.key] = readValue(spec, current);
  return draft;
};

type ToggleControl = Extract<ParamControl, { kind: 'toggle' }>;
type SelectControl = Extract<ParamControl, { kind: 'select' }>;
type SliderControl = Extract<ParamControl, { kind: 'slider' }>;
type NumberControl = Extract<ParamControl, { kind: 'number' }>;

const clampNumber = (value: number, fallback: number, min?: number, max?: number): number => {
  if (!Number.isFinite(value)) return fallback;
  let next = value;
  if (min !== undefined) next = Math.max(min, next);
  if (max !== undefined) next = Math.min(max, next);
  return next;
};

const decimalPlaces = (value: number): number => {
  const text = String(value);
  if (!text.includes('.')) return 0;
  return text.split('.')[1]?.length ?? 0;
};

const sliderStep = (control: SliderControl): number => control.step ?? 1;

const sliderValue = (value: number, control: SliderControl): number => {
  const step = sliderStep(control);
  const snapped = Math.round((value - control.min) / step) * step + control.min;
  const clamped = clampNumber(snapped, control.default, control.min, control.max);
  return Number(clamped.toFixed(decimalPlaces(step)));
};

const ModelParamsDialog: Component<Props> = (props) => {
  const specs = () => props.specs;
  const [draft, setDraft] = createSignal<DraftState>(stateFromCurrent(specs(), props.current));
  const [saving, setSaving] = createSignal(false);

  // Reset local state every time the dialog opens, so re-opening reflects
  // the persisted value (or the natural defaults) rather than the previous
  // unsaved draft.
  createEffect(() => {
    if (props.open) setDraft(stateFromCurrent(specs(), props.current));
  });

  const setKey = (key: string, value: JsonValue) => {
    setDraft({ ...draft(), [key]: value });
  };

  const stringValue = (spec: ProviderParamSpec, control: ToggleControl | SelectControl) => {
    const value = draft()[spec.key];
    return typeof value === 'string' ? value : control.default;
  };

  const numericValue = (spec: ProviderParamSpec, control: SliderControl | NumberControl) => {
    const value = draft()[spec.key];
    return typeof value === 'number' && Number.isFinite(value) ? value : control.default;
  };

  const ToggleRow = (spec: ProviderParamSpec, control: ToggleControl) => {
    const [onValue, offValue] = control.values;
    const currentValue = () => stringValue(spec, control);
    const isOn = () => currentValue() === onValue;
    return (
      <button
        type="button"
        class="model-params__toggle"
        aria-pressed={isOn()}
        aria-label={`${control.label}: ${currentValue()}`}
        disabled={saving()}
        onClick={() => setKey(spec.key, isOn() ? offValue : onValue)}
      >
        <span class="provider-toggle__switch" classList={{ 'provider-toggle__switch--on': isOn() }}>
          <span class="provider-toggle__switch-thumb" />
        </span>
      </button>
    );
  };

  const SelectRow = (spec: ProviderParamSpec, control: SelectControl) => (
    <div class="model-params__field">
      <Select
        label={control.label}
        options={control.values.map((v) => ({ label: v, value: v }))}
        value={stringValue(spec, control)}
        onChange={(v) => setKey(spec.key, v)}
      />
    </div>
  );

  const SliderRow = (spec: ProviderParamSpec, control: SliderControl) => {
    let sliderRef: HTMLDivElement | undefined;
    const value = () => numericValue(spec, control);
    const progress = () => {
      const span = control.max - control.min;
      if (span <= 0) return 0;
      return clampNumber(((value() - control.min) / span) * 100, 0, 0, 100);
    };
    const setSliderValue = (next: number) => {
      setKey(spec.key, sliderValue(next, control));
    };
    const setFromPointer = (clientX: number) => {
      if (!sliderRef) return;
      const rect = sliderRef.getBoundingClientRect();
      const ratio = clampNumber((clientX - rect.left) / rect.width, 0, 0, 1);
      setSliderValue(control.min + ratio * (control.max - control.min));
    };
    const setFromTextInput = (raw: string) => {
      setSliderValue(Number.parseFloat(raw));
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (saving()) return;
      const step = sliderStep(control);
      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowDown':
          e.preventDefault();
          setSliderValue(value() - step);
          break;
        case 'ArrowRight':
        case 'ArrowUp':
          e.preventDefault();
          setSliderValue(value() + step);
          break;
        case 'Home':
          e.preventDefault();
          setSliderValue(control.min);
          break;
        case 'End':
          e.preventDefault();
          setSliderValue(control.max);
          break;
      }
    };
    return (
      <div class="model-params__range">
        <div
          ref={sliderRef}
          class="model-params__slider"
          role="slider"
          tabIndex={saving() ? -1 : 0}
          aria-label={control.label}
          aria-valuemin={control.min}
          aria-valuemax={control.max}
          aria-valuenow={value()}
          aria-valuetext={String(value())}
          aria-disabled={saving()}
          style={`--model-params-slider-progress: ${progress()}%;`}
          onPointerDown={(e) => {
            if (saving()) return;
            e.preventDefault();
            e.currentTarget.setPointerCapture?.(e.pointerId);
            setFromPointer(e.clientX);
          }}
          onPointerMove={(e) => {
            if (!e.currentTarget.hasPointerCapture?.(e.pointerId)) return;
            setFromPointer(e.clientX);
          }}
          onPointerUp={(e) => e.currentTarget.releasePointerCapture?.(e.pointerId)}
          onPointerCancel={(e) => e.currentTarget.releasePointerCapture?.(e.pointerId)}
          onKeyDown={handleKeyDown}
        >
          <span class="model-params__slider-track" aria-hidden="true">
            <span class="model-params__slider-fill" />
          </span>
          <span class="model-params__slider-thumb" aria-hidden="true" />
        </div>
        <input
          class="model-params__slider-input"
          type="number"
          min={control.min}
          max={control.max}
          step={sliderStep(control)}
          value={value()}
          disabled={saving()}
          aria-label={`${control.label} value`}
          onInput={(e) => setFromTextInput(e.currentTarget.value)}
        />
      </div>
    );
  };

  const NumberRow = (spec: ProviderParamSpec, control: NumberControl) => {
    const value = () => numericValue(spec, control);
    const setFromInput = (raw: string) => {
      const parsed = Number.parseFloat(raw);
      setKey(spec.key, clampNumber(parsed, control.default, control.min, control.max));
    };
    return (
      <input
        class="model-params__number"
        type="number"
        min={control.min}
        max={control.max}
        value={value()}
        disabled={saving()}
        aria-label={control.label}
        onInput={(e) => setFromInput(e.currentTarget.value)}
      />
    );
  };

  const renderControl = (spec: ProviderParamSpec) => {
    const control = spec.control;
    switch (control.kind) {
      case 'toggle':
        return ToggleRow(spec, control);
      case 'select':
        return SelectRow(spec, control);
      case 'slider':
        return SliderRow(spec, control);
      case 'number':
        return NumberRow(spec, control);
    }
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
      const out: RequestParamDefaults = {};
      for (const spec of specs()) {
        const value = draft()[spec.key] ?? spec.control.default;
        if (value !== spec.control.default) {
          out[spec.key] = value;
        }
      }
      const next: RequestParamDefaults | null = Object.keys(out).length === 0 ? null : out;
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
                  <div class="model-params__label-title">
                    <span>{spec.control.label}</span>
                    <code class="model-params__param-key">{spec.key}</code>
                  </div>
                  <div class="model-params__label-hint">
                    Provider default: {spec.control.default}
                  </div>
                </div>
                {renderControl(spec)}
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
