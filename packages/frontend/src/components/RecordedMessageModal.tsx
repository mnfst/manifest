import { Show, createEffect, createMemo, createResource, on, type Component } from 'solid-js';
import { Portal } from 'solid-js/web';
import { useNavigate } from '@solidjs/router';
import { buildTurnPreview, estimateMessageTokens } from './recorded-message-helpers.js';
import RecordedOutline, { type OutlineRow } from './RecordedOutline.jsx';
import RecordedEssentials from './RecordedEssentials.jsx';
import {
  DrawerHeader,
  DrawerMetrics,
  DrawerActionBar,
  DrawerTabs,
} from './RecordedDrawerChrome.jsx';
import { prettyJson } from './RecordedResponseTab.jsx';
import { RecordedTabContent } from './RecordedTabContent.jsx';
import {
  coerceContentToText,
  countMatches,
  detectRequestBodyFormat,
  extractAssistantReply,
  extractRequestMessages,
  extractRequestTools,
  normalizeRole,
  type Role,
} from './recorded-message-helpers.js';
import { createRecordedDrawerState } from './recorded-drawer-state.js';
import {
  deleteMessageRecording,
  getMessageDetails,
  type MessageDetailResponse,
} from '../services/api.js';
import { agentPath, useAgentName } from '../services/routing.js';
import { toast } from '../services/toast-store.js';

interface Props {
  open: boolean;
  messageId: string | null;
  onClose: () => void;
  onDeleted?: (id: string) => void;
}

const requestMessages = (d: MessageDetailResponse) =>
  extractRequestMessages(d.recording?.request_body);
const requestTools = (d: MessageDetailResponse) => extractRequestTools(d.recording?.request_body);

/** Don't hijack '/' when the user is typing in any editable field. */
function isFocusInEditable(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

const RecordedMessageModal: Component<Props> = (props) => {
  const navigate = useNavigate();
  const agentName = useAgentName();

  const [data, { refetch }] = createResource(
    () => (props.open && props.messageId ? props.messageId : null),
    (id) => (id ? getMessageDetails(id) : Promise.resolve(null)),
  );

  const state = createRecordedDrawerState(
    () => data(),
    () => props.open,
  );

  const handleDelete = async () => {
    const id = props.messageId;
    if (!id || state.deleting()) return;
    state.setDeleting(true);
    try {
      await deleteMessageRecording(id);
      toast.success('Recording deleted.');
      props.onDeleted?.(id);
      state.setConfirmingDelete(false);
      props.onClose();
    } catch {
      /* fetchMutate already surfaces an error toast */
    } finally {
      state.setDeleting(false);
    }
  };

  const handleOptimize = () => {
    const id = props.messageId;
    const name = agentName();
    if (!id || !name) return;
    // Guard against firing while the details fetch is in flight — the
    // drawer would close before we know whether the recording even exists,
    // and Benchmark would silently fail when its own fetch sees no body.
    if (data.loading || !data()?.recording) {
      toast.error('This message has no recording to benchmark.');
      return;
    }
    props.onClose();
    navigate(`${agentPath(name, '/benchmark')}?optimize=${encodeURIComponent(id)}`);
  };

  const copyToClipboard = async (payload: unknown, label: string) => {
    if (payload == null) {
      toast.error(`${label} is not captured on this recording.`);
      return;
    }
    try {
      await navigator.clipboard.writeText(prettyJson(payload));
      toast.success(`${label} copied to clipboard.`);
    } catch {
      toast.error('Clipboard write blocked by the browser.');
    }
  };

  const messages = () => {
    const d = data();
    return d ? requestMessages(d) : [];
  };

  const lastUserMessage = createMemo(() => {
    const ms = messages();
    for (let i = ms.length - 1; i >= 0; i--) {
      if (normalizeRole(ms[i]!.role) === 'user') return { msg: ms[i]!, index: i };
    }
    return null;
  });

  const assistantReply = createMemo(() => {
    const d = data();
    return d ? extractAssistantReply(d.recording?.response_body ?? null) : null;
  });

  // Only the OpenAI chat-completion shape carries an inline `messages[]`
  // that the rail + Essentials can render meaningfully. For Claude / Gemini
  // / unknown / empty bodies we collapse the chrome so the user sees a
  // single "use the Raw tab" hint in the main pane instead of three
  // stacked empty states.
  const isOpenAIFormat = createMemo(() => {
    const d = data();
    if (!d?.recording?.request_body) return false;
    return detectRequestBodyFormat(d.recording.request_body) === 'openai';
  });

  const lastAssistantTurnIndex = createMemo(() => {
    const ms = messages();
    for (let i = ms.length - 1; i >= 0; i--) {
      if (normalizeRole(ms[i]!.role) === 'assistant') return i;
    }
    return null;
  });

  // Derived per-turn data that only changes with the recording itself — the
  // lowered content string is the expensive part (tens of KB each on
  // OpenClaw recordings), so memoising it here means a search keystroke
  // only rescans, never re-lowercases.
  const turnCorpus = createMemo(() =>
    messages().map((m, i) => ({
      index: i,
      role: normalizeRole(m.role),
      rawRole: m.role,
      preview: buildTurnPreview(m),
      tokens: estimateMessageTokens(m),
      lowered: coerceContentToText(m.content).toLowerCase(),
    })),
  );

  const outlineRows = createMemo((): OutlineRow[] => {
    const q = state.searchQuery().trim().toLowerCase();
    return turnCorpus().map((t) => ({
      index: t.index,
      role: t.role,
      roleLabel: t.role === 'unknown' ? (t.rawRole ?? 'unknown') : t.role,
      preview: t.preview,
      tokens: t.tokens,
      matchCount: q ? countMatches(t.lowered, q) : undefined,
    }));
  });

  const jumpTo = (index: number) => {
    state.expandTurn(index);
    state.setActiveTurnIndex(index);
    state.setActiveTab('conversation');
    queueMicrotask(() => {
      const el = document.getElementById(`recorded-turn-${index}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const jumpLastUser = () => {
    const found = lastUserMessage();
    if (found) jumpTo(found.index);
  };
  const jumpLastAssistant = () => {
    const i = lastAssistantTurnIndex();
    if (i != null) jumpTo(i);
  };
  const jumpFirstUser = () => {
    const i = messages().findIndex((m) => normalizeRole(m.role) === 'user');
    if (i >= 0) jumpTo(i);
  };

  // Focus the drawer container when it opens so keyboard events (Esc, '/')
  // reach it without the user having to click first.
  let drawerEl: HTMLDivElement | undefined;
  createEffect(
    on(
      () => props.open,
      (open) => {
        if (!open) return;
        queueMicrotask(() => drawerEl?.focus());
      },
    ),
  );

  const onDrawerKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      // OverflowMenu's own handler catches Esc while it's open — by the time
      // an Escape reaches the drawer the menu has either closed or wasn't
      // open to begin with, so Esc here always means "close the drawer".
      props.onClose();
      return;
    }
    if (e.key === '/' && !isFocusInEditable()) {
      e.preventDefault();
      const input = document.getElementById('recorded-drawer-search') as HTMLInputElement | null;
      input?.focus();
      input?.select();
    }
  };

  return (
    <Portal>
      <Show when={props.open}>
        <div
          class="modal-overlay recorded-drawer__overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) props.onClose();
          }}
          onKeyDown={(e) => {
            // Belt-and-suspenders: the drawer container has its own Esc
            // handler (fires when the drawer has focus), but we also catch
            // it here so overlay-level events — and tests that dispatch
            // keydown on the overlay — still close the drawer.
            if (e.key === 'Escape') props.onClose();
          }}
        >
          <div
            class="recorded-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="recorded-drawer-title"
            tabindex="-1"
            ref={(el) => (drawerEl = el)}
            onKeyDown={onDrawerKeyDown}
          >
            <DrawerHeader data={data()} onClose={props.onClose} />

            <Show when={data() && !data.loading && !data.error}>
              <DrawerMetrics message={data()!.message} recording={data()!.recording} />
              <DrawerActionBar
                canOptimize={!!data()!.recording}
                optimizePending={data.loading}
                onOptimize={handleOptimize}
                hasRequestBody={!!data()!.recording?.request_body}
                hasResponseBody={!!data()!.recording?.response_body}
                onCopyRequest={() => copyToClipboard(data()!.recording?.request_body, 'Request')}
                onCopyResponse={() => copyToClipboard(data()!.recording?.response_body, 'Response')}
                overflowOpen={state.overflowOpen()}
                onToggleOverflow={() => state.setOverflowOpen((v) => !v)}
                confirmingDelete={state.confirmingDelete()}
                onStartDelete={() => state.setConfirmingDelete(true)}
                onCancelDelete={() => state.setConfirmingDelete(false)}
                onConfirmDelete={handleDelete}
                deleting={state.deleting()}
                hasRecording={!!data()!.recording}
              />
              <Show when={isOpenAIFormat()}>
                <RecordedEssentials
                  lastUser={lastUserMessage()?.msg ?? null}
                  assistantReply={assistantReply()}
                  onJumpToLastUser={jumpLastUser}
                  onJumpToAssistant={jumpLastAssistant}
                />
              </Show>
            </Show>

            <div class="recorded-drawer__layout">
              <Show when={data() && !data.loading && !data.error && isOpenAIFormat()}>
                <RecordedOutline
                  rows={outlineRows()}
                  activeIndex={state.activeTurnIndex()}
                  visibleRoles={state.visibleRoles()}
                  searchQuery={state.searchQuery()}
                  onSearch={state.setSearchQuery}
                  onJump={jumpTo}
                  onToggleRole={state.toggleRole}
                  onJumpFirstUser={jumpFirstUser}
                  onJumpLastUser={jumpLastUser}
                  onJumpLastAssistant={jumpLastAssistant}
                />
              </Show>

              <main class="recorded-drawer__main">
                <Show when={data.loading}>
                  <div class="recorded-modal__loader">Loading recording&hellip;</div>
                </Show>
                <Show when={data.error}>
                  <div class="recorded-modal__error">
                    Failed to load recording.{' '}
                    <button type="button" class="recorded-modal__retry" onClick={() => refetch()}>
                      Retry
                    </button>
                  </div>
                </Show>

                <Show when={data() && !data.loading && !data.error}>
                  <DrawerTabs
                    active={state.activeTab()}
                    onChange={state.setActiveTab}
                    renderMode={state.renderMode()}
                    onToggleRenderMode={state.toggleRenderMode}
                    counts={{
                      conversation: messages().length,
                      tools: requestTools(data()!).length,
                    }}
                  />
                  <div class="recorded-drawer__tab-body">
                    <RecordedTabContent
                      tab={state.activeTab()}
                      data={data()!}
                      messages={messages()}
                      rows={outlineRows()}
                      visibleRoles={state.visibleRoles()}
                      expandedTurns={state.expandedTurns()}
                      activeTurnIndex={state.activeTurnIndex()}
                      renderMode={state.renderMode()}
                      searchQuery={state.searchQuery()}
                      onToggleTurn={state.toggleTurn}
                    />
                  </div>
                </Show>
              </main>
            </div>
          </div>
        </div>
      </Show>
    </Portal>
  );
};

export default RecordedMessageModal;
