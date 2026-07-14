import { createSignal, createResource, Show, For, onCleanup, type Component } from 'solid-js';
import { getMessageDetails } from '../services/api/messages.js';
import { ModelParamsSection, RequestHeadersSection } from './MessageDetailsSections.jsx';
import { AutofixSection } from './MessageDetails.jsx';
import '../styles/request-drawer.css';

export interface RequestDrawerProps {
  messageId: string | null;
  onClose: () => void;
  onOpenMessage?: (id: string) => void;
}

type DrawerTab = 'events' | 'metadata' | 'headers' | 'params';

const TABS: Array<{ value: DrawerTab; label: string }> = [
  { value: 'events', label: 'Request events' },
  { value: 'metadata', label: 'Metadata' },
  { value: 'headers', label: 'Request headers' },
  { value: 'params', label: 'Model params' },
];

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const mon = d.toLocaleString('en-US', { month: 'short' });
  const day = d.getDate();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${mon} ${day}, ${hh}:${mm}:${ss}`;
}

function statusClass(status: string): string {
  if (status === 'ok') return 'drawer-status--success';
  return 'drawer-status--error';
}

function statusLabel(status: string): string {
  if (status === 'ok') return 'Success';
  if (status === 'auto_fixed') return 'Auto-fixed';
  if (status === 'rate_limited') return 'Rate limited';
  return 'Failed';
}

const RequestDrawer: Component<RequestDrawerProps> = (props) => {
  const [tab, setTab] = createSignal<DrawerTab>('events');
  const open = () => props.messageId !== null;

  const [data] = createResource(
    () => props.messageId,
    (id) => (id ? getMessageDetails(id) : null),
  );

  // Close on Escape
  if (typeof document !== 'undefined') {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open()) props.onClose();
    };
    document.addEventListener('keydown', handler);
    onCleanup(() => document.removeEventListener('keydown', handler));
  }

  const m = () => data() as any;

  return (
    <>
      {/* Overlay */}
      <div
        class="drawer-overlay"
        classList={{ 'drawer-overlay--open': open() }}
        onClick={props.onClose}
      />

      {/* Drawer */}
      <div class="drawer" classList={{ 'drawer--open': open() }}>
        <Show when={m()}>
          {/* Header */}
          <div class="drawer__header">
            <div class="drawer__title-row">
              <h3 class="drawer__title">Request {m().id?.slice(0, 12)}</h3>
              <button class="drawer__close" onClick={props.onClose} aria-label="Close">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>
            <div class="drawer__meta-row">
              <span class={`drawer-status ${statusClass(m().status)}`}>
                {statusLabel(m().status)}
              </span>
              <span class="drawer__meta-sep">&middot;</span>
              <span class="drawer__meta-text">{m().provider}</span>
              <span class="drawer__meta-sep">&middot;</span>
              <span class="drawer__meta-text">{m().model || m().model_id}</span>
              <span class="drawer__meta-sep">&middot;</span>
              <span class="drawer__meta-text">{fmtDate(m().timestamp)}</span>
            </div>
          </div>

          {/* Tabs */}
          <div class="drawer__tabs">
            <For each={TABS}>
              {(t) => (
                <button
                  class="drawer__tab"
                  classList={{ 'drawer__tab--active': tab() === t.value }}
                  onClick={() => setTab(t.value)}
                >
                  {t.label}
                </button>
              )}
            </For>
          </div>

          {/* Tab content */}
          <div class="drawer__body">
            {/* Events tab */}
            <Show when={tab() === 'events'}>
              <div class="drawer-events">
                {/* Fallback event */}
                <Show when={m().fallback_from_model}>
                  <div class="drawer-event">
                    <div class="drawer-event__badge drawer-event__badge--fallback">fallback</div>
                    <div class="drawer-event__text">
                      Attempt #{m().fallback_index ?? 2}: triggered by a fallback from{' '}
                      <strong>{m().fallback_from_model}</strong>
                    </div>
                  </div>
                  <div class="drawer-event__arrow">
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </div>
                </Show>

                {/* Error event */}
                <Show when={m().error_message}>
                  <div class="drawer-event">
                    <div class="drawer-event__badge drawer-event__badge--error">error</div>
                    <div class="drawer-event__error-msg">{m().error_message}</div>
                    <Show when={m().error_origin || m().error_class}>
                      <div class="drawer-event__details">
                        <Show when={m().error_origin}>
                          <div class="drawer-event__kv">
                            <span class="drawer-event__key">Origin</span>
                            <span>{m().error_origin}</span>
                          </div>
                        </Show>
                        <Show when={m().error_class}>
                          <div class="drawer-event__kv">
                            <span class="drawer-event__key">Type</span>
                            <span>{m().error_class}</span>
                          </div>
                        </Show>
                        <Show when={m().error_http_status}>
                          <div class="drawer-event__kv">
                            <span class="drawer-event__key">HTTP status</span>
                            <span>{m().error_http_status}</span>
                          </div>
                        </Show>
                      </div>
                    </Show>
                  </div>
                  <Show when={m().autofix_applied}>
                    <div class="drawer-event__arrow">
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </div>
                  </Show>
                </Show>

                {/* Auto-fix event */}
                <Show when={m().autofix_applied}>
                  <div class="drawer-event">
                    <div class="drawer-event__badge drawer-event__badge--autofix">auto-fix</div>
                    <AutofixSection
                      role={m().autofix_role}
                      operations={m().autofix_operations}
                      phoenix={
                        m().autofix_phoenix
                          ? {
                              issueId: m().autofix_phoenix.issueId,
                              patchId: m().autofix_phoenix.patchId,
                              healAttemptId: m().autofix_phoenix.healAttemptId,
                              explanation: m().autofix_phoenix.explanation,
                            }
                          : null
                      }
                      sibling={m().autofix_sibling}
                      onOpenMessage={props.onOpenMessage}
                    />
                  </div>
                </Show>

                {/* No events */}
                <Show when={!m().fallback_from_model && !m().error_message && !m().autofix_applied}>
                  <p class="drawer-events__empty">No events — request completed successfully.</p>
                </Show>
              </div>
            </Show>

            {/* Metadata tab */}
            <Show when={tab() === 'metadata'}>
              <div class="drawer-metadata">
                <div class="drawer-kv">
                  <span class="drawer-kv__key">ID</span>
                  <span>{m().id}</span>
                </div>
                <div class="drawer-kv">
                  <span class="drawer-kv__key">Status</span>
                  <span>{statusLabel(m().status)}</span>
                </div>
                <div class="drawer-kv">
                  <span class="drawer-kv__key">Provider</span>
                  <span>{m().provider}</span>
                </div>
                <Show when={m().auth_type}>
                  <div class="drawer-kv">
                    <span class="drawer-kv__key">Auth</span>
                    <span>{m().auth_type}</span>
                  </div>
                </Show>
                <Show when={m().provider_key_label}>
                  <div class="drawer-kv">
                    <span class="drawer-kv__key">API Key</span>
                    <span>{m().provider_key_label}</span>
                  </div>
                </Show>
                <div class="drawer-kv">
                  <span class="drawer-kv__key">Model</span>
                  <span>{m().model || m().model_id}</span>
                </div>
                <Show when={m().model_id && m().model_id !== m().model}>
                  <div class="drawer-kv">
                    <span class="drawer-kv__key">Model ID</span>
                    <span>{m().model_id}</span>
                  </div>
                </Show>
                <Show when={m().trace_id}>
                  <div class="drawer-kv">
                    <span class="drawer-kv__key">Trace ID</span>
                    <span>{m().trace_id}</span>
                  </div>
                </Show>
                <Show when={m().routing_tier}>
                  <div class="drawer-kv">
                    <span class="drawer-kv__key">Routing tier</span>
                    <span>{m().routing_tier}</span>
                  </div>
                </Show>
                <Show when={m().routing_reason}>
                  <div class="drawer-kv">
                    <span class="drawer-kv__key">Reason</span>
                    <span>{m().routing_reason}</span>
                  </div>
                </Show>
                <Show when={m().service_type}>
                  <div class="drawer-kv">
                    <span class="drawer-kv__key">Service type</span>
                    <span>{m().service_type}</span>
                  </div>
                </Show>
                <Show when={m().session_key}>
                  <div class="drawer-kv">
                    <span class="drawer-kv__key">Session</span>
                    <span>{m().session_key}</span>
                  </div>
                </Show>
                <Show when={m().description}>
                  <div class="drawer-kv">
                    <span class="drawer-kv__key">Description</span>
                    <span>{m().description}</span>
                  </div>
                </Show>
                <Show when={m().duration_ms != null}>
                  <div class="drawer-kv">
                    <span class="drawer-kv__key">Duration</span>
                    <span>{m().duration_ms}ms</span>
                  </div>
                </Show>
                <Show when={m().cost != null}>
                  <div class="drawer-kv">
                    <span class="drawer-kv__key">Cost</span>
                    <span>${m().cost?.toFixed(4)}</span>
                  </div>
                </Show>
                <div class="drawer-kv">
                  <span class="drawer-kv__key">Input tokens</span>
                  <span>{m().input_tokens?.toLocaleString()}</span>
                </div>
                <div class="drawer-kv">
                  <span class="drawer-kv__key">Output tokens</span>
                  <span>{m().output_tokens?.toLocaleString()}</span>
                </div>
              </div>
            </Show>

            {/* Headers tab */}
            <Show when={tab() === 'headers'}>
              <Show
                when={m().request_headers && Object.keys(m().request_headers).length > 0}
                fallback={<p class="drawer-events__empty">No request headers available.</p>}
              >
                <RequestHeadersSection headers={m().request_headers} />
              </Show>
            </Show>

            {/* Params tab */}
            <Show when={tab() === 'params'}>
              <Show
                when={m().request_params && Object.keys(m().request_params).length > 0}
                fallback={<p class="drawer-events__empty">No model params available.</p>}
              >
                <ModelParamsSection params={m().request_params} />
              </Show>
            </Show>
          </div>
        </Show>

        {/* Loading state */}
        <Show when={!m() && open()}>
          <div
            class="drawer__body"
            style="display: flex; align-items: center; justify-content: center; height: 200px; color: hsl(var(--muted-foreground));"
          >
            Loading...
          </div>
        </Show>
      </div>
    </>
  );
};

export default RequestDrawer;
