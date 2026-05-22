import {
  Show,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  on,
  onCleanup,
  type Component,
} from 'solid-js';
import { Portal } from 'solid-js/web';
import { useFocusTrap } from '../services/use-focus-trap.js';
import { buildTurnPreview, estimateMessageTokens } from './recorded-message-helpers.js';
import RecordedOutline, { type OutlineRow } from './RecordedOutline.jsx';
import RecordedEssentials from './RecordedEssentials.jsx';
import {
  DrawerHeader,
  DrawerSubheader,
  DrawerMetrics,
  DrawerActionBar,
  metadataVisible,
  DrawerTabs,
} from './RecordedDrawerChrome.jsx';
import { prettyJson } from './RecordedResponseTab.jsx';
import { RecordedTabContent } from './RecordedTabContent.jsx';
import {
  coerceContentToText,
  countMatches,
  detectRequestBodyFormat,
  extractRecordedConversationMessages,
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
import { toast } from '../services/toast-store.js';

interface Props {
  open: boolean;
  messageId: string | null;
  onClose: () => void;
  onDeleted?: (id: string) => void;
}

const requestMessages = (d: MessageDetailResponse) =>
  extractRecordedConversationMessages(
    d.recording?.request_body,
    d.recording?.response_body ?? null,
  );
const requestTools = (d: MessageDetailResponse) => extractRequestTools(d.recording?.request_body);

/** Don't hijack '/' when the user is typing in any editable field. */
function isFocusInEditable(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

const RecordedMessageModal: Component<Props> = (props) => {
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

  const copyToClipboard = async (payload: unknown, label: string) => {
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

  // Only OpenAI-compatible request shapes carry inline conversation turns
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

  let highlightedEl: HTMLElement | null = null;
  let ignoreScroll = false;
  let clearTimer: ReturnType<typeof setTimeout> | null = null;

  const clearHighlight = () => {
    if (clearTimer) {
      clearTimeout(clearTimer);
      clearTimer = null;
    }
    if (highlightedEl) {
      highlightedEl.classList.remove('recorded-modal__turn--highlight');
      highlightedEl = null;
    }
  };

  const onConversationScroll = () => {
    if (ignoreScroll) return;
    if (!highlightedEl) return;
    if (clearTimer) return;
    clearTimer = setTimeout(() => {
      clearHighlight();
    }, 1000);
  };

  const jumpTo = (index: number) => {
    state.expandTurn(index);
    state.setActiveTurnIndex(index);
    state.setActiveTab('conversation');
    queueMicrotask(() => {
      const el = document.getElementById(`recorded-turn-${index}`);
      if (!el) return;
      clearHighlight();
      el.classList.add('recorded-modal__turn--highlight');
      highlightedEl = el;
      ignoreScroll = true;
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(() => {
        ignoreScroll = false;
      }, 600);
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
  // reach it without the user having to click first. The focus trap also
  // restores focus to the previously-active element on close.
  const [drawerElSignal, setDrawerEl] = createSignal<HTMLDivElement | undefined>();
  let drawerEl: HTMLDivElement | undefined;
  useFocusTrap(() => props.open && !state.confirmingDelete(), drawerElSignal, {
    initialFocus: () => drawerElSignal(),
  });
  createEffect(
    on(
      () => props.open,
      (open) => {
        if (open) {
          document.body.style.overflow = 'hidden';
          queueMicrotask(() => drawerEl?.focus());
        } else {
          document.body.style.overflow = '';
        }
      },
    ),
  );
  onCleanup(() => {
    document.body.style.overflow = '';
  });

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
            ref={(el) => {
              drawerEl = el;
              setDrawerEl(el);
            }}
            onKeyDown={onDrawerKeyDown}
          >
            <DrawerHeader
              data={data()}
              onClose={props.onClose}
              hasRequestBody={!!data()?.recording?.request_body}
              hasResponseBody={!!data()?.recording?.response_body}
              hasRecording={!!data()?.recording}
              onCopyRequest={() => copyToClipboard(data()!.recording?.request_body, 'Request')}
              onCopyResponse={() => copyToClipboard(data()!.recording?.response_body, 'Response')}
              overflowOpen={state.overflowOpen()}
              onToggleOverflow={() => state.setOverflowOpen((v) => !v)}
              confirmingDelete={state.confirmingDelete()}
              onStartDelete={() => state.setConfirmingDelete(true)}
              onCancelDelete={() => state.setConfirmingDelete(false)}
              onConfirmDelete={handleDelete}
              deleting={state.deleting()}
            />
            <Show when={data()}>
              <DrawerSubheader data={data()!} />
            </Show>

            <Show when={data() && !data.loading && !data.error}>
              <div
                class="recorded-drawer__metadata-collapse"
                classList={{ 'recorded-drawer__metadata-collapse--hidden': !metadataVisible() }}
              >
                <div style="overflow: hidden; min-height: 0;">
                  <DrawerMetrics message={data()!.message} recording={data()!.recording} />
                </div>
              </div>
            </Show>

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
                  onSearch={state.setSearchQuery}
                  onToggleTurn={state.toggleTurn}
                  onConversationScroll={onConversationScroll}
                  outlineProps={{
                    activeIndex: state.activeTurnIndex(),
                    searchQuery: state.searchQuery(),
                    onSearch: state.setSearchQuery,
                    onJump: jumpTo,
                    onToggleRole: state.toggleRole,
                    onJumpFirstUser: jumpFirstUser,
                    onJumpLastUser: jumpLastUser,
                    onJumpLastAssistant: jumpLastAssistant,
                  }}
                />
              </div>
            </Show>
          </div>
        </div>

        {/* Delete confirmation modal */}
        <Show when={state.confirmingDelete()}>
          <div
            class="modal-overlay"
            onClick={(e) => {
              if (e.target === e.currentTarget) state.setConfirmingDelete(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') state.setConfirmingDelete(false);
            }}
          >
            <div
              class="modal-card"
              style="max-width: 440px;"
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-recording-title"
            >
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--gap-lg);">
                <h3 id="delete-recording-title" style="margin: 0; font-size: var(--font-size-lg);">
                  Delete recording
                </h3>
                <button
                  style="background: none; border: none; cursor: pointer; color: hsl(var(--muted-foreground)); padding: 4px;"
                  onClick={() => state.setConfirmingDelete(false)}
                  aria-label="Close"
                >
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
                </button>
              </div>
              <p style="font-size: var(--font-size-sm); color: hsl(var(--muted-foreground)); margin-bottom: var(--gap-lg);">
                The conversation content and response will be permanently deleted. Metadata (model,
                tokens, cost, routing) will still be visible on the Messages page.
              </p>
              <div style="display: flex; gap: var(--gap-sm); justify-content: flex-end;">
                <button
                  class="btn btn--primary btn--sm"
                  onClick={() => state.setConfirmingDelete(false)}
                >
                  Cancel
                </button>
                <button
                  class="btn btn--danger btn--sm"
                  onClick={handleDelete}
                  disabled={state.deleting()}
                >
                  {state.deleting() ? <span class="spinner" /> : 'Delete recording'}
                </button>
              </div>
            </div>
          </div>
        </Show>
      </Show>
    </Portal>
  );
};

export default RecordedMessageModal;
