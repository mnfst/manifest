import { createResource, createSignal, For, Show, type Component, type JSX } from 'solid-js';
import { Portal } from 'solid-js/web';
import CodeBlock from './CodeBlock.jsx';
import {
  deleteMessageRecording,
  getMessageDetails,
  type MessageDetailResponse,
  type MessageRecording,
} from '../services/api.js';
import { formatTime, formatNumber, sortedHeaderEntries } from '../services/formatters.js';
import { toast } from '../services/toast-store.js';

type ResponseBody = MessageRecording['response_body'];

interface Props {
  open: boolean;
  messageId: string | null;
  onClose: () => void;
  onDeleted?: (id: string) => void;
}

function CloseIcon(): JSX.Element {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function prettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function formatArgs(args: unknown): string {
  if (args == null) return '';
  if (typeof args === 'string') {
    try {
      return JSON.stringify(JSON.parse(args), null, 2);
    } catch {
      return args;
    }
  }
  return prettyJson(args);
}

function Field(props: { label: string; value: unknown; mono?: boolean }): JSX.Element {
  return (
    <Show when={props.value !== undefined && props.value !== null && props.value !== ''}>
      <div class="recorded-modal__kv-row">
        <span class="recorded-modal__kv-label">{props.label}</span>
        <span class="recorded-modal__kv-value" classList={{ 'recorded-modal__mono': !!props.mono }}>
          {String(props.value)}
        </span>
      </div>
    </Show>
  );
}

function HeadersTable(props: { headers: Record<string, string> | null | undefined }): JSX.Element {
  const entries = () => sortedHeaderEntries(props.headers);
  return (
    <Show
      when={entries().length > 0}
      fallback={<div class="recorded-modal__empty">No headers captured.</div>}
    >
      <div class="recorded-modal__headers">
        <For each={entries()}>
          {([k, v]) => (
            <div class="recorded-modal__header-row">
              <span class="recorded-modal__header-key">{k}</span>
              <span class="recorded-modal__header-val">{v}</span>
            </div>
          )}
        </For>
      </div>
    </Show>
  );
}

interface MessagePart {
  type?: string;
  text?: string;
  image_url?: { url?: string } | string;
}

function MessageContent(props: { content: unknown }): JSX.Element {
  const content = props.content;
  if (typeof content === 'string') {
    return <div class="recorded-modal__turn-text">{content}</div>;
  }
  if (Array.isArray(content)) {
    return (
      <For each={content as MessagePart[]}>
        {(part) => {
          if (part.type === 'text' && typeof part.text === 'string') {
            return <div class="recorded-modal__turn-text">{part.text}</div>;
          }
          if (part.type === 'image_url') {
            const url = typeof part.image_url === 'string' ? part.image_url : part.image_url?.url;
            return (
              <div class="recorded-modal__turn-part">
                <span class="recorded-modal__pill">image</span>
                <span class="recorded-modal__turn-inline">{url ?? '—'}</span>
              </div>
            );
          }
          if (typeof part.text === 'string') {
            return <div class="recorded-modal__turn-text">{part.text}</div>;
          }
          return <CodeBlock code={prettyJson(part)} language="json" />;
        }}
      </For>
    );
  }
  if (content == null || content === '') {
    return <div class="recorded-modal__muted">(empty)</div>;
  }
  return <CodeBlock code={prettyJson(content)} language="json" />;
}

interface ToolCall {
  id?: string;
  type?: string;
  function?: { name?: string; arguments?: unknown };
}

function ToolCallsBlock(props: { calls: ToolCall[] }): JSX.Element {
  return (
    <div class="recorded-modal__tool-calls">
      <For each={props.calls}>
        {(call) => (
          <div class="recorded-modal__tool-call">
            <div class="recorded-modal__tool-head">
              <span class="recorded-modal__pill recorded-modal__pill--tool">tool call</span>
              <span class="recorded-modal__mono">{call.function?.name ?? 'unknown'}</span>
              <Show when={call.id}>
                <span class="recorded-modal__muted recorded-modal__mono">({call.id})</span>
              </Show>
            </div>
            <Show when={call.function?.arguments !== undefined && call.function?.arguments !== ''}>
              <pre class="recorded-modal__pre recorded-modal__pre--tight">
                {formatArgs(call.function?.arguments)}
              </pre>
            </Show>
          </div>
        )}
      </For>
    </div>
  );
}

interface ChatMessage {
  role?: string;
  content?: unknown;
  name?: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

function ChatTurns(props: { messages: ChatMessage[] }): JSX.Element {
  return (
    <div class="recorded-modal__turns">
      <For each={props.messages}>
        {(msg) => {
          const role = msg.role ?? 'unknown';
          return (
            <div class="recorded-modal__turn" data-role={role}>
              <div class="recorded-modal__turn-header">
                <span class={`recorded-modal__role recorded-modal__role--${role}`}>{role}</span>
                <Show when={msg.name}>
                  <span class="recorded-modal__muted recorded-modal__mono">{msg.name}</span>
                </Show>
                <Show when={msg.tool_call_id}>
                  <span class="recorded-modal__muted recorded-modal__mono">
                    tool_call_id: {msg.tool_call_id}
                  </span>
                </Show>
              </div>
              <div class="recorded-modal__turn-body">
                <MessageContent content={msg.content} />
                <Show when={msg.tool_calls && msg.tool_calls.length > 0}>
                  <ToolCallsBlock calls={msg.tool_calls!} />
                </Show>
              </div>
            </div>
          );
        }}
      </For>
    </div>
  );
}

interface ToolDef {
  type?: string;
  function?: { name?: string; description?: string };
}

function ToolsList(props: { tools: ToolDef[] }): JSX.Element {
  return (
    <div class="recorded-modal__tools">
      <For each={props.tools}>
        {(tool) => (
          <div class="recorded-modal__tool-def">
            <span class="recorded-modal__mono">{tool.function?.name ?? 'unknown'}</span>
            <Show when={tool.function?.description}>
              <span class="recorded-modal__muted">{tool.function?.description}</span>
            </Show>
          </div>
        )}
      </For>
    </div>
  );
}

interface ChatCompletionRequest {
  model?: string;
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  messages?: ChatMessage[];
  tools?: ToolDef[];
}

function isChatCompletionRequest(body: unknown): body is ChatCompletionRequest {
  return (
    !!body &&
    typeof body === 'object' &&
    !Array.isArray(body) &&
    Array.isArray((body as ChatCompletionRequest).messages)
  );
}

interface ChatChoice {
  index?: number;
  message?: ChatMessage;
  finish_reason?: string;
}

interface ChatUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  cache_read_tokens?: number;
  cache_creation_tokens?: number;
}

interface ChatCompletionResponse {
  id?: string;
  model?: string;
  created?: number;
  choices?: ChatChoice[];
  usage?: ChatUsage;
}

function isChatCompletionResponse(body: unknown): body is ChatCompletionResponse {
  return (
    !!body &&
    typeof body === 'object' &&
    !Array.isArray(body) &&
    Array.isArray((body as ChatCompletionResponse).choices)
  );
}

function formatCreatedEpoch(epoch: number | undefined): string | undefined {
  if (!epoch) return undefined;
  return new Date(epoch * 1000).toISOString().replace('T', ' ').replace('Z', ' UTC');
}

function UsagePills(props: { usage: ChatUsage }): JSX.Element {
  const u = props.usage;
  return (
    <div class="recorded-modal__usage">
      <Show when={u.prompt_tokens != null}>
        <span class="recorded-modal__usage-pill">
          <span class="recorded-modal__usage-label">input</span>
          <span class="recorded-modal__usage-value">{formatNumber(u.prompt_tokens!)}</span>
        </span>
      </Show>
      <Show when={u.completion_tokens != null}>
        <span class="recorded-modal__usage-pill">
          <span class="recorded-modal__usage-label">output</span>
          <span class="recorded-modal__usage-value">{formatNumber(u.completion_tokens!)}</span>
        </span>
      </Show>
      <Show when={(u.cache_read_tokens ?? 0) > 0}>
        <span class="recorded-modal__usage-pill">
          <span class="recorded-modal__usage-label">cache read</span>
          <span class="recorded-modal__usage-value">{formatNumber(u.cache_read_tokens!)}</span>
        </span>
      </Show>
      <Show when={(u.cache_creation_tokens ?? 0) > 0}>
        <span class="recorded-modal__usage-pill">
          <span class="recorded-modal__usage-label">cache write</span>
          <span class="recorded-modal__usage-value">{formatNumber(u.cache_creation_tokens!)}</span>
        </span>
      </Show>
      <Show when={u.total_tokens != null}>
        <span class="recorded-modal__usage-pill recorded-modal__usage-pill--total">
          <span class="recorded-modal__usage-label">total</span>
          <span class="recorded-modal__usage-value">{formatNumber(u.total_tokens!)}</span>
        </span>
      </Show>
    </div>
  );
}

function SubSection(props: { title: string; children: JSX.Element }): JSX.Element {
  return (
    <div class="recorded-modal__subsection">
      <div class="recorded-modal__subtitle">{props.title}</div>
      {props.children}
    </div>
  );
}

function ChatRequestBody(props: { body: ChatCompletionRequest }): JSX.Element {
  return (
    <>
      <SubSection title="Parameters">
        <div class="recorded-modal__kv">
          <Field label="Model" value={props.body.model} mono />
          <Field
            label="Streaming"
            value={props.body.stream !== undefined ? (props.body.stream ? 'yes' : 'no') : undefined}
          />
          <Field label="Temperature" value={props.body.temperature} />
          <Field label="Top P" value={props.body.top_p} />
          <Field label="Max tokens" value={props.body.max_tokens} />
        </div>
      </SubSection>
      <Show when={props.body.messages && props.body.messages.length > 0}>
        <SubSection title={`Conversation (${props.body.messages!.length})`}>
          <ChatTurns messages={props.body.messages!} />
        </SubSection>
      </Show>
      <Show when={props.body.tools && props.body.tools.length > 0}>
        <SubSection title={`Tools available (${props.body.tools!.length})`}>
          <ToolsList tools={props.body.tools!} />
        </SubSection>
      </Show>
    </>
  );
}

function RequestView(props: {
  body: Record<string, unknown> | null;
  headers: Record<string, string> | null | undefined;
}): JSX.Element {
  return (
    <div class="recorded-modal__section">
      <div class="recorded-modal__section-title">Request</div>
      <Show
        when={props.body}
        fallback={<div class="recorded-modal__empty">No request body captured.</div>}
      >
        <Show
          when={isChatCompletionRequest(props.body)}
          fallback={
            <SubSection title="Body">
              <CodeBlock code={prettyJson(props.body)} language="json" />
            </SubSection>
          }
        >
          <ChatRequestBody body={props.body as ChatCompletionRequest} />
        </Show>
      </Show>
      <SubSection title="Headers">
        <HeadersTable headers={props.headers} />
      </SubSection>
    </div>
  );
}

function ChatResponseBody(props: { body: ChatCompletionResponse }): JSX.Element {
  const firstChoice = () => props.body.choices?.[0];
  const assistant = () => firstChoice()?.message;
  return (
    <>
      <SubSection title="Summary">
        <div class="recorded-modal__kv">
          <Field label="Model" value={props.body.model} mono />
          <Field label="ID" value={props.body.id} mono />
          <Field label="Created" value={formatCreatedEpoch(props.body.created)} />
          <Field label="Finish reason" value={firstChoice()?.finish_reason} />
          <Field label="Choices" value={props.body.choices?.length} />
        </div>
      </SubSection>
      <Show when={assistant()}>
        <SubSection title="Reply">
          <div class="recorded-modal__reply">
            <MessageContent content={assistant()!.content} />
            <Show when={assistant()!.tool_calls && assistant()!.tool_calls!.length > 0}>
              <ToolCallsBlock calls={assistant()!.tool_calls!} />
            </Show>
          </div>
        </SubSection>
      </Show>
      <Show when={props.body.choices && props.body.choices.length > 1}>
        <SubSection title="Other choices">
          <For each={props.body.choices!.slice(1)}>
            {(c) => (
              <div class="recorded-modal__turn">
                <div class="recorded-modal__turn-header">
                  <span class="recorded-modal__muted">
                    #{c.index ?? '?'} &middot; {c.finish_reason ?? ''}
                  </span>
                </div>
                <div class="recorded-modal__turn-body">
                  <MessageContent content={c.message?.content} />
                </div>
              </div>
            )}
          </For>
        </SubSection>
      </Show>
      <Show when={props.body.usage}>
        <SubSection title="Usage">
          <UsagePills usage={props.body.usage!} />
        </SubSection>
      </Show>
    </>
  );
}

function ResponseView(props: {
  responseBody: ResponseBody;
  headers: Record<string, string> | null | undefined;
}): JSX.Element {
  return (
    <div class="recorded-modal__section">
      <div class="recorded-modal__section-title">Response</div>
      <Show
        when={props.responseBody}
        fallback={
          <>
            <div class="recorded-modal__empty">
              Body not captured &mdash; the upstream call may have failed before completion.
            </div>
            <SubSection title="Headers">
              <HeadersTable headers={props.headers} />
            </SubSection>
          </>
        }
      >
        {(() => {
          const rb = props.responseBody!;
          if (rb.type === 'stream') {
            return (
              <>
                <div class="recorded-modal__muted">
                  Streaming response &mdash; raw Server-Sent Events below.
                </div>
                <pre class="recorded-modal__pre">{rb.raw_sse ?? ''}</pre>
              </>
            );
          }
          if (!isChatCompletionResponse(rb.body)) {
            return (
              <SubSection title="Body">
                <CodeBlock code={prettyJson(rb.body)} language="json" />
              </SubSection>
            );
          }
          return <ChatResponseBody body={rb.body} />;
        })()}
      </Show>
      <SubSection title="Headers">
        <HeadersTable headers={props.headers} />
      </SubSection>
    </div>
  );
}

function BodyPanel(props: { data: MessageDetailResponse }): JSX.Element {
  const rec = () => props.data.recording;
  return (
    <>
      <RequestView
        body={rec()?.request_body ?? null}
        headers={props.data.message.request_headers}
      />
      <ResponseView responseBody={rec()?.response_body ?? null} headers={rec()?.response_headers} />
    </>
  );
}

const RecordedMessageModal: Component<Props> = (props) => {
  const [confirmingDelete, setConfirmingDelete] = createSignal(false);
  const [deleting, setDeleting] = createSignal(false);

  const [data, { refetch }] = createResource(
    () => (props.open && props.messageId ? props.messageId : null),
    (id) => (id ? getMessageDetails(id) : Promise.resolve(null)),
  );

  const handleDelete = async () => {
    const id = props.messageId;
    if (!id || deleting()) return;
    setDeleting(true);
    try {
      await deleteMessageRecording(id);
      toast.success('Recording deleted.');
      props.onDeleted?.(id);
      setConfirmingDelete(false);
      props.onClose();
    } catch {
      // fetchMutate already surfaces an error toast before rethrowing
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Portal>
      <Show when={props.open}>
        <div
          class="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) props.onClose();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') props.onClose();
          }}
        >
          <div
            class="modal-card recorded-modal__card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="recorded-modal-title"
          >
            <div class="recorded-modal__header">
              <div>
                <h3 id="recorded-modal-title" class="recorded-modal__title">
                  Recorded message
                </h3>
                <Show when={data()}>
                  <div class="recorded-modal__subheader">
                    <span>{formatTime(data()!.message.timestamp)}</span>
                    <Show when={data()!.message.model}>
                      <span class="recorded-modal__sep" aria-hidden="true">
                        &middot;
                      </span>
                      <span>{data()!.message.model}</span>
                    </Show>
                  </div>
                </Show>
              </div>
              <button
                type="button"
                class="recorded-modal__close"
                onClick={props.onClose}
                aria-label="Close"
              >
                <CloseIcon />
              </button>
            </div>

            <div class="recorded-modal__body">
              <Show when={data.loading}>
                <div class="recorded-modal__loader">Loading recording&hellip;</div>
              </Show>
              <Show when={data.error}>
                <div class="recorded-modal__error">
                  Failed to load recording.{' '}
                  <button
                    type="button"
                    class="recorded-modal__retry"
                    /* v8 ignore next */
                    onClick={() => refetch()}
                  >
                    Retry
                  </button>
                </div>
              </Show>
              <Show when={data() && !data.loading && !data.error}>
                <BodyPanel data={data()!} />
              </Show>
            </div>

            <div class="recorded-modal__footer">
              <Show
                when={confirmingDelete()}
                fallback={
                  <Show when={data()?.recording}>
                    <button
                      type="button"
                      class="recorded-modal__delete-btn"
                      onClick={() => setConfirmingDelete(true)}
                    >
                      Delete recording
                    </button>
                  </Show>
                }
              >
                <span class="recorded-modal__confirm-text">
                  Delete? The message stays in your log.
                </span>
                <button
                  type="button"
                  class="btn btn--ghost btn--sm"
                  onClick={() => setConfirmingDelete(false)}
                  disabled={deleting()}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  class="btn btn--danger btn--sm"
                  onClick={handleDelete}
                  disabled={deleting()}
                >
                  {deleting() ? <span class="spinner" /> : 'Confirm delete'}
                </button>
              </Show>
              <button type="button" class="btn btn--outline btn--sm" onClick={props.onClose}>
                Close
              </button>
            </div>
          </div>
        </div>
      </Show>
    </Portal>
  );
};

export default RecordedMessageModal;
