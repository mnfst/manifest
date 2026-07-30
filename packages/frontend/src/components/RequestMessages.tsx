import { For, Show, createMemo, createSignal, onCleanup, type Component } from 'solid-js';
import {
  coerceContentToText,
  extractRecordedConversationMessages,
  extractResponseToolCalls,
  normalizeRole,
  type ChatMessage,
  type Role,
  type ToolCall,
} from 'manifest-shared';
import type { AttemptRecording } from '../services/api/messages.js';
import MarkdownContent from './playground/MarkdownContent.js';
import JsonBlock from './JsonBlock.js';

type Recording = AttemptRecording;
export type RecordingView = 'messages' | 'tools' | 'raw';

const CAP_CHARS = 2000;
const SIDEBAR_DEFAULT = 220;
const SIDEBAR_MIN = 150;
const SIDEBAR_MAX = 480;
const ALL_ROLES: Role[] = ['system', 'user', 'assistant', 'tool', 'unknown'];

interface OutlineRow {
  index: number;
  role: Role;
  preview: string;
  tokens: number;
}

function pretty(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function toolArguments(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function previewStr(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > 80 ? flat.slice(0, 80) + '…' : flat;
}

function approxTokens(text: string): number {
  return Math.max(1, Math.round(text.length / 4));
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

const MessageTurn: Component<{
  message: ChatMessage;
  index: number;
  active: boolean;
  onRef?: (el: HTMLElement) => void;
}> = (props) => {
  const [expanded, setExpanded] = createSignal(true);
  const [capped, setCapped] = createSignal(true);

  const role = () => normalizeRole(props.message.role);
  const content = () => coerceContentToText(props.message.content);
  const toolCalls = () => props.message.tool_calls ?? [];

  const parsedJson = () => {
    const text = content().trim();
    if (!text.startsWith('{') && !text.startsWith('[')) return null;
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return null;
    }
  };
  const preview = () => previewStr(content());
  const isCappable = () => content().length > CAP_CHARS || toolCalls().length > 3;

  return (
    <article
      ref={(el) => props.onRef?.(el)}
      class="request-message"
      classList={{ 'request-message--active': props.active }}
    >
      <button
        type="button"
        class="request-message__header"
        aria-expanded={expanded()}
        onClick={() => setExpanded((v) => !v)}
      >
        <span class="request-message__index">#{props.index + 1}</span>
        <span class={`request-message__role request-message__role--${role()}`}>
          {role() === 'unknown' ? (props.message.role ?? 'unknown') : role()}
        </span>
        <Show when={props.message.name}>
          <code class="request-message__meta-code">{props.message.name}</code>
        </Show>
        <Show when={props.message.tool_call_id}>
          <code class="request-message__meta-code">{props.message.tool_call_id}</code>
        </Show>
        <Show when={!expanded() && preview()}>
          <span class="request-message__preview">{preview()}</span>
        </Show>
        <span
          class="request-message__chevron"
          classList={{ 'request-message__chevron--open': expanded() }}
          aria-hidden="true"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M17.35 8H6.65c-.64 0-.99.76-.56 1.24l5.35 6.11c.3.34.83.34 1.13 0l5.35-6.11C18.34 8.76 18 8 17.36 8Z" />
          </svg>
        </span>
      </button>

      <Show when={expanded()}>
        <div
          class="request-message__body"
          classList={{ 'request-message__body--capped': isCappable() && capped() }}
        >
          <Show when={content()}>
            {parsedJson() != null ? (
              <JsonBlock class="request-message__content" value={parsedJson()} />
            ) : (
              <MarkdownContent class="request-message__content" text={content()} />
            )}
          </Show>
          <Show when={toolCalls().length > 0}>
            <ToolCalls calls={toolCalls()} />
          </Show>
        </div>
        <Show when={isCappable()}>
          <div class="request-message__footer">
            <button
              type="button"
              class="request-message__uncap"
              onClick={() => setCapped((v) => !v)}
            >
              {capped() ? 'Expand to full height' : 'Collapse back'}
            </button>
          </div>
        </Show>
      </Show>
    </article>
  );
};

const ConversationSplit: Component<{ messages: ChatMessage[] }> = (props) => {
  const [activeTurnIndex, setActiveTurnIndex] = createSignal(-1);
  const [visibleRoles, setVisibleRoles] = createSignal(new Set<Role>(ALL_ROLES));
  const [sidebarWidth, setSidebarWidth] = createSignal(SIDEBAR_DEFAULT);
  const [searchQuery, setSearchQuery] = createSignal('');
  const turnRefs: Record<number, HTMLElement> = {};

  const presentRoles = createMemo(() => {
    const roles = new Set<Role>();
    for (const m of props.messages) roles.add(normalizeRole(m.role));
    return ALL_ROLES.filter((r) => roles.has(r));
  });

  const visibleMessages = createMemo(() =>
    props.messages
      .map((m, i) => ({ message: m, globalIndex: i }))
      .filter(({ message }) => visibleRoles().has(normalizeRole(message.role))),
  );

  const outlineRows = createMemo<OutlineRow[]>(() => {
    const q = searchQuery().toLowerCase().trim();
    return visibleMessages()
      .map(({ message, globalIndex }) => {
        const text = coerceContentToText(message.content);
        const prev = previewStr(text);
        if (q && !prev.toLowerCase().includes(q)) return null;
        return {
          index: globalIndex,
          role: normalizeRole(message.role),
          preview: prev || '—',
          tokens: approxTokens(text),
        };
      })
      .filter((r): r is OutlineRow => r !== null);
  });

  function jumpTo(globalIndex: number) {
    setActiveTurnIndex(globalIndex);
    turnRefs[globalIndex]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  let dragStartX = 0;
  let dragStartWidth = 0;

  function onHandleMouseDown(e: MouseEvent) {
    dragStartX = e.clientX;
    dragStartWidth = sidebarWidth();
    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragUp);
    e.preventDefault();
  }

  function onDragMove(e: MouseEvent) {
    const delta = e.clientX - dragStartX;
    const next = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, dragStartWidth + delta));
    setSidebarWidth(next);
  }

  function onDragUp() {
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragUp);
  }

  onCleanup(() => {
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragUp);
  });

  const toggleRole = (role: Role) => {
    setVisibleRoles((prev) => {
      const next = new Set(prev);
      if (next.has(role) && next.size > 1) {
        next.delete(role);
      } else {
        next.add(role);
      }
      return next;
    });
  };

  return (
    <div class="conv-split">
      {/* Rail */}
      <div class="conv-rail" style={{ width: `${sidebarWidth()}px` }}>
        <div class="conv-rail__search-wrap">
          <input
            class="conv-rail__search"
            type="search"
            placeholder="Filter…"
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
          />
        </div>
        <div class="conv-rail__roles">
          <For each={presentRoles()}>
            {(role) => (
              <button
                type="button"
                class={`conv-rail__role-pill conv-rail__role-pill--${role}`}
                classList={{ 'conv-rail__role-pill--off': !visibleRoles().has(role) }}
                onClick={() => toggleRole(role)}
                title={`Toggle ${role} messages`}
              >
                {role}
              </button>
            )}
          </For>
        </div>
        <div class="conv-rail__list">
          <For each={outlineRows()}>
            {(row) => (
              <button
                type="button"
                class="conv-outline-row"
                classList={{ 'conv-outline-row--active': activeTurnIndex() === row.index }}
                onClick={() => jumpTo(row.index)}
              >
                <span class={`conv-outline-row__badge conv-outline-row__badge--${row.role}`}>
                  {row.role.slice(0, 2).toUpperCase()}
                </span>
                <span class="conv-outline-row__num">#{row.index + 1}</span>
                <span class="conv-outline-row__preview">{row.preview}</span>
                <span class="conv-outline-row__tokens">{row.tokens}t</span>
              </button>
            )}
          </For>
          <Show when={outlineRows().length === 0}>
            <div class="conv-rail__empty">No matches</div>
          </Show>
        </div>
      </div>

      {/* Resize handle */}
      <div class="conv-resize-handle" onMouseDown={onHandleMouseDown} />

      {/* Turn list */}
      <div class="conv-turns">
        <For each={visibleMessages()}>
          {({ message, globalIndex }) => (
            <MessageTurn
              message={message}
              index={globalIndex}
              active={activeTurnIndex() === globalIndex}
              onRef={(el) => {
                turnRefs[globalIndex] = el;
              }}
            />
          )}
        </For>
      </div>
    </div>
  );
};

const RequestMessages: Component<{ recording: Recording | null; view?: RecordingView }> = (
  props,
) => {
  const view = () => props.view ?? 'messages';
  const messages = createMemo(() =>
    props.recording
      ? extractRecordedConversationMessages(
          props.recording.request_body,
          props.recording.response_body,
        )
      : [],
  );
  const toolCalls = createMemo(() => extractResponseToolCalls(props.recording?.response_body));

  return (
    <Show
      when={props.recording}
      fallback={
        <div class="request-messages__empty">
          <div class="request-messages__empty-icon" aria-hidden="true">
            ◌
          </div>
          <strong>No messages recorded</strong>
          <span>Message recording was not enabled when this attempt ran.</span>
        </div>
      }
    >
      {(recording) => (
        <div class="request-messages">
          <Show when={view() === 'messages'}>
            <Show
              when={messages().length > 0}
              fallback={
                <div class="request-messages__scroll-area">
                  <div class="request-messages__empty">No conversation turns found.</div>
                </div>
              }
            >
              <ConversationSplit messages={messages()} />
            </Show>
          </Show>

          <Show when={view() === 'tools'}>
            <div class="request-messages__scroll-area">
              <Show
                when={toolCalls().length > 0}
                fallback={<div class="request-messages__empty">No tools were called.</div>}
              >
                <div class="request-messages__tools">
                  <For each={toolCalls()}>
                    {(call) => (
                      <article class="request-tool">
                        <div class="request-tool__head">
                          <span class="request-messages__tool-icon" aria-hidden="true">
                            ↳
                          </span>
                          <strong>{call.function?.name ?? 'Unknown tool'}</strong>
                          <span class="request-tool__type">{call.type ?? 'function'}</span>
                          <Show when={call.id}>
                            <code>{call.id}</code>
                          </Show>
                        </div>
                        <Show when={call.function?.arguments != null}>
                          <pre>{pretty(toolArguments(call.function?.arguments))}</pre>
                        </Show>
                      </article>
                    )}
                  </For>
                </div>
              </Show>
            </div>
          </Show>

          <Show when={view() === 'raw'}>
            <div class="request-messages__scroll-area">
              <div class="request-messages__raw">
                <section>
                  <h4>Request</h4>
                  <JsonBlock value={recording().request_body} />
                </section>
                <section>
                  <h4>Response</h4>
                  <JsonBlock value={recording().response_body} />
                </section>
              </div>
            </div>
          </Show>
        </div>
      )}
    </Show>
  );
};

export default RequestMessages;
