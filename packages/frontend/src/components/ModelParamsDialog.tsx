import { createEffect, createSignal, For, Show, type Component } from 'solid-js';
import {
  compareProviderParamSpecs,
  getProviderParamValue,
  providerParamIsApplicable,
  setProviderParamValue,
  type JsonValue,
  type ModelParamGroup,
  type ProviderParamSpec,
} from 'manifest-shared';
import type { RequestParamDefaults } from '../services/api.js';
import Select from './Select.jsx';

interface Props {
  open: boolean;
  slotLabel: string;
  current: RequestParamDefaults | null;
  specs: readonly ProviderParamSpec[];
  // True while the per-model specs are still being fetched (dialog opens
  // immediately, specs arrive async).
  loading?: boolean;
  onSave: (paramDefaults: RequestParamDefaults | null) => Promise<unknown>;
  onClose: () => void;
}

type DraftState = Record<string, JsonValue>;

const GROUP_LABELS: Record<ModelParamGroup, string> = {
  generation_length: 'Generation length',
  sampling: 'Sampling',
  reasoning: 'Reasoning',
  tooling: 'Tooling',
  output_format: 'Output format',
  observability: 'Observability',
  provider_metadata: 'Provider metadata',
};

const GROUP_ORDER: readonly ModelParamGroup[] = [
  'generation_length',
  'sampling',
  'reasoning',
  'tooling',
  'output_format',
  'observability',
  'provider_metadata',
];

const stateFromCurrent = (
  specs: readonly ProviderParamSpec[],
  current: RequestParamDefaults | null,
): DraftState => {
  let draft: DraftState = {};
  for (const spec of specs) {
    if (spec.default !== undefined) {
      draft = setProviderParamValue(draft, spec.path, spec.default);
    }
  }
  if (!current) return draft;
  for (const spec of specs) {
    const stored = getProviderParamValue(current, spec.path);
    if (stored !== undefined) draft = setProviderParamValue(draft, spec.path, stored as JsonValue);
  }
  return draft;
};

const groupSpecs = (specs: readonly ProviderParamSpec[]) =>
  GROUP_ORDER.map((group) => ({
    group,
    specs: specs.filter((spec) => spec.group === group).sort(compareProviderParamSpecs),
  })).filter((item) => item.specs.length > 0);

const valuesEqual = (a: unknown, b: unknown) =>
  typeof a === 'object' || typeof b === 'object'
    ? /* v8 ignore next -- current MPS entries compare primitives; keep defensive JsonValue equality. */
      JSON.stringify(a) === JSON.stringify(b)
    : a === b;

const clampNumber = (value: number, fallback: number, min?: number, max?: number): number => {
  if (!Number.isFinite(value)) return fallback;
  let next = value;
  if (min !== undefined) next = Math.max(min, next);
  if (max !== undefined) next = Math.min(max, next);
  return next;
};

const decimalPlaces = (value: number): number => {
  const text = String(value);
  return text.includes('.') ? (text.split('.')[1]?.length ?? 0) : 0;
};

const numberDefault = (spec: ProviderParamSpec): number =>
  typeof spec.default === 'number' ? spec.default : 0;

const ModelParamsDialog: Component<Props> = (props) => {
  const [draft, setDraft] = createSignal<DraftState>(stateFromCurrent(props.specs, props.current));
  const [saving, setSaving] = createSignal(false);

  createEffect(() => {
    if (props.open) setDraft(stateFromCurrent(props.specs, props.current));
  });

  const valueFor = (spec: ProviderParamSpec): JsonValue | undefined => {
    const value = getProviderParamValue(draft(), spec.path);
    return (value === undefined ? spec.default : value) as JsonValue | undefined;
  };

  const setValue = (spec: ProviderParamSpec, value: JsonValue) => {
    setDraft(setProviderParamValue(draft(), spec.path, value));
  };

  const isApplicable = (spec: ProviderParamSpec): boolean =>
    providerParamIsApplicable(spec, draft());
  const isDisabled = (spec: ProviderParamSpec): boolean => saving() || !isApplicable(spec);

  const stringValue = (spec: ProviderParamSpec): string => {
    const value = valueFor(spec);
    return typeof value === 'string' ? value : String(spec.default ?? '');
  };

  const numericValue = (spec: ProviderParamSpec): number => {
    const value = valueFor(spec);
    return typeof value === 'number' && Number.isFinite(value) ? value : numberDefault(spec);
  };

  const sliderStep = (spec: ProviderParamSpec): number => spec.range?.step ?? 1;

  const sliderValue = (raw: number, spec: ProviderParamSpec): number => {
    const min = spec.range?.min ?? 0;
    const max = spec.range?.max ?? 100;
    const step = sliderStep(spec);
    const snapped = Math.round((raw - min) / step) * step + min;
    const clamped = clampNumber(snapped, numberDefault(spec), min, max);
    return Number(clamped.toFixed(decimalPlaces(step)));
  };

  const ToggleRow = (spec: ProviderParamSpec) => {
    const currentValue = () => valueFor(spec);
    const values = () => (spec.values ?? []) as readonly JsonValue[];
    const onValue = () => values().find((v) => String(v) === 'enabled') ?? values()[0] ?? true;
    const offValue = () => values().find((v) => String(v) === 'disabled') ?? values()[1] ?? false;
    const isOn = () => valuesEqual(currentValue(), onValue());
    return (
      <button
        type="button"
        class="model-params__toggle"
        aria-pressed={isOn()}
        aria-label={`${spec.label}: ${String(currentValue())}`}
        disabled={isDisabled(spec)}
        onClick={() => setValue(spec, isOn() ? offValue() : onValue())}
      >
        <span class="provider-toggle__switch" classList={{ 'provider-toggle__switch--on': isOn() }}>
          <span class="provider-toggle__switch-thumb" />
        </span>
      </button>
    );
  };

  const SelectRow = (spec: ProviderParamSpec) => (
    <div class="model-params__field">
      <Select
        label={spec.label}
        options={(spec.values ?? []).map((v) => ({ label: String(v), value: String(v) }))}
        value={stringValue(spec)}
        disabled={isDisabled(spec)}
        onChange={(v) => setValue(spec, v)}
      />
    </div>
  );

  const SliderRow = (spec: ProviderParamSpec) => {
    let sliderRef: HTMLDivElement | undefined;
    const min = () => spec.range?.min ?? 0;
    const max = () => spec.range?.max ?? 100;
    const value = () => numericValue(spec);
    const progress = () => {
      const span = max() - min();
      if (span <= 0) return 0;
      return clampNumber(((value() - min()) / span) * 100, 0, 0, 100);
    };
    const setSliderValue = (next: number) => {
      if (isDisabled(spec)) return;
      setValue(spec, sliderValue(next, spec));
    };
    const setFromPointer = (clientX: number) => {
      if (!sliderRef) return;
      const rect = sliderRef.getBoundingClientRect();
      const ratio = clampNumber((clientX - rect.left) / rect.width, 0, 0, 1);
      setSliderValue(min() + ratio * (max() - min()));
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isDisabled(spec)) return;
      const step = sliderStep(spec);
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        e.preventDefault();
        setSliderValue(value() - step);
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        e.preventDefault();
        setSliderValue(value() + step);
      } else if (e.key === 'Home') {
        e.preventDefault();
        setSliderValue(min());
      } else if (e.key === 'End') {
        e.preventDefault();
        setSliderValue(max());
      }
    };

    return (
      <div class="model-params__range">
        <div
          ref={sliderRef}
          class="model-params__slider"
          role="slider"
          tabIndex={isDisabled(spec) ? -1 : 0}
          aria-label={spec.label}
          aria-valuemin={min()}
          aria-valuemax={max()}
          aria-valuenow={value()}
          aria-valuetext={String(value())}
          aria-disabled={isDisabled(spec)}
          style={`--model-params-slider-progress: ${progress()}%;`}
          onPointerDown={(e) => {
            if (isDisabled(spec)) return;
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
          min={min()}
          max={max()}
          step={sliderStep(spec)}
          value={value()}
          disabled={isDisabled(spec)}
          aria-label={`${spec.label} value`}
          onInput={(e) => setSliderValue(Number.parseFloat(e.currentTarget.value))}
        />
      </div>
    );
  };

  const NumberRow = (spec: ProviderParamSpec) => {
    const value = () => numericValue(spec);
    const setFromInput = (raw: string) => {
      if (isDisabled(spec)) return;
      const parsed = Number.parseFloat(raw);
      const clamped = clampNumber(parsed, numberDefault(spec), spec.range?.min, spec.range?.max);
      setValue(spec, spec.type === 'integer' ? Math.trunc(clamped) : clamped);
    };
    return (
      <input
        class="model-params__number"
        type="number"
        min={spec.range?.min}
        max={spec.range?.max}
        value={value()}
        disabled={isDisabled(spec)}
        aria-label={spec.label}
        onInput={(e) => setFromInput(e.currentTarget.value)}
      />
    );
  };

  const renderControl = (spec: ProviderParamSpec) => {
    if (spec.type === 'boolean') return ToggleRow(spec);
    if (spec.type === 'enum') {
      const values = spec.values?.map(String) ?? [];
      if (values.length === 2 && values.includes('enabled') && values.includes('disabled')) {
        return ToggleRow(spec);
      }
      return SelectRow(spec);
    }
    if ((spec.type === 'integer' || spec.type === 'number') && spec.range?.max !== undefined) {
      return SliderRow(spec);
    }
    return NumberRow(spec);
  };

  const handleSave = async () => {
    if (saving()) return;
    setSaving(true);
    try {
      let out: RequestParamDefaults = {};
      const nestedRootsWithOverrides = new Set(
        props.specs
          .filter((spec) => spec.path.includes('.'))
          .filter((spec) => isApplicable(spec))
          .filter((spec) => !valuesEqual(valueFor(spec), spec.default))
          .map((spec) => spec.path.split('.')[0]),
      );

      for (const spec of props.specs) {
        if (!isApplicable(spec)) continue;
        const value = valueFor(spec);
        if (value === undefined) continue;
        const root = spec.path.split('.')[0];
        const includeNestedDefault =
          spec.path.includes('.') && nestedRootsWithOverrides.has(root) && value !== undefined;
        if (includeNestedDefault || !valuesEqual(value, spec.default)) {
          out = setProviderParamValue(out, spec.path, value);
        }
      }

      await props.onSave(Object.keys(out).length === 0 ? null : out);
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
        classList={{ 'model-params__row--disabled': !isApplicable(spec()) }}
      >
        <div class="model-params__label">
          <div class="model-params__label-title">
            <span>{spec().label}</span>
            <code class="model-params__param-key">{spec().path}</code>
          </div>
          <div class="model-params__label-hint">
            {isApplicable(spec())
              ? `Provider default: ${spec().default === undefined ? 'unset' : String(spec().default)}`
              : 'Unavailable with selected parameters'}
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

          <Show
            when={!props.loading}
            fallback={
              <div class="model-params__status">
                <span class="spinner" />
                <span>Loading parameters…</span>
              </div>
            }
          >
            <Show
              when={props.specs.length > 0}
              fallback={
                <p class="model-params__status">This model has no configurable parameters.</p>
              }
            >
              <For each={groupSpecs(props.specs)}>
                {(group) => (
                  <div class="model-params__group">
                    <div class="model-params__group-header">{GROUP_LABELS[group.group]}</div>
                    <For each={group.specs}>{(spec) => <ParamRow spec={spec} />}</For>
                  </div>
                )}
              </For>
            </Show>
          </Show>

          <div class="modal-card__footer">
            <button
              class="btn btn--ghost btn--sm"
              onClick={props.onClose}
              disabled={saving()}
              type="button"
            >
              {!props.loading && props.specs.length > 0 ? 'Cancel' : 'Close'}
            </button>
            <Show when={!props.loading && props.specs.length > 0}>
              <button
                class="btn btn--primary btn--sm"
                onClick={handleSave}
                disabled={saving()}
                type="button"
              >
                {saving() ? <span class="spinner" /> : 'Save'}
              </button>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  );
};

export default ModelParamsDialog;
