import {
  createSignal,
  createResource,
  createMemo,
  Show,
  For,
  onCleanup,
  type Component,
} from 'solid-js';
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
    () => (props.messageId ? props.messageId : false),
    (id) => getMessageDetails(id as string),
  );

  // The API returns { message: { ...fields } }
  const m = () => {
    const raw = data();
    if (!raw) return null;
    return (raw as any).message ?? raw;
  };

  // Dynamic tabs — only show headers/params when data exists
  const visibleTabs = createMemo(() => {
    const msg = m();
    const tabs: Array<{ value: DrawerTab; label: string }> = [
      { value: 'events', label: 'Request events' },
      { value: 'metadata', label: 'Metadata' },
    ];
    if (msg?.request_headers && Object.keys(msg.request_headers).length > 0) {
      tabs.push({ value: 'headers', label: 'Request headers' });
    }
    if (msg?.request_params && Object.keys(msg.request_params).length > 0) {
      tabs.push({ value: 'params', label: 'Model params' });
    }
    return tabs;
  });

  // Close on Escape
  if (typeof document !== 'undefined') {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open()) props.onClose();
    };
    document.addEventListener('keydown', handler);
    onCleanup(() => document.removeEventListener('keydown', handler));
  }

  return (
    <>
      <div class="drawer" classList={{ 'drawer--open': open() }}>
        <Show when={m()}>
          {(msg) => (
            <>
              {/* Header */}
              <div class="drawer__header">
                <div class="drawer__title-row">
                  <h3 class="drawer__title">Request {msg().id?.slice(0, 12)}</h3>
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
                  <span class={`drawer-status ${statusClass(msg().status)}`}>
                    {statusLabel(msg().status)}
                  </span>
                  <Show when={msg().provider}>
                    <span class="drawer__meta-sep">&middot;</span>
                    <span class="drawer__meta-text">{msg().provider}</span>
                  </Show>
                  <Show when={msg().model || msg().model_id}>
                    <span class="drawer__meta-sep">&middot;</span>
                    <span class="drawer__meta-text">{msg().model || msg().model_id}</span>
                  </Show>
                  <Show when={msg().timestamp}>
                    <span class="drawer__meta-sep">&middot;</span>
                    <span class="drawer__meta-text">{fmtDate(msg().timestamp)}</span>
                  </Show>
                </div>
              </div>

              {/* Tabs — using panel__tabs design system, full width in drawer */}
              <div class="panel__tabs drawer__tabs-full" role="tablist">
                <For each={visibleTabs()}>
                  {(t) => (
                    <button
                      class="panel__tab"
                      classList={{ 'panel__tab--active': tab() === t.value }}
                      role="tab"
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
                    <Show when={msg().fallback_from_model}>
                      <div class="drawer-event">
                        <div class="drawer-event__badge drawer-event__badge--fallback">
                          fallback
                        </div>
                        <div class="drawer-event__text">
                          Attempt #{msg().fallback_index ?? 2}: triggered by a fallback from{' '}
                          <strong>{msg().fallback_from_model}</strong>
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

                    <Show when={msg().error_message}>
                      <div class="drawer-event">
                        <div class="drawer-event__badge drawer-event__badge--error">error</div>
                        <div class="drawer-event__error-msg">{msg().error_message}</div>
                        <Show when={msg().error_origin || msg().error_class}>
                          <div class="drawer-event__details">
                            <Show when={msg().error_origin}>
                              <div class="drawer-event__kv">
                                <span class="drawer-event__key">Origin</span>
                                <span>{msg().error_origin}</span>
                              </div>
                            </Show>
                            <Show when={msg().error_class}>
                              <div class="drawer-event__kv">
                                <span class="drawer-event__key">Type</span>
                                <span>{msg().error_class}</span>
                              </div>
                            </Show>
                            <Show when={msg().error_http_status}>
                              <div class="drawer-event__kv">
                                <span class="drawer-event__key">HTTP status</span>
                                <span>{msg().error_http_status}</span>
                              </div>
                            </Show>
                          </div>
                        </Show>
                      </div>
                      <Show when={msg().autofix_applied}>
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

                    <Show when={msg().autofix_applied}>
                      <div class="drawer-event">
                        <div class="drawer-event__badge drawer-event__badge--autofix">auto-fix</div>
                        <AutofixSection
                          role={msg().autofix_role}
                          operations={msg().autofix_operations}
                          phoenix={
                            msg().autofix_phoenix
                              ? {
                                  issueId: msg().autofix_phoenix.issueId,
                                  patchId: msg().autofix_phoenix.patchId,
                                  healAttemptId: msg().autofix_phoenix.healAttemptId,
                                  explanation: msg().autofix_phoenix.explanation,
                                }
                              : null
                          }
                          sibling={msg().autofix_sibling}
                          onOpenMessage={props.onOpenMessage}
                        />
                      </div>
                    </Show>

                    <Show
                      when={
                        !msg().fallback_from_model && !msg().error_message && !msg().autofix_applied
                      }
                    >
                      <p class="drawer-events__empty">
                        No events — request completed successfully.
                      </p>
                    </Show>
                  </div>
                </Show>

                {/* Metadata tab */}
                <Show when={tab() === 'metadata'}>
                  <div class="drawer-metadata">
                    <div class="drawer-kv">
                      <span class="drawer-kv__key">ID</span>
                      <span>{msg().id}</span>
                    </div>
                    <div class="drawer-kv">
                      <span class="drawer-kv__key">Status</span>
                      <span>{statusLabel(msg().status)}</span>
                    </div>
                    <div class="drawer-kv">
                      <span class="drawer-kv__key">Provider</span>
                      <span>{msg().provider}</span>
                    </div>
                    <Show when={msg().auth_type}>
                      <div class="drawer-kv">
                        <span class="drawer-kv__key">Auth</span>
                        <span>{msg().auth_type}</span>
                      </div>
                    </Show>
                    <Show when={msg().provider_key_label}>
                      <div class="drawer-kv">
                        <span class="drawer-kv__key">API Key</span>
                        <span>{msg().provider_key_label}</span>
                      </div>
                    </Show>
                    <div class="drawer-kv">
                      <span class="drawer-kv__key">Model</span>
                      <span>{msg().model || msg().model_id}</span>
                    </div>
                    <Show when={msg().model_id && msg().model_id !== msg().model}>
                      <div class="drawer-kv">
                        <span class="drawer-kv__key">Model ID</span>
                        <span>{msg().model_id}</span>
                      </div>
                    </Show>
                    <Show when={msg().trace_id}>
                      <div class="drawer-kv">
                        <span class="drawer-kv__key">Trace ID</span>
                        <span>{msg().trace_id}</span>
                      </div>
                    </Show>
                    <Show when={msg().routing_tier}>
                      <div class="drawer-kv">
                        <span class="drawer-kv__key">Routing tier</span>
                        <span>{msg().routing_tier}</span>
                      </div>
                    </Show>
                    <Show when={msg().routing_reason}>
                      <div class="drawer-kv">
                        <span class="drawer-kv__key">Reason</span>
                        <span>{msg().routing_reason}</span>
                      </div>
                    </Show>
                    <Show when={msg().service_type}>
                      <div class="drawer-kv">
                        <span class="drawer-kv__key">Service type</span>
                        <span>{msg().service_type}</span>
                      </div>
                    </Show>
                    <Show when={msg().session_key}>
                      <div class="drawer-kv">
                        <span class="drawer-kv__key">Session</span>
                        <span>{msg().session_key}</span>
                      </div>
                    </Show>
                    <Show when={msg().description}>
                      <div class="drawer-kv">
                        <span class="drawer-kv__key">Description</span>
                        <span>{msg().description}</span>
                      </div>
                    </Show>
                    <Show when={msg().duration_ms != null}>
                      <div class="drawer-kv">
                        <span class="drawer-kv__key">Duration</span>
                        <span>{msg().duration_ms}ms</span>
                      </div>
                    </Show>
                    <Show when={msg().cost != null}>
                      <div class="drawer-kv">
                        <span class="drawer-kv__key">Cost</span>
                        <span>${msg().cost?.toFixed(4)}</span>
                      </div>
                    </Show>
                    <div class="drawer-kv">
                      <span class="drawer-kv__key">Input tokens</span>
                      <span>{msg().input_tokens?.toLocaleString()}</span>
                    </div>
                    <div class="drawer-kv">
                      <span class="drawer-kv__key">Output tokens</span>
                      <span>{msg().output_tokens?.toLocaleString()}</span>
                    </div>
                  </div>
                </Show>

                {/* Headers tab */}
                <Show when={tab() === 'headers' && msg().request_headers}>
                  <RequestHeadersSection headers={msg().request_headers} />
                </Show>

                {/* Params tab */}
                <Show when={tab() === 'params' && msg().request_params}>
                  <ModelParamsSection params={msg().request_params} />
                </Show>
              </div>
            </>
          )}
        </Show>

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
