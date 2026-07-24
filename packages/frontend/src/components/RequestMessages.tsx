import { For, Show, createMemo, createSignal, type Component } from 'solid-js';
import {
  coerceContentToText,
  extractRecordedConversationMessages,
  extractRequestTools,
  normalizeRole,
  type ChatMessage,
  type ToolCall,
} from 'manifest-shared';
import type { MessageDetailResponse } from '../services/api/messages.js';

type Recording = NonNullable<MessageDetailResponse['recording']>;
type View = 'conversation' | 'tools' | 'raw';

function pretty(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

const ToolCalls: Component<{ calls: ToolCall[] }> = (props) => (
  <div class="request-messages__tool-calls">
    <For each={props.calls}>
      {(call) => (
        <div class="request-messages__tool-call">
          <div class="request-messages__tool-call-head">
            <span class="request-messages__tool-icon" aria-hidden="true">
              ↳
            </span>
            <strong>{call.function?.name ?? 'Unknown tool'}</strong>
            <Show when={call.id}>
              <code>{call.id}</code>
            </Show>
          </div>
          <Show when={call.function?.arguments != null}>
            <pre>{pretty(call.function?.arguments)}</pre>
          </Show>
        </div>
      )}
    </For>
  </div>
);

const MessageTurn: Component<{ message: ChatMessage; index: number }> = (props) => {
  const role = () => normalizeRole(props.message.role);
  const content = () => coerceContentToText(props.message.content);
  return (
    <article class={`request-message request-message--${role()}`}>
      <header class="request-message__header">
        <span class={`request-message__role request-message__role--${role()}`}>
          {role() === 'unknown' ? (props.message.role ?? 'unknown') : role()}
        </span>
        <span class="request-message__index">#{props.index + 1}</span>
        <Show when={props.message.name}>
          <code>{props.message.name}</code>
        </Show>
        <Show when={props.message.tool_call_id}>
          <code>{props.message.tool_call_id}</code>
        </Show>
      </header>
      <Show when={content()}>
        <div class="request-message__content">{content()}</div>
      </Show>
      <Show when={(props.message.tool_calls?.length ?? 0) > 0}>
        <ToolCalls calls={props.message.tool_calls ?? []} />
      </Show>
    </article>
  );
};

const RequestMessages: Component<{ recording: Recording | null }> = (props) => {
  const [view, setView] = createSignal<View>('conversation');
  const messages = createMemo(() =>
    props.recording
      ? extractRecordedConversationMessages(
          props.recording.request_body,
          props.recording.response_body,
        )
      : [],
  );
  const tools = createMemo(() => extractRequestTools(props.recording?.request_body));

  return (
    <Show
      when={props.recording}
      fallback={
        <div class="request-messages__empty">
          <div class="request-messages__empty-icon" aria-hidden="true">
            ◌
          </div>
          <strong>No messages recorded</strong>
          <span>Message recording was not enabled when this request ran.</span>
        </div>
      }
    >
      {(recording) => (
        <div class="request-messages">
          <div class="request-messages__toolbar">
            <div class="request-messages__views" role="tablist" aria-label="Recorded payload">
              <button
                classList={{ 'request-messages__view--active': view() === 'conversation' }}
                onClick={() => setView('conversation')}
                role="tab"
                type="button"
                aria-selected={view() === 'conversation'}
              >
                Conversation
                <span>{messages().length}</span>
              </button>
              <button
                classList={{ 'request-messages__view--active': view() === 'tools' }}
                onClick={() => setView('tools')}
                role="tab"
                type="button"
                aria-selected={view() === 'tools'}
              >
                Tools
                <span>{tools().length}</span>
              </button>
              <button
                classList={{ 'request-messages__view--active': view() === 'raw' }}
                onClick={() => setView('raw')}
                role="tab"
                type="button"
                aria-selected={view() === 'raw'}
              >
                Raw
              </button>
            </div>
            <span class="request-messages__format">
              {recording().api_format.replaceAll('_', ' ')}
            </span>
          </div>

          <Show when={view() === 'conversation'}>
            <Show
              when={messages().length > 0}
              fallback={<div class="request-messages__empty">No conversation turns found.</div>}
            >
              <div class="request-messages__conversation">
                <For each={messages()}>
                  {(message, index) => <MessageTurn message={message} index={index()} />}
                </For>
              </div>
            </Show>
          </Show>

          <Show when={view() === 'tools'}>
            <Show
              when={tools().length > 0}
              fallback={<div class="request-messages__empty">No tools were defined.</div>}
            >
              <div class="request-messages__tools">
                <For each={tools()}>
                  {(tool) => (
                    <article class="request-tool">
                      <div class="request-tool__head">
                        <span class="request-messages__tool-icon" aria-hidden="true">
                          ↳
                        </span>
                        <strong>{tool.function?.name ?? tool.type ?? 'Unknown tool'}</strong>
                        <span>{tool.type ?? 'function'}</span>
                      </div>
                      <Show when={tool.function?.description}>
                        <p>{tool.function?.description}</p>
                      </Show>
                      <Show when={tool.function?.parameters != null}>
                        <pre>{pretty(tool.function?.parameters)}</pre>
                      </Show>
                    </article>
                  )}
                </For>
              </div>
            </Show>
          </Show>

          <Show when={view() === 'raw'}>
            <div class="request-messages__raw">
              <section>
                <h4>Request</h4>
                <pre>{pretty(recording().request_body)}</pre>
              </section>
              <section>
                <h4>Response</h4>
                <pre>{pretty(recording().response_body)}</pre>
              </section>
            </div>
          </Show>
        </div>
      )}
    </Show>
  );
};

export default RequestMessages;
