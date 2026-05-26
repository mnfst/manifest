import { createEffect, createSignal, on, type Accessor, type Setter } from 'solid-js';
import {
  extractRecordedConversationMessages,
  normalizeRole,
  shouldCollapseByDefault,
  type ChatMessage,
  type Role,
} from './recorded-message-helpers.js';
import type { MessageDetailResponse } from '../services/api.js';
import { estimateMessageTokens } from './recorded-message-helpers.js';
import type { TabId } from './RecordedDrawerChrome.jsx';

/**
 * All of the mutable UI state that the recorded-message drawer needs —
 * expanded-turn set, role filter, search query, tab selection, etc. —
 * lives here so the shell component stays a thin assembly of wiring.
 * The hook takes a reactive accessor for the loaded detail and seeds
 * expanded-by-default on each new recording.
 */
export interface RecordedDrawerState {
  activeTab: Accessor<TabId>;
  setActiveTab: Setter<TabId>;
  renderMode: Accessor<'rendered' | 'raw'>;
  toggleRenderMode: () => void;
  visibleRoles: Accessor<ReadonlySet<Role>>;
  toggleRole: (role: Role) => void;
  searchQuery: Accessor<string>;
  setSearchQuery: (q: string) => void;
  activeTurnIndex: Accessor<number | null>;
  setActiveTurnIndex: Setter<number | null>;
  expandedTurns: Accessor<ReadonlySet<number>>;
  toggleTurn: (index: number) => void;
  expandTurn: (index: number) => void;
  overflowOpen: Accessor<boolean>;
  setOverflowOpen: Setter<boolean>;
  confirmingDelete: Accessor<boolean>;
  setConfirmingDelete: Setter<boolean>;
  deleting: Accessor<boolean>;
  setDeleting: Setter<boolean>;
}

const ALL_ROLES: Role[] = ['user', 'assistant', 'system', 'tool'];

export function createRecordedDrawerState(
  detail: Accessor<MessageDetailResponse | null | undefined>,
  open: Accessor<boolean>,
): RecordedDrawerState {
  const [activeTab, setActiveTab] = createSignal<TabId>('conversation');
  const [renderMode, setRenderMode] = createSignal<'rendered' | 'raw'>('rendered');
  const [visibleRoles, setVisibleRoles] = createSignal<Set<Role>>(new Set<Role>(ALL_ROLES));
  const [searchQuery, setSearchQueryRaw] = createSignal('');
  const [activeTurnIndex, setActiveTurnIndex] = createSignal<number | null>(null);
  const [expandedTurns, setExpandedTurns] = createSignal<Set<number>>(new Set());
  const [overflowOpen, setOverflowOpen] = createSignal(false);
  const [confirmingDelete, setConfirmingDelete] = createSignal(false);
  const [deleting, setDeleting] = createSignal(false);

  // Seed expanded-by-default whenever a new recording loads.
  createEffect(
    on(
      () => detail(),
      (d) => {
        if (!d?.recording?.request_body) return;
        const next = new Set<number>();
        extractRecordedConversationMessages(
          d.recording.request_body,
          d.recording.response_body ?? null,
        ).forEach((m: ChatMessage, i) => {
          const role = normalizeRole(m.role);
          const tokens = estimateMessageTokens(m);
          if (!shouldCollapseByDefault(role, tokens)) next.add(i);
        });
        setExpandedTurns(next);
      },
    ),
  );

  // Reset transient UI state on close so the next open starts clean.
  createEffect(
    on(
      () => open(),
      (isOpen) => {
        if (isOpen) return;
        setActiveTab('conversation');
        setSearchQueryRaw('');
        setActiveTurnIndex(null);
        setOverflowOpen(false);
      },
    ),
  );

  const toggleRenderMode = () => setRenderMode((m) => (m === 'rendered' ? 'raw' : 'rendered'));

  const toggleRole = (role: Role) => {
    const next = new Set(visibleRoles());
    if (next.has(role)) next.delete(role);
    else next.add(role);
    setVisibleRoles(next);
  };

  const toggleTurn = (index: number) => {
    const next = new Set(expandedTurns());
    if (next.has(index)) next.delete(index);
    else next.add(index);
    setExpandedTurns(next);
  };

  const expandTurn = (index: number) => {
    const current = expandedTurns();
    if (current.has(index)) return;
    const next = new Set(current);
    next.add(index);
    setExpandedTurns(next);
  };

  return {
    activeTab,
    setActiveTab,
    renderMode,
    toggleRenderMode,
    visibleRoles,
    toggleRole,
    searchQuery,
    setSearchQuery: setSearchQueryRaw,
    activeTurnIndex,
    setActiveTurnIndex,
    expandedTurns,
    toggleTurn,
    expandTurn,
    overflowOpen,
    setOverflowOpen,
    confirmingDelete,
    setConfirmingDelete,
    deleting,
    setDeleting,
  };
}
