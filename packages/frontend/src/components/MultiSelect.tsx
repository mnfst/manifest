import { createSignal, For, Show, onCleanup, type Component, type JSX } from 'solid-js';

export interface MultiSelectOption {
  label: string;
  value: string;
  /** Optional icon rendered before the label (e.g. provider logo). */
  icon?: JSX.Element;
  description?: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  /** Selected values. Empty means "no filter" (everything). */
  values: string[];
  onChange: (values: string[]) => void;
  /** Trigger text when nothing is selected (the "All …" reading). */
  placeholder: string;
  label?: string;
}

/**
 * A Select-styled dropdown whose options toggle instead of replacing each
 * other. The dropdown stays open across clicks so several options can be
 * picked in one visit; the trigger summarizes the selection (placeholder,
 * the single label, or "N selected").
 */
const MultiSelect: Component<MultiSelectProps> = (props) => {
  const [open, setOpen] = createSignal(false);
  let ref: HTMLDivElement | undefined;

  const isSelected = (value: string) => props.values.includes(value);
  const toggle = (value: string) => {
    props.onChange(
      isSelected(value) ? props.values.filter((v) => v !== value) : [...props.values, value],
    );
  };

  const triggerLabel = () => {
    if (props.values.length === 0) return props.placeholder;
    if (props.values.length === 1) {
      const opt = props.options.find((o) => o.value === props.values[0]);
      return opt?.label ?? props.placeholder;
    }
    return `${props.values.length} selected`;
  };

  const handleClickOutside = (e: MouseEvent) => {
    if (ref && !ref.contains(e.target as Node)) setOpen(false);
  };
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') setOpen(false);
  };
  if (typeof document !== 'undefined') {
    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    onCleanup(() => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    });
  }

  return (
    <div class="custom-select" ref={ref}>
      <button
        class="custom-select__trigger"
        classList={{ 'custom-select__trigger--open': open() }}
        onClick={() => setOpen(!open())}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open()}
        aria-label={props.label ?? triggerLabel()}
      >
        <span class="custom-select__value">{triggerLabel()}</span>
        <span class="custom-select__chevron" aria-hidden="true" />
      </button>
      <Show when={open()}>
        <div class="custom-select__dropdown" role="listbox" aria-multiselectable="true">
          <Show when={props.values.length > 0}>
            <button class="custom-select__option" type="button" onClick={() => props.onChange([])}>
              <span class="custom-select__option-text">
                <span>{props.placeholder}</span>
              </span>
            </button>
          </Show>
          <For each={props.options}>
            {(opt) => (
              <button
                class="custom-select__option"
                classList={{ 'custom-select__option--selected': isSelected(opt.value) }}
                onClick={() => toggle(opt.value)}
                type="button"
                role="option"
                aria-selected={isSelected(opt.value)}
                style="display: flex; align-items: center; gap: 6px;"
              >
                <input
                  type="checkbox"
                  checked={isSelected(opt.value)}
                  tabIndex={-1}
                  aria-hidden="true"
                  style="pointer-events: none; margin: 0;"
                />
                <Show when={opt.icon}>{opt.icon}</Show>
                <span class="custom-select__option-text">
                  <span>{opt.label}</span>
                  <Show when={opt.description}>
                    <span class="custom-select__option-desc">{opt.description}</span>
                  </Show>
                </span>
              </button>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};

export default MultiSelect;
