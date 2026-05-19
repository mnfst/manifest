import { createSignal, createEffect, For, Show, type Component } from 'solid-js';
import {
  providerParamHasEffect,
  providerParamStorageKey,
  type ParamControl,
  type ProviderParamSpec,
} from 'manifest-shared';
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

type SpecRenderItem =
  | { kind: 'spec'; spec: ProviderParamSpec }
  | { kind: 'group'; key: string; label: string; specs: ProviderParamSpec[] };

const isRecord = (value: unknown): value is Record<string, JsonValue> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const valuesEqual = (a: JsonValue, b: JsonValue) =>
  typeof a === 'object' || typeof b === 'object'
    ? JSON.stringify(a) === JSON.stringify(b)
    : a === b;

const readValue = (spec: ProviderParamSpec, current: RequestParamDefaults | null): JsonValue => {
  const storageKey = providerParamStorageKey(spec);
  const stored = (current as Record<string, unknown> | null)?.[storageKey];
  if (spec.group) {
    const groupValue = isRecord(stored) ? stored[spec.key] : undefined;
    return groupValue === undefined ? spec.control.default : groupValue;
  }
  if (stored && typeof stored === 'object' && !Array.isArray(stored) && 'type' in stored) {
    return (stored as { type: JsonValue }).type;
  }
  return stored === undefined ? spec.control.default : (stored as JsonValue);
};

const stateFromCurrent = (
  specs: readonly ProviderParamSpec[],
  current: RequestParamDefaults | null,
): DraftState => {
  const draft: DraftState = {};
  for (const spec of specs) {
    const storageKey = providerParamStorageKey(spec);
    if (spec.group) {
      const existing = isRecord(draft[storageKey]) ? draft[storageKey] : {};
      draft[storageKey] = { ...existing, [spec.key]: readValue(spec, current) };
      continue;
    }
    draft[storageKey] = readValue(spec, current);
  }
  return draft;
};

const renderItemsFromSpecs = (specs: readonly ProviderParamSpec[]): SpecRenderItem[] => {
  const items: SpecRenderItem[] = [];
  const seenGroups = new Set<string>();
  for (const spec of specs) {
    if (!spec.group) {
      items.push({ kind: 'spec', spec });
      continue;
    }
    if (seenGroups.has(spec.group.key)) continue;
    seenGroups.add(spec.group.key);
    items.push({
      kind: 'group',
      key: spec.group.key,
      label: spec.group.label,
      specs: specs.filter((s) => s.group?.key === spec.group?.key),
    });
  }
  return items;
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
  const renderItems = () => renderItemsFromSpecs(specs());
  const [draft, setDraft] = createSignal<DraftState>(stateFromCurrent(specs(), props.current));
  const [saving, setSaving] = createSignal(false);

  // Reset local state every time the dialog opens, so re-opening reflects
  // the persisted value (or the natural defaults) rather than the previous
  // unsaved draft.
  createEffect(() => {
    if (props.open) setDraft(stateFromCurrent(specs(), props.current));
  });

  const specValue = (spec: ProviderParamSpec): JsonValue => {
    const storageKey = providerParamStorageKey(spec);
    const stored = draft()[storageKey];
    if (!spec.group) return stored ?? spec.control.default;
    const groupValue = isRecord(stored) ? stored[spec.key] : undefined;
    return groupValue === undefined ? spec.control.default : groupValue;
  };

  const setSpecValue = (spec: ProviderParamSpec, value: JsonValue) => {
    const storageKey = providerParamStorageKey(spec);
    if (!spec.group) {
      setDraft({ ...draft(), [storageKey]: value });
      return;
    }
    const existing = draft()[storageKey];
    const nextGroup = isRecord(existing) ? { ...existing } : {};
    nextGroup[spec.key] = value;
    setDraft({ ...draft(), [storageKey]: nextGroup });
  };

  const isSpecVisible = (spec: ProviderParamSpec): boolean => {
    if (!spec.visibleWhen) return true;
    const storageKey = providerParamStorageKey(spec);
    const source = spec.group ? draft()[storageKey] : draft();
    const actual = isRecord(source) ? source[spec.visibleWhen.key] : undefined;
    return valuesEqual(actual ?? null, spec.visibleWhen.equals);
  };
  const isSpecDisabled = (spec: ProviderParamSpec): boolean =>
    providerParamHasEffect(spec, draft(), 'disable');
  const isControlDisabled = (spec: ProviderParamSpec): boolean => saving() || isSpecDisabled(spec);

  const stringValue = (spec: ProviderParamSpec, control: ToggleControl | SelectControl) => {
    const value = specValue(spec);
    return typeof value === 'string' ? value : control.default;
  };

  const numericValue = (spec: ProviderParamSpec, control: SliderControl | NumberControl) => {
    const value = specValue(spec);
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
        disabled={isControlDisabled(spec)}
        onClick={() => setSpecValue(spec, isOn() ? offValue : onValue)}
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
        disabled={isControlDisabled(spec)}
        onChange={(v) => setSpecValue(spec, v)}
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
      if (isControlDisabled(spec)) return;
      setSpecValue(spec, sliderValue(next, control));
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
      if (isControlDisabled(spec)) return;
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
          tabIndex={isControlDisabled(spec) ? -1 : 0}
          aria-label={control.label}
          aria-valuemin={control.min}
          aria-valuemax={control.max}
          aria-valuenow={value()}
          aria-valuetext={String(value())}
          aria-disabled={isControlDisabled(spec)}
          style={`--model-params-slider-progress: ${progress()}%;`}
          onPointerDown={(e) => {
            if (isControlDisabled(spec)) return;
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
          disabled={isControlDisabled(spec)}
          aria-label={`${control.label} value`}
          onInput={(e) => setFromTextInput(e.currentTarget.value)}
        />
      </div>
    );
  };

  const NumberRow = (spec: ProviderParamSpec, control: NumberControl) => {
    const value = () => numericValue(spec, control);
    const setFromInput = (raw: string) => {
      if (isControlDisabled(spec)) return;
      const parsed = Number.parseFloat(raw);
      setSpecValue(spec, clampNumber(parsed, control.default, control.min, control.max));
    };
    return (
      <input
        class="model-params__number"
        type="number"
        min={control.min}
        max={control.max}
        value={value()}
        disabled={isControlDisabled(spec)}
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
      const handledGroups = new Set<string>();
      for (const spec of specs()) {
        const storageKey = providerParamStorageKey(spec);
        if (spec.group) {
          if (handledGroups.has(storageKey)) continue;
          handledGroups.add(storageKey);
          const groupSpecs = specs().filter((s) => s.group?.key === spec.group?.key);
          const visibleSpecs = groupSpecs.filter(
            (groupSpec) => isSpecVisible(groupSpec) && !isSpecDisabled(groupSpec),
          );
          const hasOverride = visibleSpecs.some(
            (s) => !valuesEqual(specValue(s), s.control.default),
          );
          if (!hasOverride) continue;
          const value: Record<string, JsonValue> = {};
          for (const groupSpec of visibleSpecs) value[groupSpec.key] = specValue(groupSpec);
          out[storageKey] = value;
          continue;
        }
        if (isSpecDisabled(spec)) continue;
        const value = specValue(spec);
        if (!valuesEqual(value, spec.control.default)) {
          out[storageKey] = value;
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

  const ParamRow = (rowProps: { spec: ProviderParamSpec }) => {
    const spec = () => rowProps.spec;
    return (
      <div
        class="model-params__row"
        classList={{ 'model-params__row--disabled': isSpecDisabled(spec()) }}
      >
        <div class="model-params__label">
          <div class="model-params__label-title">
            <span>{spec().control.label}</span>
            <code class="model-params__param-key">{spec().key}</code>
          </div>
          <div class="model-params__label-hint">
            {isSpecDisabled(spec())
              ? 'Unavailable with selected parameters'
              : `Provider default: ${spec().control.default}`}
          </div>
        </div>
        {renderControl(spec())}
      </div>
    );
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

          <For each={renderItems()}>
            {(item) =>
              item.kind === 'group' ? (
                <div class="model-params__group">
                  <div class="model-params__group-header">
                    <span>{item.label}</span>
                    <code class="model-params__param-key">{item.key}</code>
                  </div>
                  <For each={item.specs}>
                    {(spec) => (
                      <Show when={isSpecVisible(spec)}>
                        <ParamRow spec={spec} />
                      </Show>
                    )}
                  </For>
                </div>
              ) : (
                <Show when={isSpecVisible(item.spec)}>
                  <ParamRow spec={item.spec} />
                </Show>
              )
            }
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
