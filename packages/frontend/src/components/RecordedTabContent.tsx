import { For, Show, createSignal, onCleanup, type JSX } from 'solid-js';
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
            <ResizableConversation
              outline={props.outlineProps}
              rows={props.rows}
              visibleRoles={props.visibleRoles}
              messages={props.messages}
              expandedTurns={props.expandedTurns}
              activeTurnIndex={props.activeTurnIndex}
              renderMode={props.renderMode}
              searchQuery={props.searchQuery}
              onToggleTurn={props.onToggleTurn}
              onConversationScroll={props.onConversationScroll}
            />
          );
        })()}
      </Show>
      <Show when={props.tab === 'response'}>
        <div class="recorded-drawer__contained-pane">
          <ResponseTab responseBody={props.data.recording?.response_body ?? null} />
        </div>
      </Show>
      <Show when={props.tab === 'tools'}>
        <div class="recorded-drawer__contained-pane">
          <Show
            when={tools(props.data).length > 0}
            fallback={<div class="recorded-modal__empty">No tools defined on this call.</div>}
          >
            <ToolsList tools={tools(props.data)} />
          </Show>
        </div>
      </Show>
      <Show when={props.tab === 'headers'}>
        <div class="recorded-drawer__contained-pane">
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
        </div>
      </Show>
      <Show when={props.tab === 'raw'}>
        <div class="recorded-drawer__contained-pane">
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
        </div>
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

const SIDEBAR_DEFAULT = 260;
const SIDEBAR_MIN = 150;
const SIDEBAR_MAX = 550;

function ResizableConversation(props: {
  outline?: OutlineProps;
  rows: OutlineRow[];
  visibleRoles: ReadonlySet<Role>;
  messages: ChatMessage[];
  expandedTurns: ReadonlySet<number>;
  activeTurnIndex: number | null;
  renderMode: 'rendered' | 'raw';
  searchQuery: string;
  onToggleTurn: (index: number) => void;
  onConversationScroll?: () => void;
}): JSX.Element {
  const [sidebarWidth, setSidebarWidth] = createSignal(SIDEBAR_DEFAULT);
  const [dragging, setDragging] = createSignal(false);
  const [collapsed, setCollapsed] = createSignal(false);

  let layoutRef: HTMLDivElement | undefined;

  const startDrag = (e: MouseEvent) => {
    e.preventDefault();
    setDragging(true);

    const onMove = (ev: MouseEvent) => {
      if (!layoutRef) return;
      const rect = layoutRef.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      if (x < SIDEBAR_MIN) {
        setCollapsed(true);
        setSidebarWidth(0);
      } else {
        setCollapsed(false);
        setSidebarWidth(Math.min(x, SIDEBAR_MAX));
      }
    };

    const onUp = () => {
      setDragging(false);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const expandFromEdge = (e: MouseEvent) => {
    if (!collapsed()) return;
    setCollapsed(false);
    setSidebarWidth(SIDEBAR_DEFAULT);
    startDrag(e);
  };

  return (
    <div
      class="recorded-drawer__conversation-layout"
      ref={(el) => (layoutRef = el)}
      classList={{ 'recorded-drawer__conversation-layout--dragging': dragging() }}
      style={{
        'grid-template-columns': collapsed() ? '0px 4px 1fr' : `${sidebarWidth()}px 4px 1fr`,
      }}
    >
      <Show when={!collapsed() && props.outline}>
        <RecordedOutline
          rows={props.rows}
          activeIndex={props.outline!.activeIndex}
          visibleRoles={props.visibleRoles}
          searchQuery={props.outline!.searchQuery}
          onSearch={props.outline!.onSearch}
          onJump={props.outline!.onJump}
          onToggleRole={props.outline!.onToggleRole}
          onJumpFirstUser={props.outline!.onJumpFirstUser}
          onJumpLastUser={props.outline!.onJumpLastUser}
          onJumpLastAssistant={props.outline!.onJumpLastAssistant}
        />
      </Show>
      <Show when={collapsed()}>
        <div />
      </Show>
      <div
        class="recorded-drawer__resize-handle"
        classList={{ 'recorded-drawer__resize-handle--collapsed': collapsed() }}
        onMouseDown={(e) => (collapsed() ? expandFromEdge(e) : startDrag(e))}
        title={collapsed() ? 'Show sidebar' : undefined}
      >
        <div class="recorded-drawer__resize-grip" />
      </div>
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
