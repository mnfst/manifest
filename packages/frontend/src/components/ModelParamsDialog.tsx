import {
  compareProviderParamSpecs,
  getProviderParamValue,
  providerParamIsApplicable,
  setProviderParamValue,
  type JsonValue,
  type ModelParamGroup,
  type ProviderParamSpec,
} from 'manifest-shared';
import { createEffect, createSignal, For, Show, type Component } from 'solid-js';
import { Portal } from 'solid-js/web';
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

const GROUP_INTROS: Record<ModelParamGroup, string> = {
  generation_length: 'Controls how much text the model can produce in a single response.',
  sampling: 'Adjusts randomness and diversity in the generated output.',
  reasoning: 'Controls extended thinking where the model reasons before answering.',
  tooling: 'Configures how the model calls external tools and functions.',
  output_format: 'Constrains the shape of the response.',
  observability: 'Metadata fields for tracing and debugging requests.',
  provider_metadata: 'Provider-specific options outside standard categories.',
};

const PARAM_HINTS: Record<string, string> = {
  temperature:
    'Low values give focused, deterministic answers. High values give more creative, varied responses.',
  top_p:
    'Limits token choices to the most probable ones whose cumulative probability reaches this threshold. Lower values make output more focused.',
  top_k:
    'Limits token choices to the top K most probable tokens at each step. Lower values make output more predictable.',
  max_tokens:
    'The model stops when it finishes or reaches this limit. A higher value allows longer answers but does not force them.',
  'thinking.type':
    'When enabled, the model reasons step by step before answering. Uses more tokens but improves accuracy on complex tasks.',
  'thinking.budget_tokens':
    'Maximum number of tokens the model can spend on its internal reasoning before producing the final answer.',
  reasoning_effort:
    'How much effort the model puts into reasoning. Lower values are faster and cheaper, higher values are more thorough.',
  frequency_penalty:
    'Penalizes tokens that already appeared in the output. Higher values reduce repetition.',
  presence_penalty:
    'Penalizes tokens that appeared at all in the conversation. Higher values encourage the model to cover new topics.',
  tool_choice:
    'Controls whether the model must call a tool, can optionally call one, or is prevented from calling tools.',
  parallel_tool_use:
    'When enabled, the model can call multiple tools in a single turn instead of one at a time.',
  response_format: 'Forces the model to produce output in a specific format, such as valid JSON.',
  stream:
    'When enabled, the response arrives incrementally as it is generated instead of all at once.',
  store: 'When enabled, the request and response are stored by the provider for later inspection.',
  service_tier: 'Selects between standard and priority processing tiers offered by the provider.',
};

const paramHint = (spec: ProviderParamSpec): string => PARAM_HINTS[spec.path] ?? spec.description;

const rangeLabel = (spec: ProviderParamSpec): string | null => {
  if (!spec.range) return null;
  const { min, max } = spec.range;
  if (min !== undefined && max !== undefined) return `${min}–${max}`;
  if (min !== undefined) return `min ${min}`;
  if (max !== undefined) return `max ${max}`;
  return null;
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
    let startX = 0;
    let startValue = 0;
    const min = () => spec.range?.min ?? 0;
    const max = () => spec.range?.max ?? 100;
    const value = () => numericValue(spec);
    const setSliderVal = (next: number) => {
      if (isDisabled(spec)) return;
      setValue(spec, sliderValue(next, spec));
    };
    const pixelsPerUnit = () => {
      const span = max() - min();
      if (span <= 0) return 1;
      return 120 / span;
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isDisabled(spec)) return;
      const step = sliderStep(spec);
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        e.preventDefault();
        setSliderVal(value() - step);
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        e.preventDefault();
        setSliderVal(value() + step);
      } else if (e.key === 'Home') {
        e.preventDefault();
        setSliderVal(min());
      } else if (e.key === 'End') {
        e.preventDefault();
        setSliderVal(max());
      }
    };

    return (
      <div
        class="model-params__scrub-field"
        classList={{ 'model-params__scrub-field--disabled': isDisabled(spec) }}
      >
        <div
          class="model-params__scrub"
          role="slider"
          tabIndex={isDisabled(spec) ? -1 : 0}
          aria-label={spec.label}
          aria-valuemin={min()}
          aria-valuemax={max()}
          aria-valuenow={value()}
          aria-valuetext={String(value())}
          aria-disabled={isDisabled(spec)}
          onPointerDown={(e) => {
            if (isDisabled(spec)) return;
            e.preventDefault();
            startX = e.clientX;
            startValue = value();
            e.currentTarget.setPointerCapture?.(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!e.currentTarget.hasPointerCapture?.(e.pointerId)) return;
            const delta = (e.clientX - startX) / pixelsPerUnit();
            setSliderVal(startValue + delta);
          }}
          onPointerUp={(e) => e.currentTarget.releasePointerCapture?.(e.pointerId)}
          onPointerCancel={(e) => e.currentTarget.releasePointerCapture?.(e.pointerId)}
          onKeyDown={handleKeyDown}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            fill="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M5 3a2 2 0 1 0 0 4 2 2 0 1 0 0-4m7 0a2 2 0 1 0 0 4 2 2 0 1 0 0-4m7 0a2 2 0 1 0 0 4 2 2 0 1 0 0-4M5 10a2 2 0 1 0 0 4 2 2 0 1 0 0-4m7 0a2 2 0 1 0 0 4 2 2 0 1 0 0-4m7 0a2 2 0 1 0 0 4 2 2 0 1 0 0-4M5 17a2 2 0 1 0 0 4 2 2 0 1 0 0-4m7 0a2 2 0 1 0 0 4 2 2 0 1 0 0-4m7.33 0a2 2 0 1 0 0 4 2 2 0 1 0 0-4" />
          </svg>
        </div>
        <input
          class="model-params__scrub-input"
          type="number"
          min={min()}
          max={max()}
          step={sliderStep(spec)}
          value={value()}
          disabled={isDisabled(spec)}
          aria-label={`${spec.label} value`}
          onInput={(e) => setSliderVal(Number.parseFloat(e.currentTarget.value))}
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
        <div class="model-params__row-top">
          <div class="model-params__label-title">
            <span>{spec().label}</span>
            <code class="model-params__param-key">{spec().path}</code>
          </div>
          {renderControl(spec())}
        </div>
        <div class="model-params__label-hint">
          {isApplicable(spec())
            ? `Default: ${spec().default === undefined ? 'unset' : String(spec().default)}`
            : 'Unavailable with selected parameters'}
        </div>
      </div>
    );
  };

  return (
    <Portal>
      <Show when={props.open}>
        <div
          class="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget && !saving()) props.onClose();
          }}
        >
          <div
            class="modal-card"
            style="max-width: 460px; user-select: none;"
            role="dialog"
            aria-modal="true"
            aria-labelledby="model-params-dialog-title"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={handleKeyDown}
          >
            <h2 class="modal-card__title" id="model-params-dialog-title">
              Model parameters
            </h2>
            <p class="modal-card__desc">Manifest parameters for {props.slotLabel}.</p>

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
                      <div class="model-params__group-header">
                        <span>{GROUP_LABELS[group.group]}</span>
                        <span class="model-params__group-info">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="13"
                            height="13"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                          >
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 16v-4" />
                            <path d="M12 8h.01" />
                          </svg>
                          <span class="model-params__group-tooltip">
                            <span class="model-params__tooltip-intro">
                              {GROUP_INTROS[group.group]}
                            </span>
                            <For each={group.specs}>
                              {(spec) => (
                                <span class="model-params__tooltip-param">
                                  <strong>{spec.label}</strong>
                                  <Show when={rangeLabel(spec)}>
                                    {' '}
                                    <span class="model-params__tooltip-range">
                                      {rangeLabel(spec)}
                                    </span>
                                  </Show>
                                  <br />
                                  {paramHint(spec)}
                                </span>
                              )}
                            </For>
                          </span>
                        </span>
                      </div>
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
    </Portal>
  );
};

export default ModelParamsDialog;
