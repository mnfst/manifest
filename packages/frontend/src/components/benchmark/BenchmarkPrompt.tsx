import { Show, createSignal, type Component, type JSX } from 'solid-js';
import { ReplayIcon, XIcon } from './icons.jsx';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onRecallPrevious: () => void;
  disabled: boolean;
  running: boolean;
  headersSlot?: JSX.Element;
  replayBanner?: {
    prompt: string;
    recordedAt: string;
    onExit: () => void;
  };
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

  const isReplay = () => props.replayBanner != null;

  return (
    <form
      class="benchmark-prompt"
      classList={{ 'benchmark-prompt--replay': isReplay() }}
      onSubmit={(event) => {
        event.preventDefault();
        props.onSubmit();
      }}
    >
      <Show
        when={!isReplay()}
        fallback={
          <div class="benchmark-prompt__banner" role="status">
            <span class="benchmark-prompt__banner-icon" aria-hidden="true">
              <ReplayIcon size={14} />
            </span>
            <span class="benchmark-prompt__banner-label">Replaying recording</span>
            <span class="benchmark-prompt__banner-prompt" title={props.replayBanner?.prompt}>
              "{props.replayBanner?.prompt ?? ''}"
            </span>
            <button
              type="button"
              class="benchmark-prompt__banner-exit"
              aria-label="Exit recording replay mode"
              onClick={() => props.replayBanner?.onExit()}
            >
              <XIcon size={14} />
            </button>
          </div>
        }
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
      </Show>
      <Show when={props.headersSlot}>{props.headersSlot}</Show>
      <button
        type="submit"
        class="benchmark-prompt__send"
        disabled={props.disabled || (!isReplay() && props.value.trim().length === 0)}
      >
        {props.running ? 'Running…' : isReplay() ? 'Re-run' : 'Send'}
      </button>
    </form>
  );
};

export default BenchmarkPrompt;
