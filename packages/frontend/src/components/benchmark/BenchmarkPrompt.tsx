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

const BenchmarkPrompt: Component<Props> = (props) => {
  const [ref, setRef] = createSignal<HTMLTextAreaElement | undefined>();

  const autoGrow = () => {
    const el = ref();
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 8 * 22)}px`;
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      props.onSubmit();
      return;
    }
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      props.onSubmit();
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
        props.onSubmit();
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
