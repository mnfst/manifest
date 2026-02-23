import { createSignal, createResource, Show, For, type Component } from "solid-js";
import { useParams } from "@solidjs/router";
import { Title, Meta } from "@solidjs/meta";
import ErrorState from "../components/ErrorState.jsx";
import { getMessages } from "../services/api.js";
import { formatNumber, formatCost, formatTime, formatStatus } from "../services/formatters.js";
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
      <Title>{params.agentName} - Messages | Manifest</Title>
      <Meta name="description" content={`Browse all messages sent and received by ${params.agentName}. Filter by status, model, or cost.`} />
      <div class="page-header">
        <div>
          <h1>Messages</h1>
          <span class="breadcrumb">Every message sent and received by your agent</span>
        </div>
        <div class="header-controls">
          <Show when={!hasNoData()}>
            <Select
              value={statusFilter()}
              onChange={setStatusFilter}
              options={[
                { label: "All statuses", value: "" },
                { label: "Successful", value: "ok" },
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
          <Show when={hasNoData() && !setupCompleted()}>
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
          <Show when={setupCompleted()} fallback={
            <div class="empty-state">
              <div class="empty-state__title">No messages recorded</div>
              <p>Set up your agent and start chatting. Activity will appear here automatically.</p>
              <button class="btn btn--primary" style="margin-top: var(--gap-md);" onClick={() => setSetupOpen(true)}>
                Set up agent
              </button>
              <div class="empty-state__img-wrapper">
                <img src="/example-messages.svg" alt="" class="empty-state__img empty-state__img--light" />
                <img src="/example-messages-dark.svg" alt="" class="empty-state__img empty-state__img--dark" />
              </div>
            </div>
          }>
            <div class="waiting-banner">
              <i class="bxd bx-florist" />
              <p>Your messages will appear a few seconds after your first exchange with your agent.</p>
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
                      <th>Time</th>
                      <th>Message</th>
                      <th>Cost</th>
                      <th>Total Tokens</th>
                      <th>Sent to AI</th>
                      <th>Received from AI</th>
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
                  <th>Time</th>
                  <th>Message</th>
                  <th>Cost</th>
                  <th>Total Tokens<InfoTooltip text="Tokens are units of text that AI models process. More tokens = higher cost." /></th>
                  <th>Sent to AI</th>
                  <th>Received from AI</th>
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
                      </td>
                      <td style="font-family: var(--font-mono);">
                        {item.cost != null ? formatCost(item.cost) : "\u2014"}
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
                      <td style="font-family: var(--font-mono); font-size: var(--font-size-xs); color: hsl(var(--muted-foreground));">{item.model ?? "\u2014"}</td>
                      <td>
                        <span class={`status-badge status-badge--${item.status}`}>{formatStatus(item.status)}</span>
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
