import { For, Show, createMemo, createSignal, type Component, type JSX } from 'solid-js';
import CodeBlock from './CodeBlock.jsx';
import {
  coerceContentToText,
  detectContentKind,
  extractAllXmlTagNames,
  MAX_COUNTED_MATCHES,
  normalizeRole,
  type ChatMessage,
  type Role,
  type ToolCall,
} from './recorded-message-helpers.js';

interface ToolCallsProps {
  calls: ToolCall[];
}

function ToolCallsBlock(props: ToolCallsProps): JSX.Element {
  return (
    <div class="recorded-modal__tool-calls">
      <For each={props.calls}>
        {(call) => {
          const argText = () => {
            const a = call.function?.arguments;
            if (a == null) return '';
            if (typeof a === 'string') {
              try {
                return JSON.stringify(JSON.parse(a), null, 2);
              } catch {
                return a;
              }
            }
            try {
              return JSON.stringify(a, null, 2);
            } catch {
              return String(a);
            }
          };
          return (
            <div class="recorded-modal__tool-call">
              <div class="recorded-modal__tool-head">
                <span class="recorded-modal__pill recorded-modal__pill--tool">tool call</span>
                <span class="recorded-modal__mono">{call.function?.name ?? 'unknown'}</span>
                <Show when={call.id}>
                  <span class="recorded-modal__muted recorded-modal__mono">({call.id})</span>
                </Show>
              </div>
              <Show when={argText()}>
                <pre class="recorded-modal__pre recorded-modal__pre--tight">{argText()}</pre>
              </Show>
            </div>
          );
        }}
      </For>
    </div>
  );
}

interface DetectContentProps {
  raw: string;
  renderMode: 'rendered' | 'raw';
  searchQuery?: string;
}

/** Highlight all occurrences of `needle` in a string as <mark> elements. */
function highlightMatches(haystack: string, needle: string): JSX.Element {
  if (!needle) return <>{haystack}</>;
  const parts: JSX.Element[] = [];
  const lcHay = haystack.toLowerCase();
  const lcNeed = needle.toLowerCase();
  let i = 0;
  let n = 0;
  while (n < MAX_COUNTED_MATCHES) {
    const hit = lcHay.indexOf(lcNeed, i);
    if (hit === -1) {
      parts.push(<>{haystack.slice(i)}</>);
      break;
    }
    parts.push(<>{haystack.slice(i, hit)}</>);
    parts.push(
      <mark class="recorded-modal__mark">{haystack.slice(hit, hit + needle.length)}</mark>,
    );
    i = hit + needle.length;
    n++;
  }
  if (n >= MAX_COUNTED_MATCHES) parts.push(<>{haystack.slice(i)}</>);
  return <>{parts}</>;
}

const DetectContent: Component<DetectContentProps> = (props) => {
  const kind = createMemo(() => detectContentKind(props.raw));

  return (
    <Show
      when={props.renderMode === 'rendered'}
      fallback={<CodeBlock code={props.raw} language="plaintext" />}
    >
      <Show when={kind() === 'json'}>
        <CodeBlock code={props.raw} language="json" />
      </Show>
      <Show when={kind() === 'xml'}>
        <CodeBlock code={props.raw} language="xml" />
      </Show>
      <Show when={kind() === 'markdown' || kind() === 'text'}>
        <div class="recorded-modal__turn-text">
          {highlightMatches(props.raw, props.searchQuery ?? '')}
        </div>
      </Show>
    </Show>
  );
};

interface Props {
  index: number;
  message: ChatMessage;
  role: Role;
  tokens: number;
  preview: string;
  expanded: boolean;
  onToggle: () => void;
  renderMode: 'rendered' | 'raw';
  searchQuery: string;
  isActive?: boolean;
  innerRef?: (el: HTMLElement) => void;
}

const RecordedTurn: Component<Props> = (props) => {
  const [bodyCapped, setBodyCapped] = createSignal(true);

  const roleLabel = () => {
    const r = normalizeRole(props.role);
    return r === 'unknown' ? (props.message.role ?? 'unknown') : r;
  };

  const contentText = createMemo(() => coerceContentToText(props.message.content));
  const toolCalls = () => props.message.tool_calls ?? [];
  // Lift XML chip extraction to the turn level so the chip row can sit
  // above the capped scroll container (`.recorded-modal__turn-body--capped`)
  // and stay visible while the user scrolls inside a 12k-token XML body.
  const contentKind = createMemo(() => detectContentKind(contentText()));
  const xmlTags = createMemo(() =>
    contentKind() === 'xml' ? extractAllXmlTagNames(contentText()) : [],
  );

  return (
    <section
      class="recorded-modal__turn"
      classList={{
        'recorded-modal__turn--compact': !props.expanded,
        'recorded-modal__turn--active': !!props.isActive,
      }}
      data-role={roleLabel()}
      ref={(el) => props.innerRef?.(el)}
      id={`recorded-turn-${props.index}`}
    >
      <button
        type="button"
        class="recorded-modal__turn-header"
        onClick={() => props.onToggle()}
        aria-expanded={props.expanded}
      >
        <span class="recorded-modal__turn-index" aria-hidden="true">
          #{props.index + 1}
        </span>
        <span class={`recorded-modal__role recorded-modal__role--${roleLabel()}`}>
          {roleLabel()}
        </span>
        <Show when={props.message.name}>
          <span class="recorded-modal__muted recorded-modal__mono">{props.message.name}</span>
        </Show>
        <Show when={props.message.tool_call_id}>
          <span class="recorded-modal__muted recorded-modal__mono">
            tool_call_id: {props.message.tool_call_id}
          </span>
        </Show>
        <Show when={!props.expanded}>
          <span class="recorded-modal__turn-preview">{props.preview}</span>
        </Show>
        <span class="recorded-modal__turn-toknum" aria-label={`${props.tokens} tokens`}>
          {props.tokens >= 1000 ? `${(props.tokens / 1000).toFixed(1)}k` : props.tokens} tokens
        </span>
        <span class="recorded-modal__turn-chevron" aria-hidden="true">
          {props.expanded ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="m7.71 15.71 4.29-4.3 4.29 4.3 1.42-1.42L12 8.59l-5.71 5.7z" />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="m12 15.41 5.71-5.7-1.42-1.42-4.29 4.3-4.29-4.3-1.42 1.42z" />
            </svg>
          )}
        </span>
      </button>
      <Show when={props.expanded}>
        <Show when={xmlTags().length > 0}>
          <div class="recorded-modal__xml-chip-row" role="list" aria-label="XML tags">
            <For each={xmlTags()}>
              {(tag) => (
                <span class="recorded-modal__xml-chip" role="listitem">
                  &lt;{tag}&gt;
                </span>
              )}
            </For>
          </div>
        </Show>
        <div
          class="recorded-modal__turn-body"
          classList={{ 'recorded-modal__turn-body--capped': bodyCapped() }}
        >
          <Show when={contentText()}>
            <DetectContent
              raw={contentText()}
              renderMode={props.renderMode}
              searchQuery={props.searchQuery}
            />
          </Show>
          <Show when={toolCalls().length > 0}>
            <ToolCallsBlock calls={toolCalls()} />
          </Show>
        </div>
        <Show when={contentText().length > 2000 || toolCalls().length > 3}>
          <div class="recorded-modal__turn-footer">
            <button
              type="button"
              class="recorded-modal__uncap"
              onClick={() => setBodyCapped((v) => !v)}
            >
              {bodyCapped() ? 'Expand to full height' : 'Collapse back'}
            </button>
          </div>
        </Show>
      </Show>
    </section>
  );
};

export default RecordedTurn;
