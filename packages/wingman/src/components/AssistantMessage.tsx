import { createSignal, For, Show, type Component } from 'solid-js';
import type { SendResult } from '../send';
import CodeView from './CodeView.jsx';

interface Props {
  result: SendResult | null;
  loading: boolean;
}

type Tab = 'output' | 'response-body' | 'response-headers' | 'request-body' | 'request-headers';

const TABS: ReadonlyArray<{ id: Tab; label: string }> = [
  { id: 'output', label: 'Output' },
  { id: 'response-body', label: 'Response body' },
  { id: 'response-headers', label: 'Response headers' },
  { id: 'request-body', label: 'Request body' },
  { id: 'request-headers', label: 'Request headers' },
];

function formatHeaders(headers: Record<string, string>): string {
  const entries = Object.entries(headers);
  if (entries.length === 0) return '(none)';
  return entries.map(([k, v]) => `${k}: ${v}`).join('\n');
}

function prettyBody(body: string, json: unknown | null): string {
  if (json !== null) return JSON.stringify(json, null, 2);
  return body || '(empty body)';
}

function extractAssistantText(json: unknown): string | null {
  if (!json || typeof json !== 'object') return null;
  const root = json as Record<string, unknown>;
  const choices = root.choices;
  if (Array.isArray(choices) && choices.length > 0) {
    const first = choices[0] as { message?: { content?: unknown }; text?: unknown } | undefined;
    if (first?.message && typeof first.message.content === 'string') return first.message.content;
    if (typeof first?.text === 'string') return first.text;
  }
  return null;
}

function extractUsage(json: unknown): { in?: number; out?: number; total?: number } | null {
  if (!json || typeof json !== 'object') return null;
  const usage = (json as Record<string, unknown>).usage;
  if (!usage || typeof usage !== 'object') return null;
  const u = usage as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === 'number' ? v : undefined);
  return {
    in: num(u.prompt_tokens) ?? num(u.input_tokens),
    out: num(u.completion_tokens) ?? num(u.output_tokens),
    total: num(u.total_tokens),
  };
}

function extractModel(json: unknown): string | null {
  if (!json || typeof json !== 'object') return null;
  const m = (json as Record<string, unknown>).model;
  return typeof m === 'string' ? m : null;
}

const StatusPill: Component<{ status: number; ok: boolean; statusText: string }> = (props) => {
  const tone = () => {
    if (props.status === 0) return 'error';
    if (props.ok) return 'ok';
    if (props.status >= 500) return 'error';
    return 'warn';
  };
  const label = () => {
    if (props.status === 0) return 'Network error';
    return `${props.status} ${props.statusText}`.trim();
  };
  return (
    <span class="status-pill" classList={{ [`status-pill--${tone()}`]: true }}>
      <span class="status-pill__dot" />
      {label()}
    </span>
  );
};

const AssistantMessage: Component<Props> = (props) => {
  const [tab, setTab] = createSignal<Tab>('output');

  const assistantText = () => {
    if (!props.result) return null;
    return props.result.responseJson ? extractAssistantText(props.result.responseJson) : null;
  };
  const usage = () => (props.result?.responseJson ? extractUsage(props.result.responseJson) : null);
  const model = () => (props.result?.responseJson ? extractModel(props.result.responseJson) : null);

  return (
    <div class="assistant-msg">
      <Show when={props.loading}>
        <div class="assistant-msg__loading">
          <span class="spinner" />
          <span>Thinking…</span>
        </div>
      </Show>

      <Show when={!props.loading && props.result}>
        {(_) => {
          const r = props.result!;
          return (
            <>
              <div class="assistant-msg__head">
                <StatusPill status={r.status} ok={r.ok} statusText={r.statusText} />
                <span class="metric-chip" title="Round-trip latency">
                  <svg
                    width="11"
                    height="11"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  {r.durationMs.toFixed(0)} ms
                </span>
                <Show when={usage()?.total}>
                  {(total) => (
                    <span class="metric-chip" title="Total tokens">
                      <svg
                        width="11"
                        height="11"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        aria-hidden="true"
                      >
                        <rect x="3" y="11" width="18" height="11" rx="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                      {total()} tok
                      <Show when={usage()?.in !== undefined && usage()?.out !== undefined}>
                        <span class="metric-chip__aside">
                          ({usage()!.in} in / {usage()!.out} out)
                        </span>
                      </Show>
                    </span>
                  )}
                </Show>
                <Show when={model()}>
                  {(m) => (
                    <span class="model-chip" title="Model returned">
                      {m()}
                    </span>
                  )}
                </Show>
              </div>

              <Show when={r.error}>
                <div class="assistant-msg__error">{r.error}</div>
              </Show>

              <div class="tab-strip" role="tablist" aria-label="Response panes">
                <For each={TABS}>
                  {(t) => (
                    <button
                      type="button"
                      class="tab-strip__btn"
                      classList={{ 'tab-strip__btn--active': tab() === t.id }}
                      onClick={() => setTab(t.id)}
                      role="tab"
                      aria-selected={tab() === t.id}
                    >
                      {t.label}
                    </button>
                  )}
                </For>
              </div>

              <div class="assistant-msg__pane" role="tabpanel">
                <Show when={tab() === 'output'}>
                  <Show
                    when={assistantText()}
                    fallback={
                      <div class="assistant-msg__placeholder">
                        No assistant message in this response. Check the response body tab for the
                        raw payload.
                      </div>
                    }
                  >
                    {(text) => <div class="assistant-msg__text">{text()}</div>}
                  </Show>
                </Show>
                <Show when={tab() === 'response-body'}>
                  <CodeView code={prettyBody(r.responseBody, r.responseJson)} language="json" />
                </Show>
                <Show when={tab() === 'response-headers'}>
                  <CodeView code={formatHeaders(r.responseHeaders)} language="http" />
                </Show>
                <Show when={tab() === 'request-body'}>
                  <CodeView code={r.requestBody} language="json" />
                </Show>
                <Show when={tab() === 'request-headers'}>
                  <CodeView code={formatHeaders(r.requestHeaders)} language="http" />
                </Show>
              </div>
            </>
          );
        }}
      </Show>
    </div>
  );
};

export default AssistantMessage;
