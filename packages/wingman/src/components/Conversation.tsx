import { Show, type Component } from 'solid-js';
import type { SendResult } from '../send';
import AssistantMessage from './AssistantMessage.jsx';

interface Props {
  userMessage: string;
  result: SendResult | null;
  loading: boolean;
  hasSent: boolean;
}

const PaperPlane: Component = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="M22 2L11 13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const Conversation: Component<Props> = (props) => {
  return (
    <div class="conversation">
      <Show
        when={props.hasSent}
        fallback={
          <div class="conversation__empty">
            <div class="conversation__empty-icon" aria-hidden="true">
              <PaperPlane />
            </div>
            <h2>Send your first request</h2>
            <p>
              Pick a profile in the composer below, type a message, then hit Send. Each request is
              saved in the sidebar so you can compare and replay.
            </p>
          </div>
        }
      >
        <Show when={props.userMessage}>
          <div class="user-msg">
            <div class="user-msg__bubble">{props.userMessage}</div>
          </div>
        </Show>
        <AssistantMessage result={props.result} loading={props.loading} />
      </Show>
    </div>
  );
};

export default Conversation;
