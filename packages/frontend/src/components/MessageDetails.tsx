import { createResource, Show, For, type JSX } from 'solid-js';
import {
  getMessageDetails,
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
                    (attempt #{(m.fallback_index ?? 0) + 1})
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
                  <MetaField label="Model" value={m.model ? getModelDisplayName(m.model) : null} />
                  <MetaField label="Model ID" value={m.model} />
                  <MetaField label="Provider" value={provider} />
                  <MetaField label="Trace" value={m.trace_id?.slice(0, 16)} />
                  <MetaField label="Routing" value={m.routing_tier} />
                  <MetaField label="Reason" value={m.routing_reason} />
                  <MetaField label="Auth" value={m.auth_type} />
                  <MetaField label="Service" value={m.service_type} />
                  <MetaField label="Session" value={m.session_key} />
                  <MetaField label="Description" value={m.description} />
                  <MetaField label="Skill" value={m.skill_name} />
                </div>
              </div>

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
                          <th>Duration</th>
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
                          <th>Duration</th>
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
