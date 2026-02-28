import { createSignal, createResource, Show, For, type Component } from "solid-js";
import { A, useParams } from "@solidjs/router";
import { Title, Meta } from "@solidjs/meta";
import ErrorState from "../components/ErrorState.jsx";
import { getMessages } from "../services/api.js";
import { formatNumber, formatCost, formatTime, formatStatus } from "../services/formatters.js";
import { inferProviderFromModel, inferProviderName } from "../services/routing-utils.js";
import { providerIcon } from "../components/ProviderIcon.jsx";
import Select from "../components/Select.jsx";
import InfoTooltip from "../components/InfoTooltip.jsx";
import { isLocalMode } from "../services/local-mode.js";
import { pingCount } from "../services/sse.js";
import SetupModal from "../components/SetupModal.jsx";
import "../styles/overview.css";

interface MessageItem {
  id: string;
  timestamp: string;
  agent_name: string | null;
  model: string | null;
  routing_tier?: string;
  routing_reason?: string;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  status: string;
  cost: number | null;
}

interface MessagesData {
  items: MessageItem[];
  next_cursor: string | null;
  total_count: number;
  models: string[];
}

const MessageLog: Component = () => {
  const params = useParams<{ agentName: string }>();
  const [statusFilter, setStatusFilter] = createSignal("");
  const [modelFilter, setModelFilter] = createSignal("");
  const [costMin, setCostMin] = createSignal("");
  const [costMax, setCostMax] = createSignal("");
  const [setupOpen, setSetupOpen] = createSignal(false);
  const [setupCompleted] = createSignal(
    !!localStorage.getItem(`setup_completed_${params.agentName}`) ||
    (isLocalMode() === true && params.agentName === 'local-agent')
  );
  const [data, { refetch }] = createResource(
    () => ({ status: statusFilter(), model: modelFilter(), costMin: costMin(), costMax: costMax(), agentName: params.agentName, _ping: pingCount() }),
    (p) => {
      const q: Record<string, string> = {};
      if (p.status) q.status = p.status;
      if (p.model) q.model = p.model;
      if (p.costMin) q.cost_min = p.costMin;
      if (p.costMax) q.cost_max = p.costMax;
      if (p.agentName) q.agent_name = p.agentName;
      return getMessages(q) as Promise<MessagesData>;
    },
  );

  const hasNoData = () => {
    const d = data();
    return d && d.total_count === 0;
  };

  return (
    <div class="container--full">
      <Title>{decodeURIComponent(params.agentName)} Messages - Manifest</Title>
      <Meta name="description" content={`Browse all messages sent and received by ${decodeURIComponent(params.agentName)}. Filter by status, model, or cost.`} />
      <div class="page-header">
        <div>
          <h1>Messages</h1>
          <span class="breadcrumb">Full log of every LLM call &mdash; filter by status, model, or cost</span>
        </div>
        <div class="header-controls">
          <Show when={!hasNoData()}>
            <Select
              value={statusFilter()}
              onChange={setStatusFilter}
              options={[
                { label: "All statuses", value: "" },
                { label: "Successful", value: "ok" },
                { label: "Rate Limited", value: "rate_limited" },
                { label: "Retried", value: "retry" },
                { label: "Failed", value: "error" },
              ]}
            />
            <Select
              value={modelFilter()}
              onChange={setModelFilter}
              options={[
                { label: "All models", value: "" },
                ...(data()?.models ?? []).map((m) => ({ label: m, value: m })),
              ]}
            />
            <div class="cost-range-filter">
              <input
                type="number"
                class="cost-range-filter__input"
                placeholder="Min $"
                min="0"
                step="0.01"
                value={costMin()}
                onInput={(e) => setCostMin(e.currentTarget.value)}
              />
              <span class="cost-range-filter__sep">&ndash;</span>
              <input
                type="number"
                class="cost-range-filter__input"
                placeholder="Max $"
                min="0"
                step="0.01"
                value={costMax()}
                onInput={(e) => setCostMax(e.currentTarget.value)}
              />
            </div>
          </Show>
          <Show when={hasNoData() && !(isLocalMode() && params.agentName === 'local-agent') && !setupCompleted()}>
            <button class="btn btn--primary" onClick={() => setSetupOpen(true)}>
              Set up agent
            </button>
          </Show>
        </div>
      </div>

      <Show when={!data.loading} fallback={
        <div class="panel">
          <div class="skeleton skeleton--text" style="width: 120px; height: 16px; margin-bottom: 16px;" />
          <For each={[1, 2, 3, 4, 5, 6, 7, 8]}>
            {() => (
              <div style="display: flex; gap: 16px; padding: 12px 0; border-bottom: 1px solid hsl(var(--border));">
                <div class="skeleton skeleton--text" style="width: 60px; height: 14px;" />
                <div class="skeleton skeleton--text" style="width: 60px; height: 14px;" />
                <div class="skeleton skeleton--text" style="width: 50px; height: 14px;" />
                <div class="skeleton skeleton--text" style="width: 70px; height: 14px;" />
                <div class="skeleton skeleton--text" style="width: 50px; height: 14px;" />
                <div class="skeleton skeleton--text" style="width: 50px; height: 14px;" />
                <div class="skeleton skeleton--text" style="width: 80px; height: 14px;" />
                <div class="skeleton skeleton--text" style="width: 40px; height: 14px;" />
              </div>
            )}
          </For>
        </div>
      }>
        <Show when={!data.error} fallback={
          <ErrorState error={data.error} onRetry={refetch} />
        }>
        <Show when={!hasNoData()} fallback={
          <Show when={(isLocalMode() && params.agentName === 'local-agent') || setupCompleted()} fallback={
            <div class="empty-state">
              <div class="empty-state__title">No messages recorded</div>
              <p>Connect your agent to Manifest and send your first message. Each LLM call will be logged here with its cost, tokens, and status.</p>
              <button class="btn btn--primary" style="margin-top: var(--gap-md);" onClick={() => setSetupOpen(true)}>
                Set up agent
              </button>
              <div class="empty-state__img-wrapper">
                <img src="/example-messages.svg" alt="" class="empty-state__img" />
              </div>
            </div>
          }>
            <div class="waiting-banner">
              <i class="bxd bx-florist" />
              <p>Waiting for data &mdash; messages will appear within seconds of your agent's first LLM call.</p>
            </div>
            <div class="demo-dashboard">
              <div class="panel">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--gap-lg);">
                  <div class="panel__title" style="margin-bottom: 0;">Messages</div>
                  <span style="font-size: var(--font-size-xs); color: hsl(var(--muted-foreground));">
                    0 total
                  </span>
                </div>
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Message</th>
                      <th>Cost</th>
                      <th>Total Tokens</th>
                      <th>Input</th>
                      <th>Output</th>
                      <th>Model</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td colspan="8" style="text-align: center; color: hsl(var(--muted-foreground)); padding: var(--gap-lg);">
                        Messages will appear here
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </Show>
        }>
          <div class="panel">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--gap-lg);">
              <div class="panel__title" style="margin-bottom: 0;">Messages</div>
              <span style="font-size: var(--font-size-xs); color: hsl(var(--muted-foreground));">
                {data()!.total_count} total
              </span>
            </div>
            <table class="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Message</th>
                  <th>Cost</th>
                  <th>Total Tokens<InfoTooltip text="Tokens are units of text that AI models process. More tokens = higher cost." /></th>
                  <th>Input<InfoTooltip text="Tokens sent to the model (your prompt). Also called 'input tokens'." /></th>
                  <th>Output<InfoTooltip text="Tokens returned by the model (its response). Also called 'output tokens'." /></th>
                  <th>Model</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <For each={data()?.items}>
                  {(item) => (
                    <tr>
                      <td style="white-space: nowrap; font-family: var(--font-mono); font-size: var(--font-size-xs); color: hsl(var(--muted-foreground));">
                        {formatTime(item.timestamp)}
                      </td>
                      <td style="font-family: var(--font-mono); font-size: var(--font-size-xs); color: hsl(var(--muted-foreground));">
                        {item.id.slice(0, 8)}
                        {item.routing_reason === 'heartbeat' && (
                          <span title="Heartbeat" style="display: inline-flex; align-items: center; margin-left: 4px; color: hsl(var(--muted-foreground)); opacity: 0.7;">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                            </svg>
                          </span>
                        )}
                      </td>
                      <td style="font-family: var(--font-mono);" title={item.cost != null && item.cost > 0 && item.cost < 0.01 ? `$${item.cost.toFixed(6)}` : undefined}>
                        {item.cost != null ? (formatCost(item.cost) ?? "\u2014") : "\u2014"}
                      </td>
                      <td style="font-family: var(--font-mono);">
                        {item.total_tokens != null ? formatNumber(item.total_tokens) : "\u2014"}
                      </td>
                      <td style="font-family: var(--font-mono); font-size: var(--font-size-xs); color: hsl(var(--muted-foreground));">
                        {item.input_tokens != null ? formatNumber(item.input_tokens) : "\u2014"}
                      </td>
                      <td style="font-family: var(--font-mono); font-size: var(--font-size-xs); color: hsl(var(--muted-foreground));">
                        {item.output_tokens != null ? formatNumber(item.output_tokens) : "\u2014"}
                      </td>
                      <td style="font-family: var(--font-mono); font-size: var(--font-size-xs); color: hsl(var(--muted-foreground));">
                        <span style="display: inline-flex; align-items: center; gap: 4px;">
                          {item.model && inferProviderFromModel(item.model) && (
                            <span title={inferProviderName(item.model)} style="display: inline-flex; flex-shrink: 0;">{providerIcon(inferProviderFromModel(item.model)!, 14)}</span>
                          )}
                          {item.model ?? "\u2014"}
                          {item.routing_tier && <span class={`tier-badge tier-badge--${item.routing_tier}`}>{item.routing_tier}</span>}
                        </span>
                      </td>
                      <td>
                        <span class={`status-badge status-badge--${item.status}`}>
                          {item.status === 'rate_limited'
                            ? <A href={`/agents/${encodeURIComponent(params.agentName)}/limits`}>{formatStatus(item.status)}</A>
                            : formatStatus(item.status)}
                        </span>
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </Show>
        </Show>
      </Show>

      <SetupModal open={setupOpen()} agentName={decodeURIComponent(params.agentName)} onClose={() => setSetupOpen(false)} />
    </div>
  );
};

export default MessageLog;
