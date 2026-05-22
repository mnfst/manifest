import { For, Show, createEffect, createSignal, onCleanup, type JSX } from 'solid-js';
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
  onCopyRequest?: () => void;
  onCopyResponse?: () => void;
  hasRequestBody?: boolean;
  hasResponseBody?: boolean;
  hasRecording?: boolean;
  onStartDelete?: () => void;
  overflowOpen?: boolean;
  onToggleOverflow?: () => void;
  confirmingDelete?: boolean;
  onCancelDelete?: () => void;
  onConfirmDelete?: () => void;
  deleting?: boolean;
}

const [metadataVisible, setMetadataVisible] = createSignal(true);

function toggleMetadata() {
  setMetadataVisible((v) => !v);
}

export { metadataVisible };

function CollapseIcon(): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      fill="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="m6.29 19.29 1.42 1.42 4.29-4.3 4.29 4.3 1.42-1.42-5.71-5.7zM12 7.59l-4.29-4.3-1.42 1.42 5.71 5.7 5.71-5.7-1.42-1.42z" />
    </svg>
  );
}

function ExpandIcon(): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      fill="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="m12 17.59-4.29-4.3-1.42 1.42 5.71 5.7 5.71-5.7-1.42-1.42zm-5.71-8.3 1.42 1.42L12 6.41l4.29 4.3 1.42-1.42L12 3.59z" />
    </svg>
  );
}

export function DrawerHeader(props: HeaderProps): JSX.Element {
  const fullId = () => props.data?.message.id ?? '';
  let menuWrapper: HTMLDivElement | undefined;

  createEffect(() => {
    if (!props.overflowOpen) return;
    const onPointerDown = (ev: PointerEvent) => {
      if (menuWrapper && !menuWrapper.contains(ev.target as Node)) {
        props.onToggleOverflow?.();
      }
    };
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape') return;
      ev.stopPropagation();
      props.onToggleOverflow?.();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    onCleanup(() => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown, true);
    });
  });

  return (
    <header class="recorded-drawer__header">
      <div style="display: flex; align-items: center; flex: 1; min-width: 0;">
        <h2 id="recorded-drawer-title" class="recorded-modal__title" style="margin: 0;">
          Message log
          <Show when={props.data}>
            <span style="font-weight: 400; color: hsl(var(--muted-foreground)); margin-left: 6px; font-size: var(--font-size-xl);">
              {fullId()}
            </span>
          </Show>
        </h2>
      </div>
      <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
        <button
          type="button"
          class="modal-back-btn recorded-drawer__tooltip-btn"
          onClick={toggleMetadata}
          data-tooltip={metadataVisible() ? 'Hide metadata' : 'Show metadata'}
          aria-label={metadataVisible() ? 'Hide metadata' : 'Show metadata'}
        >
          <Show when={metadataVisible()} fallback={<ExpandIcon />}>
            <CollapseIcon />
          </Show>
        </button>
        <div
          class="recorded-drawer__overflow"
          ref={(el) => (menuWrapper = el)}
          style="position: relative;"
        >
          <button
            type="button"
            class="modal-back-btn"
            onClick={() => props.onToggleOverflow?.()}
            aria-haspopup="menu"
            aria-expanded={props.overflowOpen}
            aria-label="More actions"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              fill="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle cx="12" cy="5" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="12" cy="19" r="2" />
            </svg>
          </button>
          <Show when={props.overflowOpen}>
            <div class="recorded-drawer__overflow-menu" role="menu">
              <Show when={props.hasRequestBody}>
                <button
                  type="button"
                  role="menuitem"
                  class="recorded-drawer__overflow-item"
                  onClick={() => {
                    props.onCopyRequest?.();
                    props.onToggleOverflow?.();
                  }}
                >
                  Copy request
                </button>
              </Show>
              <Show when={props.hasResponseBody}>
                <button
                  type="button"
                  role="menuitem"
                  class="recorded-drawer__overflow-item"
                  onClick={() => {
                    props.onCopyResponse?.();
                    props.onToggleOverflow?.();
                  }}
                >
                  Copy response
                </button>
              </Show>
              <Show when={props.hasRecording}>
                <div class="recorded-drawer__overflow-sep" />
                <button
                  type="button"
                  role="menuitem"
                  class="recorded-drawer__overflow-item recorded-drawer__overflow-item--danger"
                  onClick={() => {
                    props.onStartDelete?.();
                    props.onToggleOverflow?.();
                  }}
                >
                  Delete recording
                </button>
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
      </div>
    </header>
  );
}

export function DrawerSubheader(_props: { data: MessageDetailResponse }): JSX.Element {
  return <></>;
}

interface MetricsProps {
  message: MessageDetailResponse['message'];
  recording: MessageRecording | null;
}

function MetaField(props: {
  label: string;
  value: string | number | null | undefined;
}): JSX.Element {
  return (
    <Show when={props.value != null && props.value !== ''}>
      <span class="msg-detail__meta-item">
        <span class="msg-detail__meta-label">{props.label}</span>
        {props.value}
      </span>
    </Show>
  );
}

export function DrawerMetrics(props: MetricsProps): JSX.Element {
  const m = () => props.message;
  const totalTokens = () => (m().input_tokens ?? 0) + (m().output_tokens ?? 0);
  const costValue = () =>
    m().auth_type === 'subscription' ? '$0.00' : formatCost(m().cost_usd ?? 0);
  const sdk = () => m().caller_attribution?.sdk ?? null;
  const providerName = () => m().model?.split('/')[0] ?? null;
  const sizeKb = () =>
    props.recording?.size_bytes != null
      ? `${(Number(props.recording.size_bytes) / 1024).toFixed(1)} KB`
      : null;

  return (
    <div
      class="msg-detail__meta"
      style="padding: 0 var(--drawer-pad); padding-bottom: var(--gap-md); min-height: 0;"
      aria-label="Call metrics"
    >
      <MetaField label="Date" value={formatTime(m().timestamp)} />
      <MetaField label="Status" value={m().status} />
      <MetaField label="Provider" value={providerName()} />
      <MetaField label="Auth" value={m().auth_type} />
      <MetaField label="Model" value={m().model} />
      <MetaField label="Routing" value={m().routing_tier} />
      <MetaField label="Reason" value={m().routing_reason} />
      <MetaField label="API Key" value={m().provider_key_label ?? 'Default'} />
      <Show when={sdk()}>
        <MetaField label="SDK" value={sdk()} />
      </Show>
      <MetaField label="Input" value={formatNumber(m().input_tokens ?? 0)} />
      <MetaField label="Output" value={formatNumber(m().output_tokens ?? 0)} />
      <Show when={(m().cache_read_tokens ?? 0) > 0}>
        <MetaField label="Cache Read" value={formatNumber(m().cache_read_tokens)} />
      </Show>
      <MetaField label="Total" value={formatNumber(totalTokens())} />
      <MetaField label="Cost" value={costValue()} />
      <Show when={m().duration_ms != null}>
        <MetaField label="Duration" value={formatDuration(m().duration_ms ?? 0)} />
      </Show>
      <Show when={sizeKb()}>
        <MetaField label="Size" value={sizeKb()} />
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
  counts: TabCounts;
}

export function DrawerTabs(props: TabsProps): JSX.Element {
  return (
    <div class="recorded-drawer__tabs" role="tablist">
      <div class="panel__tabs">
        <For each={DRAWER_TABS}>
          {(tab) => (
            <button
              type="button"
              role="tab"
              aria-selected={props.active === tab.id}
              class="panel__tab"
              classList={{ 'panel__tab--active': props.active === tab.id }}
              onClick={() => props.onChange(tab.id)}
            >
              {tab.label}
              <Show when={'countKey' in tab}>
                <span style="opacity: 0.6; margin-left: 2px;">
                  ({props.counts[(tab as { countKey: keyof TabCounts }).countKey]})
                </span>
              </Show>
            </button>
          )}
        </For>
      </div>
    </div>
  );
}
