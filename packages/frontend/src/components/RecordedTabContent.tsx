import { For, Show, type JSX } from 'solid-js';
import CodeBlock from './CodeBlock.jsx';
import RecordedTurn from './RecordedTurn.jsx';
import RecordedOutline from './RecordedOutline.jsx';
import { HeadersTable, ResponseTab, ToolsList, prettyJson } from './RecordedResponseTab.jsx';
import {
  detectRequestBodyFormat,
  extractRequestTools,
  type ChatMessage,
  type RequestBodyFormat,
  type Role,
} from './recorded-message-helpers.js';
import type { MessageDetailResponse } from '../services/api.js';
import type { OutlineRow } from './RecordedOutline.jsx';
import type { TabId } from './RecordedDrawerChrome.jsx';

const tools = (d: MessageDetailResponse) => extractRequestTools(d.recording?.request_body);

const FORMAT_HINT: Record<Exclude<RequestBodyFormat, 'openai'>, string> = {
  empty: 'No request body was captured for this message.',
  claude: 'This recording uses the Anthropic native format. Open the Raw tab to inspect it.',
  gemini: 'This recording uses the Google Gemini format. Open the Raw tab to inspect it.',
  unknown: 'Unrecognised request body shape. Open the Raw tab to inspect it.',
};

interface OutlineProps {
  activeIndex: number | null;
  searchQuery: string;
  onSearch: (q: string) => void;
  onJump: (index: number) => void;
  onToggleRole: (role: Role) => void;
  onJumpFirstUser: () => void;
  onJumpLastUser: () => void;
  onJumpLastAssistant: () => void;
}

interface Props {
  tab: TabId;
  data: MessageDetailResponse;
  messages: ChatMessage[];
  rows: OutlineRow[];
  visibleRoles: ReadonlySet<Role>;
  expandedTurns: ReadonlySet<number>;
  activeTurnIndex: number | null;
  renderMode: 'rendered' | 'raw';
  searchQuery: string;
  onSearch: (q: string) => void;
  onToggleTurn: (index: number) => void;
  onConversationScroll?: () => void;
  outlineProps?: OutlineProps;
}

export function RecordedTabContent(props: Props): JSX.Element {
  return (
    <>
      <Show when={props.tab === 'conversation'}>
        {(() => {
          const format = detectRequestBodyFormat(props.data.recording?.request_body);
          if (format !== 'openai') {
            return <div class="recorded-modal__empty">{FORMAT_HINT[format]}</div>;
          }
          return (
            <div class="recorded-drawer__conversation-layout">
              <Show when={props.outlineProps}>
                <RecordedOutline
                  rows={props.rows}
                  activeIndex={props.outlineProps!.activeIndex}
                  visibleRoles={props.visibleRoles}
                  searchQuery={props.outlineProps!.searchQuery}
                  onSearch={props.outlineProps!.onSearch}
                  onJump={props.outlineProps!.onJump}
                  onToggleRole={props.outlineProps!.onToggleRole}
                  onJumpFirstUser={props.outlineProps!.onJumpFirstUser}
                  onJumpLastUser={props.outlineProps!.onJumpLastUser}
                  onJumpLastAssistant={props.outlineProps!.onJumpLastAssistant}
                />
              </Show>
              <div
                class="recorded-drawer__conversation-main"
                ref={(el) =>
                  requestAnimationFrame(() => {
                    el.scrollTop = el.scrollHeight;
                  })
                }
                onScroll={() => props.onConversationScroll?.()}
              >
                <Conversation
                  messages={props.messages}
                  rows={props.rows}
                  visibleRoles={props.visibleRoles}
                  expandedTurns={props.expandedTurns}
                  activeIndex={props.activeTurnIndex}
                  renderMode={props.renderMode}
                  searchQuery={props.searchQuery}
                  onToggle={props.onToggleTurn}
                />
              </div>
            </div>
          );
        })()}
      </Show>
      <Show when={props.tab === 'response'}>
        <ResponseTab responseBody={props.data.recording?.response_body ?? null} />
      </Show>
      <Show when={props.tab === 'tools'}>
        <Show
          when={tools(props.data).length > 0}
          fallback={<div class="recorded-modal__empty">No tools defined on this call.</div>}
        >
          <ToolsList tools={tools(props.data)} />
        </Show>
      </Show>
      <Show when={props.tab === 'headers'}>
        <div class="recorded-drawer__headers-grid">
          <section>
            <h3 class="recorded-modal__subtitle">Request headers</h3>
            <HeadersTable
              headers={props.data.message.request_headers}
              emptyCopy="No request headers captured."
            />
          </section>
          <section>
            <h3 class="recorded-modal__subtitle">Response headers</h3>
            <HeadersTable
              headers={props.data.recording?.response_headers ?? null}
              emptyCopy="No response headers captured."
            />
          </section>
        </div>
      </Show>
      <Show when={props.tab === 'raw'}>
        <section class="recorded-modal__subsection">
          <h3 class="recorded-modal__subtitle">Request</h3>
          <CodeBlock
            code={prettyJson(props.data.recording?.request_body ?? null)}
            language="json"
          />
        </section>
        <section class="recorded-modal__subsection">
          <h3 class="recorded-modal__subtitle">Response</h3>
          <CodeBlock
            code={prettyJson(props.data.recording?.response_body ?? null)}
            language="json"
          />
        </section>
      </Show>
    </>
  );
}

interface ConversationProps {
  messages: ChatMessage[];
  rows: OutlineRow[];
  visibleRoles: ReadonlySet<Role>;
  expandedTurns: ReadonlySet<number>;
  activeIndex: number | null;
  renderMode: 'rendered' | 'raw';
  searchQuery: string;
  onToggle: (index: number) => void;
}

function Conversation(props: ConversationProps): JSX.Element {
  const visible = () => props.rows.filter((r) => props.visibleRoles.has(r.role));
  return (
    <Show
      when={visible().length > 0}
      fallback={<div class="recorded-modal__empty">No turns match the current filters.</div>}
    >
      <div class="recorded-modal__turns">
        <For each={visible()}>
          {(row) => (
            <RecordedTurn
              index={row.index}
              message={props.messages[row.index]!}
              role={row.role}
              tokens={row.tokens}
              preview={row.preview}
              expanded={props.expandedTurns.has(row.index)}
              onToggle={() => props.onToggle(row.index)}
              renderMode={props.renderMode}
              searchQuery={props.searchQuery}
              isActive={props.activeIndex === row.index}
            />
          )}
        </For>
      </div>
    </Show>
  );
}
