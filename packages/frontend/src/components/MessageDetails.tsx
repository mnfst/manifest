import { createResource, createSignal, Show, For, type JSX } from 'solid-js';
import {
  getMessageDetails,
  flagMessageMiscategorized,
  clearMessageMiscategorized,
  type MessageDetailLlmCall,
  type MessageDetailToolExecution,
  type MessageDetailLog,
} from '../services/api.js';
import { formatDuration, formatTime, formatNumber } from '../services/formatters.js';
import { inferProviderName } from '../services/routing-utils.js';
import { getModelDisplayName } from '../services/model-display.js';

export interface MessageDetailsProps {
  messageId: string;
}

function SeverityDot(props: { severity: string }): JSX.Element {
  const color = () => {
    switch (props.severity) {
      case 'error':
        return 'hsl(var(--destructive))';
      case 'warn':
        return 'hsl(var(--chart-5))';
      default:
        return 'hsl(var(--muted-foreground))';
    }
  };
  return (
    <span class="msg-detail__severity-dot" style={{ background: color() }} title={props.severity} />
  );
}

function LlmCallRow(props: { call: MessageDetailLlmCall }): JSX.Element {
  const c = props.call;
  return (
    <tr>
      <td class="msg-detail__mono-xs">{c.call_index ?? '\u2014'}</td>
      <td class="msg-detail__mono-xs">{c.request_model ?? '\u2014'}</td>
      <td class="msg-detail__mono-xs">{c.response_model ?? '\u2014'}</td>
      <td class="msg-detail__mono">{formatNumber(c.input_tokens)}</td>
      <td class="msg-detail__mono">{formatNumber(c.output_tokens)}</td>
      <td class="msg-detail__mono-xs">
        {c.duration_ms != null ? formatDuration(c.duration_ms) : '\u2014'}
      </td>
      <td class="msg-detail__mono-xs">{c.ttft_ms != null ? `${c.ttft_ms}ms` : '\u2014'}</td>
    </tr>
  );
}

function ToolRow(props: { tool: MessageDetailToolExecution }): JSX.Element {
  const t = props.tool;
  return (
    <tr>
      <td class="msg-detail__mono-xs">{t.tool_name}</td>
      <td class="msg-detail__mono-xs">
        {t.duration_ms != null ? formatDuration(t.duration_ms) : '\u2014'}
      </td>
      <td>
        <span class={`status-badge status-badge--${t.status}`}>{t.status}</span>
      </td>
      <td
        class="msg-detail__mono-xs"
        style="max-width: 300px; overflow: hidden; text-overflow: ellipsis;"
      >
        {t.error_message ?? '\u2014'}
      </td>
    </tr>
  );
}

function LogRow(props: { log: MessageDetailLog }): JSX.Element {
  const l = props.log;
  return (
    <tr>
      <td class="msg-detail__mono-xs" style="white-space: nowrap;">
        {formatTime(l.timestamp)}
      </td>
      <td>
        <SeverityDot severity={l.severity} />
        <span class="msg-detail__mono-xs" style="margin-left: 6px;">
          {l.severity}
        </span>
      </td>
      <td class="msg-detail__mono-xs msg-detail__log-body">{l.body ?? '\u2014'}</td>
    </tr>
  );
}

function RequestHeadersSection(props: { headers: Record<string, string> }): JSX.Element {
  const [open, setOpen] = createSignal(false);
  const entries = (): Array<[string, string]> =>
    Object.entries(props.headers).sort(([a], [b]) => a.localeCompare(b));
  const tableId = `msg-detail-request-headers-${Math.random().toString(36).slice(2, 10)}`;
  return (
    <div class="msg-detail__section">
      <button
        type="button"
        class="msg-detail__section-title msg-detail__section-title--toggle"
        aria-expanded={open() ? 'true' : 'false'}
        aria-controls={tableId}
        onClick={() => setOpen((v) => !v)}
      >
        <span
          class="msg-detail__chevron"
          classList={{ 'msg-detail__chevron--open': open() }}
          aria-hidden="true"
        >
          &#9656;
        </span>
        Request Headers
        <span class="msg-detail__count">{entries().length}</span>
      </button>
      <Show when={open()}>
        <div class="data-table-scroll" id={tableId}>
          <table class="data-table msg-detail__table">
            <thead>
              <tr>
                <th>Header</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              <For each={entries()}>
                {([k, v]) => (
                  <tr>
                    <td class="msg-detail__mono-xs">{k}</td>
                    <td class="msg-detail__mono-xs msg-detail__log-body">{v}</td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </Show>
    </div>
  );
}

function MetaField(props: { label: string; value: string | null | undefined }): JSX.Element {
  return (
    <Show when={props.value}>
      <span class="msg-detail__meta-item">
        <span class="msg-detail__meta-label">{props.label}</span>
        {props.value}
      </span>
    </Show>
  );
}

function MiscategorizeControl(props: {
  messageId: string;
  initiallyFlagged: boolean;
}): JSX.Element {
  const [flagged, setFlagged] = createSignal(props.initiallyFlagged);
  const [busy, setBusy] = createSignal(false);

  async function toggle() {
    // Belt-and-suspenders: `disabled={busy()}` on the button already rejects
    // real clicks during an in-flight request. This guard catches the narrow
    // race where Solid's event delegation could fire the handler before the
    // disabled attribute commits, and tests can't reliably reproduce it.
    /* v8 ignore next */
    if (busy()) return;
    setBusy(true);
    try {
      if (flagged()) {
        await clearMessageMiscategorized(props.messageId);
        setFlagged(false);
      } else {
        await flagMessageMiscategorized(props.messageId);
        setFlagged(true);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      class="msg-detail__miscat-btn"
      onClick={toggle}
      disabled={busy()}
      title="Flag this message's routing category as wrong. Repeated flags reduce this category's routing score for this agent."
      aria-pressed={flagged()}
    >
      {flagged() ? 'Flagged as miscategorized — undo' : 'Wrong category?'}
    </button>
  );
}

export default function MessageDetails(props: MessageDetailsProps): JSX.Element {
  const [data] = createResource(() => props.messageId, getMessageDetails);

  return (
    <div class="msg-detail">
      <Show when={data.loading && !data.error}>
        <div class="msg-detail__loader">
          <div class="msg-detail__spinner" />
          <span>Loading details...</span>
        </div>
      </Show>
      <Show when={data.error}>
        <div class="msg-detail__error">Failed to load details</div>
      </Show>
      <Show when={!data.error && data() && !data.loading}>
        {(() => {
          const d = data()!;
          const m = d.message;
          const provider = m.model ? inferProviderName(m.model) : null;
          return (
            <>
              <Show when={m.error_message}>
                <div class="msg-detail__section">
                  <div class="msg-detail__section-title">Error</div>
                  <div class="msg-detail__error-box">{m.error_message}</div>
                </div>
              </Show>

              <Show when={m.fallback_from_model}>
                <div class="msg-detail__fallback-banner">
                  Fallback from <strong>{m.fallback_from_model}</strong>
                  <Show when={m.fallback_index != null}>
                    {' '}
                    {/* Show guard above ensures fallback_index is non-null here. */}
                    (attempt #{(m.fallback_index as number) + 1})
                  </Show>
                </div>
              </Show>

              <div class="msg-detail__section">
                <div class="msg-detail__section-title">Message</div>
                <div class="msg-detail__meta">
                  <span class="msg-detail__meta-item">
                    <span class="msg-detail__meta-label">Status</span>
                    <span class={`status-badge status-badge--${m.status}`}>{m.status}</span>
                  </span>
                  <MetaField label="ID" value={m.id} />
                  <MetaField label="Provider" value={provider} />
                  <MetaField label="Auth" value={m.auth_type} />
                  <MetaField label="Model" value={m.model ? getModelDisplayName(m.model) : null} />
                  <MetaField label="Model ID" value={m.model} />
                  <MetaField label="Trace" value={m.trace_id?.slice(0, 16)} />
                  <MetaField
                    label="Routing"
                    value={
                      m.header_tier_name ??
                      (m.specificity_category
                        ? m.specificity_category.replace(/_/g, ' ')
                        : m.routing_tier)
                    }
                  />
                  <Show when={m.specificity_category}>
                    <MiscategorizeControl
                      messageId={m.id}
                      initiallyFlagged={m.specificity_miscategorized}
                    />
                  </Show>
                  <MetaField label="Reason" value={m.routing_reason} />
                  <MetaField label="Service" value={m.service_type} />
                  <MetaField label="Session" value={m.session_key} />
                  <MetaField label="Description" value={m.description} />
                  <MetaField label="App" value={m.caller_attribution?.appName} />
                  <MetaField label="SDK" value={m.caller_attribution?.sdk} />
                  <MetaField label="Skill" value={m.skill_name} />
                </div>
              </div>

              <Show when={m.request_headers && Object.keys(m.request_headers).length > 0}>
                <RequestHeadersSection headers={m.request_headers!} />
              </Show>

              <Show when={d.llm_calls.length > 0}>
                <div class="msg-detail__section">
                  <div class="msg-detail__section-title">
                    LLM Calls
                    <span class="msg-detail__count">{d.llm_calls.length}</span>
                  </div>
                  <div class="data-table-scroll">
                    <table class="data-table msg-detail__table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Request Model</th>
                          <th>Response Model</th>
                          <th>Input</th>
                          <th>Output</th>
                          <th>Latency</th>
                          <th>TTFT</th>
                        </tr>
                      </thead>
                      <tbody>
                        <For each={d.llm_calls}>{(call) => <LlmCallRow call={call} />}</For>
                      </tbody>
                    </table>
                  </div>
                </div>
              </Show>

              <Show when={d.tool_executions.length > 0}>
                <div class="msg-detail__section">
                  <div class="msg-detail__section-title">
                    Tool Executions
                    <span class="msg-detail__count">{d.tool_executions.length}</span>
                  </div>
                  <div class="data-table-scroll">
                    <table class="data-table msg-detail__table">
                      <thead>
                        <tr>
                          <th>Tool</th>
                          <th>Latency</th>
                          <th>Status</th>
                          <th>Error</th>
                        </tr>
                      </thead>
                      <tbody>
                        <For each={d.tool_executions}>{(tool) => <ToolRow tool={tool} />}</For>
                      </tbody>
                    </table>
                  </div>
                </div>
              </Show>

              <Show when={d.agent_logs.length > 0}>
                <div class="msg-detail__section">
                  <div class="msg-detail__section-title">
                    Agent Logs
                    <span class="msg-detail__count">{d.agent_logs.length}</span>
                  </div>
                  <div class="data-table-scroll">
                    <table class="data-table msg-detail__table">
                      <thead>
                        <tr>
                          <th>Time</th>
                          <th>Severity</th>
                          <th>Message</th>
                        </tr>
                      </thead>
                      <tbody>
                        <For each={d.agent_logs}>{(log) => <LogRow log={log} />}</For>
                      </tbody>
                    </table>
                  </div>
                </div>
              </Show>
            </>
          );
        })()}
      </Show>
    </div>
  );
}
