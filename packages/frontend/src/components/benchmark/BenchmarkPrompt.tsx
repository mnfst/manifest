import { Show, createSignal, type Component, type JSX } from 'solid-js';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onRecallPrevious: () => void;
  disabled: boolean;
  running: boolean;
  headersSlot?: JSX.Element;
}

// Soft cap on the textarea height so a long prompt doesn't push the model
// columns off-screen on a small laptop. The "8 lines" target is by design;
// past that the textarea scrolls internally.
const MAX_PROMPT_LINES = 8;
const PROMPT_LINE_HEIGHT_PX = 22;

const BenchmarkPrompt: Component<Props> = (props) => {
  const [ref, setRef] = createSignal<HTMLTextAreaElement | undefined>();

  const autoGrow = () => {
    const el = ref();
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_PROMPT_LINES * PROMPT_LINE_HEIGHT_PX)}px`;
  };

  const submit = () => {
    if (props.disabled || props.running) return;
    if (props.value.trim().length === 0) return;
    props.onSubmit();
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    // Don't fire mid-IME composition (Japanese / Chinese / Korean users
    // press Enter to confirm a candidate; without this they'd submit on
    // every confirm). `keyCode === 229` is the legacy fallback browsers
    // emit while composing.
    const composing =
      (event as KeyboardEvent & { isComposing?: boolean }).isComposing || event.keyCode === 229;
    if (composing) return;

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
      return;
    }
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      submit();
      return;
    }
    if (event.key === 'ArrowUp' && props.value.length === 0) {
      event.preventDefault();
      props.onRecallPrevious();
    }
  };

  return (
    <form
      class="benchmark-prompt"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <textarea
        ref={setRef}
        class="benchmark-prompt__textarea"
        placeholder="Type a prompt and send it to every model at once…"
        value={props.value}
        rows={1}
        disabled={props.disabled && !props.running}
        onInput={(event) => {
          props.onChange(event.currentTarget.value);
          autoGrow();
        }}
        onKeyDown={handleKeyDown}
        aria-label="Benchmark prompt"
      />
      <Show when={props.headersSlot}>{props.headersSlot}</Show>
      <button
        type="submit"
        class="benchmark-prompt__send"
        disabled={props.disabled || props.value.trim().length === 0}
      >
        {props.running ? 'Running…' : 'Send'}
      </button>
    </form>
  );
};

export default BenchmarkPrompt;
