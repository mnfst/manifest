import { Show, createMemo, createSignal, type Component, type JSX } from 'solid-js';
import {
  coerceContentToText,
  oneLinePreview,
  type ChatMessage,
} from './recorded-message-helpers.js';

interface Props {
  lastUser: ChatMessage | null;
  assistantReply: ChatMessage | null;
  onJumpToLastUser?: () => void;
  onJumpToAssistant?: () => void;
}

function Block(props: {
  title: string;
  empty: string;
  message: ChatMessage | null;
  accent: 'user' | 'assistant';
  onJump?: () => void;
}): JSX.Element {
  const [expanded, setExpanded] = createSignal(false);
  const text = createMemo(() => (props.message ? coerceContentToText(props.message.content) : ''));
  const isLong = () => text().length > 400;
  const visible = () => (expanded() || !isLong() ? text() : oneLinePreview(text(), 400));
  const calls = () => props.message?.tool_calls ?? [];
  return (
    <div
      class="recorded-modal__essentials-card"
      classList={{
        'recorded-modal__essentials-card--user': props.accent === 'user',
        'recorded-modal__essentials-card--assistant': props.accent === 'assistant',
      }}
    >
      <div class="recorded-modal__essentials-head">
        <span class="recorded-modal__essentials-title">{props.title}</span>
        <Show when={props.onJump}>
          <button type="button" class="recorded-modal__essentials-jump" onClick={props.onJump}>
            View in conversation
          </button>
        </Show>
      </div>
      <Show
        when={props.message}
        fallback={<div class="recorded-modal__essentials-empty">{props.empty}</div>}
      >
        <Show when={text()}>
          <div class="recorded-modal__essentials-body">{visible()}</div>
          <Show when={isLong()}>
            <button
              type="button"
              class="recorded-modal__essentials-more"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded() ? 'Show less' : 'Show full'}
            </button>
          </Show>
        </Show>
        <Show when={calls().length > 0}>
          <div class="recorded-modal__essentials-tools">
            <span class="recorded-modal__pill recorded-modal__pill--tool">tool calls</span>
            {calls().length}:{' '}
            {calls()
              .map((c) => c.function?.name ?? 'unknown')
              .join(', ')}
          </div>
        </Show>
      </Show>
    </div>
  );
}

const RecordedEssentials: Component<Props> = (props) => {
  return (
    <div class="recorded-modal__essentials">
      <Block
        title="Final user message"
        empty="No user turn in this recording."
        message={props.lastUser}
        accent="user"
        onJump={props.onJumpToLastUser}
      />
      <Block
        title="Assistant reply"
        empty="Response not captured."
        message={props.assistantReply}
        accent="assistant"
        onJump={props.onJumpToAssistant}
      />
    </div>
  );
};

export default RecordedEssentials;
