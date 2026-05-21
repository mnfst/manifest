import { For, Show, type JSX } from 'solid-js';
import CodeBlock from './CodeBlock.jsx';
import { coerceContentToText, type ChatMessage } from './recorded-message-helpers.js';
import { formatNumber } from '../services/formatters.js';
import type { MessageRecording } from '../services/api.js';

export type ResponseBody = MessageRecording['response_body'];

export function prettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function HeadersTable(props: {
  headers: Record<string, string> | null | undefined;
  emptyCopy: string;
}): JSX.Element {
  const entries = () => Object.entries(props.headers ?? {}).sort(([a], [b]) => a.localeCompare(b));
  return (
    <Show
      when={entries().length > 0}
      fallback={<div class="recorded-modal__empty">{props.emptyCopy}</div>}
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

/**
 * Single-block assistant reply rendering — used for both the primary Reply
 * and each "Other choices" entry so the markup lives in one place.
 */
function ChoiceReply(props: { content: unknown }): JSX.Element {
  return (
    <div class="recorded-modal__reply">
      <div class="recorded-modal__turn-text">{coerceContentToText(props.content)}</div>
    </div>
  );
}

export function ToolsList(props: {
  tools: Array<{ type?: string; function?: { name?: string; description?: string } }>;
}): JSX.Element {
  return (
    <div class="recorded-modal__tools">
      <For each={props.tools}>
        {(tool) => (
          <div class="recorded-modal__tool-def">
            <div class="recorded-modal__tool-def-name">{tool.function?.name ?? 'unknown'}</div>
            <Show when={tool.function?.description}>
              <div class="recorded-modal__tool-def-desc">{tool.function?.description}</div>
            </Show>
          </div>
        )}
      </For>
    </div>
  );
}

export function ResponseTab(props: { responseBody: ResponseBody }): JSX.Element {
  return (
    <Show
      when={props.responseBody}
      fallback={
        <div class="recorded-modal__empty">
          Response body not captured &mdash; the upstream call may have failed.
        </div>
      }
    >
      {(() => {
        const rb = props.responseBody!;
        if (rb.type === 'stream') {
          return (
            <div>
              <p style="margin: 0 0 var(--gap-sm); font-size: var(--font-size-sm); font-family: var(--font-family); color: hsl(var(--muted-foreground));">
                This response was streamed. Raw Server-Sent Events are shown below.
              </p>
              <CodeBlock code={rb.raw_sse ?? ''} language="plaintext" />
            </div>
          );
        }
        const body = (rb as { body?: unknown }).body;
        const asChat = body as
          | {
              id?: string;
              model?: string;
              choices?: Array<{ message?: ChatMessage; finish_reason?: string; index?: number }>;
              usage?: Record<string, number>;
            }
          | undefined;
        if (!asChat?.choices) {
          return <CodeBlock code={prettyJson(body)} language="json" />;
        }
        const first = asChat.choices[0];
        const others = asChat.choices.slice(1);
        return (
          <>
            <section class="recorded-modal__subsection">
              <h3 class="recorded-modal__subtitle">Summary</h3>
              <div class="recorded-modal__kv">
                <Show when={asChat.model}>
                  <div class="recorded-modal__kv-row">
                    <span class="recorded-modal__kv-label">Model</span>
                    <span class="recorded-modal__kv-value recorded-modal__mono">
                      {asChat.model}
                    </span>
                  </div>
                </Show>
                <Show when={asChat.id}>
                  <div class="recorded-modal__kv-row">
                    <span class="recorded-modal__kv-label">ID</span>
                    <span class="recorded-modal__kv-value recorded-modal__mono">{asChat.id}</span>
                  </div>
                </Show>
                <Show when={first?.finish_reason}>
                  <div class="recorded-modal__kv-row">
                    <span class="recorded-modal__kv-label">Finish reason</span>
                    <span class="recorded-modal__kv-value">{first?.finish_reason}</span>
                  </div>
                </Show>
              </div>
            </section>
            <Show when={first?.message}>
              <section class="recorded-modal__subsection">
                <h3 class="recorded-modal__subtitle">Reply</h3>
                <ChoiceReply content={first!.message!.content} />
              </section>
            </Show>
            <Show when={others.length > 0}>
              <section class="recorded-modal__subsection">
                <h3 class="recorded-modal__subtitle">Other choices</h3>
                <For each={others}>
                  {(c) => (
                    <>
                      <div class="recorded-modal__muted">
                        #{c.index ?? '?'} · {c.finish_reason ?? ''}
                      </div>
                      <ChoiceReply content={c.message?.content} />
                    </>
                  )}
                </For>
              </section>
            </Show>
            <Show when={asChat.usage}>
              <section class="recorded-modal__subsection">
                <h3 class="recorded-modal__subtitle">Usage</h3>
                <div class="recorded-modal__kv">
                  <For each={Object.entries(asChat.usage!)}>
                    {([k, v]) => (
                      <div class="recorded-modal__kv-row">
                        <span class="recorded-modal__kv-label">{k}</span>
                        <span class="recorded-modal__kv-value recorded-modal__mono">
                          {formatNumber(Number(v))}
                        </span>
                      </div>
                    )}
                  </For>
                </div>
              </section>
            </Show>
          </>
        );
      })()}
    </Show>
  );
}
