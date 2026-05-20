import { For, Show, createEffect, onCleanup, type JSX } from 'solid-js';
import { formatCost, formatDuration, formatNumber, formatTime } from '../services/formatters.js';
import type { MessageDetailResponse, MessageRecording } from '../services/api.js';

/**
 * Single source of truth for the drawer's tab bar. Adding a tab touches
 * this array only (plus the tab's render branch in RecordedTabContent).
 * `countKey` maps the tab to an entry on the `counts` bag so a new tab
 * with a count just declares which key to read.
 */
export const DRAWER_TABS = [
  { id: 'conversation', label: 'Conversation', countKey: 'conversation' as const },
  { id: 'response', label: 'Response' },
  { id: 'tools', label: 'Tools', countKey: 'tools' as const },
  { id: 'headers', label: 'Headers' },
  { id: 'raw', label: 'Raw' },
] as const;

export type TabId = (typeof DRAWER_TABS)[number]['id'];
export type TabCounts = { conversation: number; tools: number };

export function CloseIcon(): JSX.Element {
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

function MetricPill(props: { label: string; value: string | null }): JSX.Element {
  return (
    <Show when={props.value != null && props.value !== ''}>
      <span class="recorded-modal__metric-pill">
        <span class="recorded-modal__metric-label">{props.label}</span>
        <span class="recorded-modal__metric-value">{props.value}</span>
      </span>
    </Show>
  );
}

interface HeaderProps {
  data: MessageDetailResponse | null | undefined;
  onClose: () => void;
}

export function DrawerHeader(props: HeaderProps): JSX.Element {
  return (
    <header class="recorded-drawer__header">
      <div>
        <h2 id="recorded-drawer-title" class="recorded-modal__title">
          Recorded message
        </h2>
        <Show when={props.data}>
          <div class="recorded-modal__subheader">
            <span>{formatTime(props.data!.message.timestamp)}</span>
            <Show when={props.data!.message.model}>
              <span class="recorded-modal__sep" aria-hidden="true">
                ·
              </span>
              <span>{props.data!.message.model}</span>
            </Show>
            <Show when={props.data!.message.auth_type}>
              <span class="recorded-modal__sep" aria-hidden="true">
                ·
              </span>
              <span>{props.data!.message.auth_type}</span>
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
    </header>
  );
}

interface MetricsProps {
  message: MessageDetailResponse['message'];
  recording: MessageRecording | null;
}

export function DrawerMetrics(props: MetricsProps): JSX.Element {
  const totalTokens = () => (props.message.input_tokens ?? 0) + (props.message.output_tokens ?? 0);
  const costValue = () =>
    props.message.auth_type === 'subscription' ? '$0.00' : formatCost(props.message.cost_usd ?? 0);
  return (
    <div class="recorded-drawer__metrics" aria-label="Call metrics">
      <MetricPill label="input" value={formatNumber(props.message.input_tokens ?? 0)} />
      <MetricPill label="output" value={formatNumber(props.message.output_tokens ?? 0)} />
      <Show when={(props.message.cache_read_tokens ?? 0) > 0}>
        <MetricPill label="cache read" value={formatNumber(props.message.cache_read_tokens)} />
      </Show>
      <MetricPill label="total" value={formatNumber(totalTokens())} />
      <MetricPill label="cost" value={costValue()} />
      <Show when={props.message.duration_ms != null}>
        <MetricPill label="duration" value={formatDuration(props.message.duration_ms ?? 0)} />
      </Show>
      <Show when={props.message.routing_tier}>
        <MetricPill label="tier" value={props.message.routing_tier} />
      </Show>
      <Show when={props.recording?.size_bytes != null}>
        <MetricPill
          label="size"
          value={`${(Number(props.recording!.size_bytes!) / 1024).toFixed(1)} KB`}
        />
      </Show>
    </div>
  );
}

export interface PrimaryActionsProps {
  hasRequestBody: boolean;
  hasResponseBody: boolean;
  onCopyRequest: () => void;
  onCopyResponse: () => void;
}

function PrimaryActions(props: PrimaryActionsProps): JSX.Element {
  return (
    <>
      <Show when={props.hasRequestBody}>
        <button type="button" class="btn btn--outline btn--sm" onClick={props.onCopyRequest}>
          Copy request
        </button>
      </Show>
      <Show when={props.hasResponseBody}>
        <button type="button" class="btn btn--outline btn--sm" onClick={props.onCopyResponse}>
          Copy response
        </button>
      </Show>
    </>
  );
}

/** The right half — overflow menu with the delete-with-confirm flow. */
export interface OverflowMenuProps {
  hasRecording: boolean;
  overflowOpen: boolean;
  onToggleOverflow: () => void;
  confirmingDelete: boolean;
  onStartDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
  deleting: boolean;
}

function OverflowMenu(props: OverflowMenuProps): JSX.Element {
  let wrapper: HTMLDivElement | undefined;

  // Click-outside + Esc dismissal. Installed only while the menu is open
  // so we don't pay for a document-level listener on every drawer view.
  createEffect(() => {
    if (!props.overflowOpen) return;
    const onPointerDown = (ev: PointerEvent) => {
      if (wrapper && !wrapper.contains(ev.target as Node)) {
        props.onToggleOverflow();
      }
    };
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape') return;
      ev.stopPropagation();
      props.onToggleOverflow();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    onCleanup(() => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown, true);
    });
  });

  return (
    <Show when={props.hasRecording}>
      <div class="recorded-drawer__overflow" ref={(el) => (wrapper = el)}>
        <button
          type="button"
          class="recorded-drawer__overflow-btn"
          onClick={props.onToggleOverflow}
          aria-haspopup="menu"
          aria-expanded={props.overflowOpen}
          aria-label="More actions"
        >
          ⋯
        </button>
        <Show when={props.overflowOpen}>
          <Show
            when={!props.confirmingDelete}
            fallback={
              <div class="recorded-drawer__overflow-menu" role="menu">
                <span class="recorded-drawer__overflow-confirm">
                  Delete? The message stays in your log.
                </span>
                <button
                  type="button"
                  class="btn btn--ghost btn--sm"
                  onClick={props.onCancelDelete}
                  disabled={props.deleting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  class="btn btn--danger btn--sm"
                  onClick={props.onConfirmDelete}
                  disabled={props.deleting}
                >
                  {props.deleting ? <span class="spinner" /> : 'Confirm delete'}
                </button>
              </div>
            }
          >
            <div class="recorded-drawer__overflow-menu" role="menu">
              <button
                type="button"
                role="menuitem"
                class="recorded-drawer__overflow-item"
                onClick={props.onStartDelete}
              >
                Delete recording
              </button>
            </div>
          </Show>
        </Show>
      </div>
    </Show>
  );
}

/** Retained for convenience where both halves are bundled (the drawer shell). */
export interface ActionBarProps extends PrimaryActionsProps, OverflowMenuProps {}

export function DrawerActionBar(props: ActionBarProps): JSX.Element {
  return (
    <div class="recorded-drawer__actions">
      <PrimaryActions
        hasRequestBody={props.hasRequestBody}
        hasResponseBody={props.hasResponseBody}
        onCopyRequest={props.onCopyRequest}
        onCopyResponse={props.onCopyResponse}
      />
      <div class="recorded-drawer__actions-spacer" />
      <OverflowMenu
        hasRecording={props.hasRecording}
        overflowOpen={props.overflowOpen}
        onToggleOverflow={props.onToggleOverflow}
        confirmingDelete={props.confirmingDelete}
        onStartDelete={props.onStartDelete}
        onCancelDelete={props.onCancelDelete}
        onConfirmDelete={props.onConfirmDelete}
        deleting={props.deleting}
      />
    </div>
  );
}

export interface TabsProps {
  active: TabId;
  onChange: (tab: TabId) => void;
  renderMode: 'rendered' | 'raw';
  onToggleRenderMode: () => void;
  counts: TabCounts;
}

export function DrawerTabs(props: TabsProps): JSX.Element {
  return (
    <div class="recorded-drawer__tabs" role="tablist">
      <For each={DRAWER_TABS}>
        {(tab) => (
          <button
            type="button"
            role="tab"
            aria-selected={props.active === tab.id}
            class="recorded-drawer__tab"
            classList={{ 'recorded-drawer__tab--active': props.active === tab.id }}
            onClick={() => props.onChange(tab.id)}
          >
            {tab.label}
            <Show when={'countKey' in tab}>
              <span class="recorded-drawer__tab-count">
                {' '}
                ({props.counts[(tab as { countKey: keyof TabCounts }).countKey]})
              </span>
            </Show>
          </button>
        )}
      </For>
      <div class="recorded-drawer__tabs-spacer" />
      <button
        type="button"
        class="recorded-drawer__render-toggle"
        onClick={props.onToggleRenderMode}
        aria-label="Toggle rendered/raw view"
        title="Switch between rendered and raw content"
      >
        {props.renderMode === 'rendered' ? 'Rendered' : 'Raw'}
      </button>
    </div>
  );
}
