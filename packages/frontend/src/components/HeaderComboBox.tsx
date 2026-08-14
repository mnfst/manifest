import { createSignal, For, Show, type Component } from 'solid-js';

export interface HeaderSuggestion {
  label: string;
  sublabel?: string;
  group?: string;
  value: string;
}

interface Props {
  id?: string;
  value: string;
  onInput: (v: string) => void;
  suggestions: HeaderSuggestion[];
  placeholder?: string;
  invalid?: boolean;
  errorMessage?: string;
  disabled?: boolean;
  freeFormHint?: string;
}

const HeaderComboBox: Component<Props> = (props) => {
  const [open, setOpen] = createSignal(false);
  const [hoverIdx, setHoverIdx] = createSignal(-1);

  const filtered = () => {
    const q = props.value.trim().toLowerCase();
    if (!q) return props.suggestions;
    return props.suggestions.filter(
      (s) => s.value.toLowerCase().includes(q) || s.label.toLowerCase().includes(q),
    );
  };

  const showFreeForm = () =>
    props.value.trim() !== '' &&
    !props.suggestions.some((s) => s.value.toLowerCase() === props.value.trim().toLowerCase());

  const select = (val: string): void => {
    props.onInput(val);
    setOpen(false);
  };

  const onKeyDown = (e: KeyboardEvent): void => {
    if (!open()) return;
    const items = filtered();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHoverIdx(Math.min(hoverIdx() + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHoverIdx(Math.max(hoverIdx() - 1, -1));
    } else if (e.key === 'Enter' && hoverIdx() >= 0) {
      e.preventDefault();
      const pick = items[hoverIdx()];
      if (pick) select(pick.value);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div class="header-combo" classList={{ 'header-combo--invalid': props.invalid ?? false }}>
      <input
        id={props.id}
        class="header-combo__input"
        type="text"
        value={props.value}
        placeholder={props.placeholder}
        disabled={props.disabled}
        autocomplete="off"
        spellcheck={false}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onInput={(e) => {
          props.onInput(e.currentTarget.value);
          setOpen(true);
          setHoverIdx(-1);
        }}
        onKeyDown={onKeyDown}
      />
      <Show when={open() && (filtered().length > 0 || showFreeForm())}>
        <ul class="header-combo__menu" role="listbox">
          <For each={filtered()}>
            {(item, idx) => (
              <li
                role="option"
                aria-selected={hoverIdx() === idx()}
                classList={{ 'header-combo__option--hover': hoverIdx() === idx() }}
                class="header-combo__option"
                onMouseEnter={() => setHoverIdx(idx())}
                onMouseDown={(e) => {
                  e.preventDefault();
                  select(item.value);
                }}
              >
                <div class="header-combo__option-row">
                  <span class="header-combo__option-label">{item.label}</span>
                  <Show when={item.group}>
                    <span class="header-combo__option-group">{item.group}</span>
                  </Show>
                </div>
                <Show when={item.sublabel}>
                  <div class="header-combo__option-sublabel">{item.sublabel}</div>
                </Show>
              </li>
            )}
          </For>
          <Show when={showFreeForm()}>
            <li
              class="header-combo__option header-combo__option--free"
              onMouseDown={(e) => {
                e.preventDefault();
                select(props.value.trim());
              }}
            >
              {props.freeFormHint ?? `Use "${props.value.trim()}" as a custom entry`}
            </li>
          </Show>
        </ul>
      </Show>
      <Show when={props.invalid && props.errorMessage}>
        <div class="header-combo__error" role="alert">
          {props.errorMessage}
        </div>
      </Show>
    </div>
  );
};

export default HeaderComboBox;
