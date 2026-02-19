import { createSignal, For, Show, onCleanup, type Component } from "solid-js";

interface SelectOption {
  label: string;
  value: string;
}

interface SelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
}

const Select: Component<SelectProps> = (props) => {
  const [open, setOpen] = createSignal(false);
  let ref: HTMLDivElement | undefined;

  const selectedLabel = () => {
    const opt = props.options.find((o) => o.value === props.value);
    return opt?.label ?? props.placeholder ?? "Select...";
  };

  const handleClickOutside = (e: MouseEvent) => {
    if (ref && !ref.contains(e.target as Node)) {
      setOpen(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") setOpen(false);
  };

  if (typeof document !== "undefined") {
    document.addEventListener("click", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    onCleanup(() => {
      document.removeEventListener("click", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    });
  }

  return (
    <div class="custom-select" ref={ref}>
      <button
        class="custom-select__trigger"
        classList={{ "custom-select__trigger--open": open() }}
        onClick={() => setOpen(!open())}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open()}
        aria-label={props.label ?? selectedLabel()}
      >
        <span class="custom-select__value">{selectedLabel()}</span>
        <svg class="custom-select__chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </button>
      <Show when={open()}>
        <div class="custom-select__dropdown" role="listbox">
          <For each={props.options}>
            {(opt) => (
              <button
                class="custom-select__option"
                classList={{ "custom-select__option--selected": props.value === opt.value }}
                onClick={() => { props.onChange(opt.value); setOpen(false); }}
                type="button"
                role="option"
                aria-selected={props.value === opt.value}
              >
                {opt.label}
              </button>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};

export default Select;
