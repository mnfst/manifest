import {
  createSignal,
  createResource,
  createMemo,
  createEffect,
  Show,
  For,
  onCleanup,
  type Component,
} from 'solid-js';
import { getMessageDetails } from '../services/api/messages.js';
import { formatParamValue } from './MessageDetailsSections.jsx';
import { providerIcon } from './ProviderIcon.jsx';
import { authBadgeFor } from './AuthBadge.js';
import '../styles/request-drawer.css';

export interface RequestDrawerProps {
  messageId: string | null;
  onClose: () => void;
  onOpenMessage?: (id: string) => void;
}

type AttemptTab = 'details' | 'headers' | 'params';

interface Attempt {
  id: string;
  index: number;
  type: 'initial' | 'fallback' | 'auto-fix';
  status: string;
  provider: string;
  model: string;
  auth_type: string;
  error_message?: string;
  error_origin?: string;
  error_class?: string;
  error_http_status?: number;
  model_id?: string;
  trace_id?: string;
  routing_tier?: string;
  routing_reason?: string;
  service_type?: string;
  session_key?: string;
  description?: string;
  duration_ms?: number;
  cost?: number;
  input_tokens?: number;
  output_tokens?: number;
  request_headers?: Record<string, string>;
  request_params?: Record<string, unknown>;
  autofix_applied?: boolean;
  autofix_operations?: any;
  autofix_phoenix?: any;
  autofix_role?: string;
  autofix_sibling?: any;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const mon = d.toLocaleString('en-US', { month: 'short' });
  const day = d.getDate();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${mon} ${day}, ${hh}:${mm}:${ss}`;
}

function statusLabel(status: string): string {
  if (status === 'ok') return 'Success';
  if (status === 'auto_fixed') return 'Auto-fixed';
  if (status === 'rate_limited') return 'Rate limited';
  return 'Failed';
}

function statusDotClass(status: string): string {
  if (status === 'ok') return 'attempt-dot--ok';
  if (status === 'auto_fixed') return 'attempt-dot--autofix';
  return 'attempt-dot--error';
}

function requestStatusClass(status: string): string {
  if (status === 'ok') return 'drawer-status--success';
  return 'drawer-status--error';
}

function buildAttempts(msg: any): Attempt[] {
  const attempts: Attempt[] = [];
  const base: Omit<Attempt, 'index' | 'type'> = {
    id: msg.id,
    status: msg.status,
    provider: msg.provider,
    model: msg.model || msg.model_id,
    auth_type: msg.auth_type,
    error_message: msg.error_message,
    error_origin: msg.error_origin,
    error_class: msg.error_class,
    error_http_status: msg.error_http_status,
    model_id: msg.model_id,
    trace_id: msg.trace_id,
    routing_tier: msg.routing_tier,
    routing_reason: msg.routing_reason,
    service_type: msg.service_type,
    session_key: msg.session_key,
    description: msg.description,
    duration_ms: msg.duration_ms,
    cost: msg.cost,
    input_tokens: msg.input_tokens,
    output_tokens: msg.output_tokens,
    request_headers: msg.request_headers,
    request_params: msg.request_params,
    autofix_applied: msg.autofix_applied,
    autofix_operations: msg.autofix_operations,
    autofix_phoenix: msg.autofix_phoenix,
    autofix_role: msg.autofix_role,
    autofix_sibling: msg.autofix_sibling,
  };

  let type: Attempt['type'] = 'initial';
  if (msg.fallback_from_model) type = 'fallback';
  if (msg.autofix_role === 'retry') type = 'auto-fix';

  attempts.push({ ...base, index: 1, type });
  return attempts;
}

const RequestDrawer: Component<RequestDrawerProps> = (props) => {
  const [selectedAttempt, setSelectedAttempt] = createSignal(0);
  const [tab, setTab] = createSignal<AttemptTab>('details');
  const open = () => props.messageId !== null;

  const [data] = createResource(
    () => (props.messageId ? props.messageId : false),
    (id) => getMessageDetails(id as string),
  );

  const m = () => {
    const raw = data();
    if (!raw) return null;
    return (raw as any).message ?? raw;
  };

  const attempts = createMemo(() => {
    const msg = m();
    if (!msg) return [];
    return buildAttempts(msg);
  });

  const currentAttempt = () => attempts()[selectedAttempt()] ?? null;

  const visibleTabs = createMemo(() => {
    const att = currentAttempt();
    const tabs: Array<{ value: AttemptTab; label: string }> = [
      { value: 'details', label: 'Details' },
    ];
    if (att?.request_headers && Object.keys(att.request_headers).length > 0) {
      tabs.push({ value: 'headers', label: 'Request headers' });
    }
    if (att?.request_params && Object.keys(att.request_params).length > 0) {
      tabs.push({ value: 'params', label: 'Model params' });
    }
    return tabs;
  });

  // Reset attempt + tab when message changes
  createEffect(() => {
    if (props.messageId) {
      setSelectedAttempt(0);
      setTab('details');
    }
  });

  // Reset tab if current tab disappears
  createEffect(() => {
    const tabs = visibleTabs();
    if (tabs.length > 0 && !tabs.some((t) => t.value === tab())) {
      setTab(tabs[0]!.value);
    }
  });

  // Close on Escape
  if (typeof document !== 'undefined') {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open()) props.onClose();
    };
    document.addEventListener('keydown', handler);
    onCleanup(() => document.removeEventListener('keydown', handler));
  }

  // Request-level badges
  const hasFallback = () => m()?.fallback_from_model || m()?.fallback_index;
  const hasAutofix = () => m()?.autofix_applied;
  const requestStatus = () => {
    const msg = m();
    if (!msg) return 'error';
    if (msg.autofix_role === 'retry' && msg.status === 'ok') return 'ok';
    return msg.status;
  };

  return (
    <>
      <div class="drawer" classList={{ 'drawer--open': open() }}>
        <Show when={m()}>
          {(msg) => (
            <>
              {/* ── Request header (full width) ── */}
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
                  <span class={`drawer-status ${requestStatusClass(requestStatus())}`}>
                    {statusLabel(requestStatus())}
                  </span>
                  <Show when={msg().provider}>
                    <span class="drawer__meta-sep">&middot;</span>
                    <span
                      class="drawer__meta-text"
                      style="display: inline-flex; align-items: center; gap: 4px;"
                    >
                      <span style="display: inline-flex; position: relative; flex-shrink: 0; width: 14px; height: 14px;">
                        {providerIcon(msg().provider, 14)}
                        {authBadgeFor(msg().auth_type, 8)}
                      </span>
                      {msg().model || msg().model_id}
                    </span>
                  </Show>
                  <Show when={msg().timestamp}>
                    <span class="drawer__meta-sep">&middot;</span>
                    <span class="drawer__meta-text">{fmtDate(msg().timestamp)}</span>
                  </Show>
                  <Show when={hasFallback()}>
                    <span class="drawer__badge drawer__badge--fallback">fallback</span>
                  </Show>
                  <Show when={hasAutofix()}>
                    <span class="drawer__badge drawer__badge--autofix">auto-fix</span>
                  </Show>
                </div>
              </div>

              {/* ── Body: sidebar + content ── */}
              <div class="drawer__split">
                {/* Attempts sidebar */}
                <div class="drawer__sidebar">
                  <div class="drawer__sidebar-title">Attempts</div>
                  <For each={attempts()}>
                    {(att, idx) => (
                      <button
                        class="attempt-item"
                        classList={{ 'attempt-item--active': selectedAttempt() === idx() }}
                        onClick={() => {
                          setSelectedAttempt(idx());
                          setTab('details');
                        }}
                      >
                        <span class={`attempt-dot ${statusDotClass(att.status)}`} />
                        <div class="attempt-item__info">
                          <span class="attempt-item__num">#{att.index}</span>
                          <span class="attempt-item__provider">{att.provider}</span>
                          <span class="attempt-item__model">{att.model}</span>
                          <Show when={att.type === 'fallback'}>
                            <span class="attempt-item__badge attempt-item__badge--fallback">
                              fallback
                            </span>
                          </Show>
                          <Show when={att.type === 'auto-fix'}>
                            <span class="attempt-item__badge attempt-item__badge--autofix">
                              auto-fix
                            </span>
                          </Show>
                        </div>
                      </button>
                    )}
                  </For>
                  <Show when={attempts().length === 0}>
                    <div class="attempt-item__empty">No provider contacted</div>
                  </Show>
                </div>

                {/* Attempt content */}
                <div class="drawer__content">
                  <Show
                    when={currentAttempt()}
                    fallback={
                      <div class="drawer__content-empty">
                        <Show when={msg().error_message}>
                          <div
                            class="drawer-event__badge drawer-event__badge--error"
                            style="margin-bottom: 8px;"
                          >
                            rejected
                          </div>
                          <div style="font-size: var(--font-size-sm); color: hsl(var(--destructive)); font-family: var(--font-mono, monospace); word-break: break-word; margin-bottom: 12px;">
                            {msg().error_message}
                          </div>
                          <p style="font-size: var(--font-size-xs); color: hsl(var(--muted-foreground));">
                            Manifest rejected this request before contacting a provider.
                          </p>
                        </Show>
                      </div>
                    }
                  >
                    {(att) => (
                      <>
                        {/* Tabs */}
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

                        <div class="drawer__body">
                          {/* Details tab */}
                          <Show when={tab() === 'details'}>
                            <div class="drawer-metadata">
                              <div class="drawer-kv">
                                <span class="drawer-kv__key">Status</span>
                                <span>{statusLabel(att().status)}</span>
                              </div>
                              <div class="drawer-kv">
                                <span class="drawer-kv__key">Type</span>
                                <span style="text-transform: capitalize;">{att().type}</span>
                              </div>
                              <div class="drawer-kv">
                                <span class="drawer-kv__key">Provider</span>
                                <span>{att().provider}</span>
                              </div>
                              <Show when={att().auth_type}>
                                <div class="drawer-kv">
                                  <span class="drawer-kv__key">Auth</span>
                                  <span>{att().auth_type}</span>
                                </div>
                              </Show>
                              <div class="drawer-kv">
                                <span class="drawer-kv__key">Model</span>
                                <span>{att().model}</span>
                              </div>
                              <Show when={att().model_id && att().model_id !== att().model}>
                                <div class="drawer-kv">
                                  <span class="drawer-kv__key">Model ID</span>
                                  <span>{att().model_id}</span>
                                </div>
                              </Show>
                              <Show when={att().trace_id}>
                                <div class="drawer-kv">
                                  <span class="drawer-kv__key">Trace ID</span>
                                  <span>{att().trace_id}</span>
                                </div>
                              </Show>
                              <Show when={att().routing_tier}>
                                <div class="drawer-kv">
                                  <span class="drawer-kv__key">Routing tier</span>
                                  <span>{att().routing_tier}</span>
                                </div>
                              </Show>
                              <Show when={att().routing_reason}>
                                <div class="drawer-kv">
                                  <span class="drawer-kv__key">Reason</span>
                                  <span>{att().routing_reason}</span>
                                </div>
                              </Show>
                              <Show when={att().service_type}>
                                <div class="drawer-kv">
                                  <span class="drawer-kv__key">Service type</span>
                                  <span>{att().service_type}</span>
                                </div>
                              </Show>
                              <Show when={att().session_key}>
                                <div class="drawer-kv">
                                  <span class="drawer-kv__key">Session</span>
                                  <span>{att().session_key}</span>
                                </div>
                              </Show>
                              <Show when={att().duration_ms != null}>
                                <div class="drawer-kv">
                                  <span class="drawer-kv__key">Duration</span>
                                  <span>{att().duration_ms}ms</span>
                                </div>
                              </Show>
                              <Show when={att().cost != null}>
                                <div class="drawer-kv">
                                  <span class="drawer-kv__key">Cost</span>
                                  <span>${att().cost?.toFixed(4)}</span>
                                </div>
                              </Show>
                              <div class="drawer-kv">
                                <span class="drawer-kv__key">Input tokens</span>
                                <span>{att().input_tokens?.toLocaleString()}</span>
                              </div>
                              <div class="drawer-kv">
                                <span class="drawer-kv__key">Output tokens</span>
                                <span>{att().output_tokens?.toLocaleString()}</span>
                              </div>

                              {/* Error block if this attempt failed */}
                              <Show when={att().error_message}>
                                <div style="margin-top: 16px; padding: 12px 16px; background: hsl(var(--destructive) / 0.06); border: 1px solid hsl(var(--destructive) / 0.25); border-radius: var(--radius);">
                                  <div style="font-size: var(--font-size-xs); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; color: hsl(var(--foreground));">
                                    Error
                                  </div>
                                  <div style="font-size: var(--font-size-sm); color: hsl(var(--destructive)); font-family: var(--font-mono, monospace); word-break: break-word; margin-bottom: 8px;">
                                    {att().error_message}
                                  </div>
                                  <Show
                                    when={
                                      att().error_origin ||
                                      att().error_class ||
                                      att().error_http_status
                                    }
                                  >
                                    <table
                                      class="error-autofix-row__meta-table"
                                      style="border-color: hsl(var(--destructive) / 0.25);"
                                    >
                                      <tbody>
                                        <Show when={att().error_origin}>
                                          <tr>
                                            <td class="error-autofix-row__meta-label">Origin</td>
                                            <td>{att().error_origin}</td>
                                          </tr>
                                        </Show>
                                        <Show when={att().error_class}>
                                          <tr>
                                            <td class="error-autofix-row__meta-label">Type</td>
                                            <td>{att().error_class}</td>
                                          </tr>
                                        </Show>
                                        <Show when={att().error_http_status}>
                                          <tr>
                                            <td class="error-autofix-row__meta-label">
                                              HTTP status
                                            </td>
                                            <td>{att().error_http_status}</td>
                                          </tr>
                                        </Show>
                                      </tbody>
                                    </table>
                                  </Show>
                                </div>
                              </Show>

                              {/* Autofix block if this attempt was auto-fixed */}
                              <Show when={att().autofix_applied && att().autofix_operations}>
                                <div style="margin-top: 16px; padding: 12px 16px; background: hsl(222 47% 50% / 0.06); border: 1px solid hsl(222 47% 50% / 0.3); border-radius: var(--radius);">
                                  <div style="font-size: var(--font-size-xs); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; color: hsl(var(--foreground));">
                                    Auto-fix applied
                                  </div>
                                  <For each={att().autofix_operations as any[]}>
                                    {(op: any) => (
                                      <div style="font-size: var(--font-size-xs); color: hsl(var(--muted-foreground)); margin-bottom: 4px;">
                                        <strong>{op.type}</strong>
                                        {op.from ? `: ${op.from}` : ''}
                                        {op.to ? ` → ${op.to}` : ''}
                                      </div>
                                    )}
                                  </For>
                                </div>
                              </Show>
                            </div>
                          </Show>

                          {/* Headers tab */}
                          <Show when={tab() === 'headers' && att().request_headers}>
                            <div class="drawer-metadata">
                              <For
                                each={Object.entries(att().request_headers!).sort(([a], [b]) =>
                                  a.localeCompare(b),
                                )}
                              >
                                {([key, val]) => (
                                  <div class="drawer-kv">
                                    <span class="drawer-kv__key">{key}</span>
                                    <span style="word-break: break-all;">{String(val)}</span>
                                  </div>
                                )}
                              </For>
                            </div>
                          </Show>

                          {/* Params tab */}
                          <Show when={tab() === 'params' && att().request_params}>
                            <div class="drawer-metadata">
                              <For
                                each={Object.entries(att().request_params!).sort(([a], [b]) =>
                                  a.localeCompare(b),
                                )}
                              >
                                {([key, val]) => (
                                  <div class="drawer-kv">
                                    <span class="drawer-kv__key">{key}</span>
                                    <span style="word-break: break-all; font-family: var(--font-mono, monospace); font-size: var(--font-size-xs);">
                                      {formatParamValue(val)}
                                    </span>
                                  </div>
                                )}
                              </For>
                            </div>
                          </Show>
                        </div>
                      </>
                    )}
                  </Show>
                </div>
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
