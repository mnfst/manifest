import {
  createSignal,
  createResource,
  createEffect,
  on,
  Show,
  For,
  type Component,
} from 'solid-js';
import { A, useParams } from '@solidjs/router';
import { Title, Meta } from '@solidjs/meta';
import ErrorState from '../components/ErrorState.jsx';
import Pagination from '../components/Pagination.jsx';
import { getMessages, getCustomProviders, type CustomProviderData } from '../services/api.js';
import {
  formatNumber,
  formatCost,
  formatErrorMessage,
  formatTime,
  formatStatus,
  formatDuration,
} from '../services/formatters.js';
import {
  inferProviderFromModel,
  inferProviderName,
  stripCustomPrefix,
} from '../services/routing-utils.js';
import { providerIcon } from '../components/ProviderIcon.jsx';
import Select from '../components/Select.jsx';
import InfoTooltip from '../components/InfoTooltip.jsx';
import { isLocalMode } from '../services/local-mode.js';
import { pingCount } from '../services/sse.js';
import { agentDisplayName } from '../services/agent-display-name.js';
import SetupModal from '../components/SetupModal.jsx';
import { createCursorPagination } from '../services/cursor-pagination.js';
import '../styles/overview.css';

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
  cache_read_tokens: number | null;
  cache_creation_tokens: number | null;
  duration_ms: number | null;
  error_message?: string | null;
  auth_type?: string | null;
  fallback_from_model?: string | null;
  fallback_index?: number | null;
}

interface MessagesData {
  items: MessageItem[];
  next_cursor: string | null;
  total_count: number;
  models: string[];
}

const MessageLog: Component = () => {
  const params = useParams<{ agentName: string }>();
  const [statusFilter, setStatusFilter] = createSignal('');
  const [modelFilter, setModelFilter] = createSignal('');
  const [costMin, setCostMin] = createSignal('');
  const [costMax, setCostMax] = createSignal('');
  const [setupOpen, setSetupOpen] = createSignal(false);
  const [setupCompleted] = createSignal(
    !!localStorage.getItem(`setup_completed_${params.agentName}`) ||
      (isLocalMode() === true && params.agentName === 'local-agent'),
  );

  const [customProviders] = createResource(
    () => params.agentName,
    (name) => getCustomProviders(decodeURIComponent(name)),
  );

  /** Map custom:<uuid> → provider display name */
  const customProviderName = (model: string): string | undefined => {
    const match = model.match(/^custom:([^/]+)\//);
    if (!match) return undefined;
    const id = match[1];
    return customProviders()?.find((cp: CustomProviderData) => cp.id === id)?.name;
  };

  const pager = createCursorPagination(50);

  createEffect(
    on([statusFilter, modelFilter, costMin, costMax], () => pager.resetPage(), { defer: true }),
  );

  const [data, { refetch }] = createResource(
    () => ({
      status: statusFilter(),
      model: modelFilter(),
      costMin: costMin(),
      costMax: costMax(),
      agentName: params.agentName,
      _ping: pingCount(),
      cursor: pager.currentCursor(),
      limit: pager.pageSize,
    }),
    (p) => {
      const q: Record<string, string> = {};
      if (p.status) q.status = p.status;
      if (p.model) q.model = p.model;
      if (p.costMin) q.cost_min = p.costMin;
      if (p.costMax) q.cost_max = p.costMax;
      if (p.agentName) q.agent_name = p.agentName;
      if (p.cursor) q.cursor = p.cursor;
      q.limit = String(p.limit);
      return getMessages(q) as Promise<MessagesData>;
    },
  );

  createEffect(
    on(
      () => data(),
      (d) => {
        if (d) pager.recordResponse(d.next_cursor);
      },
    ),
  );

  const hasActiveFilters = () =>
    statusFilter() !== '' || modelFilter() !== '' || costMin() !== '' || costMax() !== '';

  const hasNoData = () => {
    const d = data();
    return d && d.total_count === 0;
  };

  const isFilteredEmpty = () => hasNoData() && hasActiveFilters();
  const isAgentEmpty = () => hasNoData() && !hasActiveFilters();

  const clearFilters = () => {
    setStatusFilter('');
    setModelFilter('');
    setCostMin('');
    setCostMax('');
  };

  const scrollToFallbackSuccess = (model: string) => {
    const items = data()?.items;
    if (!items) return;
    const success = items.find((i) => i.fallback_from_model === model && i.status === 'ok');
    if (!success) return;
    const el = document.getElementById(`msg-${success.id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('msg-highlight');
    setTimeout(() => el.classList.remove('msg-highlight'), 2000);
  };

  return (
    <div class="container--full">
      <Title>
        {agentDisplayName() ?? decodeURIComponent(params.agentName)} Messages - Manifest
      </Title>
      <Meta
        name="description"
        content={`Browse all messages sent and received by ${agentDisplayName() ?? decodeURIComponent(params.agentName)}. Filter by status, model, or cost.`}
      />
      <div class="page-header">
        <div>
          <h1>Messages</h1>
          <span class="breadcrumb">
            Full log of every LLM call. Filter by status, model, or cost.
          </span>
        </div>
        <div class="header-controls">
          <Show when={!isAgentEmpty()}>
            <Select
              value={statusFilter()}
              onChange={setStatusFilter}
              options={[
                { label: 'All statuses', value: '' },
                { label: 'Successful', value: 'ok' },
                { label: 'Rate Limited', value: 'rate_limited' },
                { label: 'Retried', value: 'retry' },
                { label: 'Handled', value: 'fallback_error' },
                { label: 'Failed', value: 'error' },
              ]}
            />
            <Select
              value={modelFilter()}
              onChange={setModelFilter}
              options={[
                { label: 'All models', value: '' },
                ...(data()?.models ?? []).map((m) => ({ label: stripCustomPrefix(m), value: m })),
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
          <Show
            when={
              isAgentEmpty() &&
              !(isLocalMode() && params.agentName === 'local-agent') &&
              !setupCompleted()
            }
          >
            <button class="btn btn--primary" onClick={() => setSetupOpen(true)}>
              Set up agent
            </button>
          </Show>
        </div>
      </div>

      <Show
        when={!data.loading}
        fallback={
          <div class="panel">
            <div
              class="skeleton skeleton--text"
              style="width: 120px; height: 16px; margin-bottom: 16px;"
            />
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
        }
      >
        <Show when={!data.error} fallback={<ErrorState error={data.error} onRetry={refetch} />}>
          <Show when={isAgentEmpty()}>
            <Show
              when={(isLocalMode() && params.agentName === 'local-agent') || setupCompleted()}
              fallback={
                <div class="empty-state">
                  <div class="empty-state__title">No messages recorded</div>
                  <p>Connect your agent and send a message. Each LLM call gets logged here.</p>
                  <button
                    class="btn btn--primary"
                    style="margin-top: var(--gap-md);"
                    onClick={() => setSetupOpen(true)}
                  >
                    Set up agent
                  </button>
                  <div class="empty-state__img-wrapper">
                    <img
                      src="/example-messages.svg"
                      alt="Example message log showing LLM call history"
                      class="empty-state__img"
                    />
                  </div>
                </div>
              }
            >
              <div class="waiting-banner">
                <i class="bxd bx-florist" />
                <p>
                  Waiting for data. Messages will show up within seconds of your agent's first LLM
                  call.
                </p>
              </div>
              <div class="demo-dashboard">
                <div class="panel">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--gap-lg);">
                    <div class="panel__title" style="margin-bottom: 0;">
                      Messages
                    </div>
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
                        <th>Cache</th>
                        <th>Duration</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td
                          colspan="10"
                          style="text-align: center; color: hsl(var(--muted-foreground)); padding: var(--gap-lg);"
                        >
                          Messages will appear here
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </Show>
          </Show>
          <Show when={isFilteredEmpty()}>
            <div class="panel">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--gap-lg);">
                <div class="panel__title" style="margin-bottom: 0;">
                  Messages
                </div>
                <span style="font-size: var(--font-size-xs); color: hsl(var(--muted-foreground));">
                  0 results
                </span>
              </div>
              <div class="model-filter__empty">
                <p class="model-filter__empty-title">No messages match your filters</p>
                <p class="model-filter__empty-hint">
                  Try adjusting your status, model, or cost filters to see more results.
                </p>
                <button class="btn btn--outline" onClick={clearFilters} type="button">
                  Clear filters
                </button>
              </div>
            </div>
          </Show>
          <Show when={!hasNoData()}>
            <div class="panel">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--gap-lg);">
                <div class="panel__title" style="margin-bottom: 0;">
                  Messages
                </div>
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
                    <th>
                      Total Tokens
                      <InfoTooltip text="Tokens are units of text that AI models process. More tokens = higher cost." />
                    </th>
                    <th>
                      Input
                      <InfoTooltip text="Tokens sent to the model (your prompt). Also called 'input tokens'." />
                    </th>
                    <th>
                      Output
                      <InfoTooltip text="Tokens returned by the model (its response). Also called 'output tokens'." />
                    </th>
                    <th>Model</th>
                    <th>Cache</th>
                    <th>Duration</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={data()?.items}>
                    {(item) => (
                      <tr id={`msg-${item.id}`}>
                        <td style="white-space: nowrap; font-family: var(--font-mono); font-size: var(--font-size-xs); color: hsl(var(--muted-foreground));">
                          {formatTime(item.timestamp)}
                        </td>
                        <td style="font-family: var(--font-mono); font-size: var(--font-size-xs); color: hsl(var(--muted-foreground));">
                          {item.id.slice(0, 8)}
                          {item.routing_reason === 'heartbeat' && (
                            <span
                              title="Heartbeat"
                              style="display: inline-flex; align-items: center; margin-left: 4px; color: hsl(var(--muted-foreground)); opacity: 0.7;"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                aria-hidden="true"
                              >
                                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                              </svg>
                            </span>
                          )}
                        </td>
                        <td style="font-family: var(--font-mono);">
                          <Show
                            when={item.auth_type === 'subscription'}
                            fallback={
                              <span
                                title={
                                  item.cost != null && item.cost > 0 && item.cost < 0.01
                                    ? `$${item.cost.toFixed(6)}`
                                    : undefined
                                }
                              >
                                {item.cost != null ? (formatCost(item.cost) ?? '\u2014') : '\u2014'}
                              </span>
                            }
                          >
                            <span
                              style="color: hsl(var(--muted-foreground));"
                              title="Included in subscription"
                            >
                              $0.00
                            </span>
                          </Show>
                        </td>
                        <td style="font-family: var(--font-mono);">
                          {item.total_tokens != null ? formatNumber(item.total_tokens) : '\u2014'}
                        </td>
                        <td style="font-family: var(--font-mono); font-size: var(--font-size-xs); color: hsl(var(--muted-foreground));">
                          {item.input_tokens != null ? formatNumber(item.input_tokens) : '\u2014'}
                        </td>
                        <td style="font-family: var(--font-mono); font-size: var(--font-size-xs); color: hsl(var(--muted-foreground));">
                          {item.output_tokens != null ? formatNumber(item.output_tokens) : '\u2014'}
                        </td>
                        <td style="font-family: var(--font-mono); font-size: var(--font-size-xs); color: hsl(var(--muted-foreground));">
                          <span style="display: inline-flex; align-items: center; gap: 4px;">
                            {item.model && inferProviderFromModel(item.model) === 'custom' ? (
                              (() => {
                                const provName = customProviderName(item.model!);
                                const letter = (provName ?? stripCustomPrefix(item.model!))
                                  .charAt(0)
                                  .toUpperCase();
                                return (
                                  <span
                                    class="provider-card__logo-letter"
                                    title={provName}
                                    style={{
                                      background: 'var(--custom-provider-color)',
                                      width: '16px',
                                      height: '16px',
                                      'font-size': '9px',
                                      'flex-shrink': '0',
                                      'border-radius': '50%',
                                    }}
                                  >
                                    {letter}
                                  </span>
                                );
                              })()
                            ) : item.model && inferProviderFromModel(item.model) ? (
                              <span
                                role="img"
                                aria-label={
                                  item.auth_type === 'subscription'
                                    ? `${inferProviderName(item.model)} (Subscription)`
                                    : inferProviderName(item.model)
                                }
                                title={
                                  item.auth_type === 'subscription'
                                    ? `${inferProviderName(item.model)} (Subscription)`
                                    : inferProviderName(item.model)
                                }
                                style="display: inline-flex; flex-shrink: 0; position: relative;"
                              >
                                {providerIcon(inferProviderFromModel(item.model)!, 14)}
                                {item.auth_type === 'subscription' && (
                                  <span
                                    class="provider-auth-badge provider-auth-badge--sub provider-auth-badge--overlay"
                                    aria-hidden="true"
                                  />
                                )}
                              </span>
                            ) : null}
                            {item.model ? stripCustomPrefix(item.model) : '\u2014'}
                            {item.routing_tier && (
                              <span class={`tier-badge tier-badge--${item.routing_tier}`}>
                                {item.routing_tier}
                              </span>
                            )}
                            {item.fallback_from_model && (
                              <span
                                class="tier-badge tier-badge--fallback"
                                title={`Fallback from ${stripCustomPrefix(item.fallback_from_model)}`}
                              >
                                fallback
                              </span>
                            )}
                          </span>
                        </td>
                        <td style="font-family: var(--font-mono); font-size: var(--font-size-xs); color: hsl(var(--muted-foreground));">
                          {(item.cache_read_tokens ?? 0) > 0 ||
                          (item.cache_creation_tokens ?? 0) > 0
                            ? `Read: ${formatNumber(item.cache_read_tokens ?? 0)} / Write: ${formatNumber(item.cache_creation_tokens ?? 0)}`
                            : '\u2014'}
                        </td>
                        <td style="font-family: var(--font-mono); font-size: var(--font-size-xs); color: hsl(var(--muted-foreground));">
                          {item.duration_ms != null ? formatDuration(item.duration_ms) : '\u2014'}
                        </td>
                        <td>
                          <Show
                            when={item.error_message}
                            fallback={
                              <span class={`status-badge status-badge--${item.status}`}>
                                {item.status === 'rate_limited' ? (
                                  <A
                                    href={`/agents/${encodeURIComponent(params.agentName)}/limits`}
                                  >
                                    {formatStatus(item.status)}
                                  </A>
                                ) : (
                                  formatStatus(item.status)
                                )}
                              </span>
                            }
                          >
                            <span
                              class="status-badge-tooltip"
                              tabindex="0"
                              role="note"
                              aria-label={formatErrorMessage(item.error_message!)}
                            >
                              <span
                                class={`status-badge status-badge--${item.status}`}
                                onClick={
                                  item.status === 'fallback_error' && item.model
                                    ? () => scrollToFallbackSuccess(item.model!)
                                    : undefined
                                }
                              >
                                {item.status === 'fallback_error' && (
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="11"
                                    height="11"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="2.5"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    style="margin-right: 3px; flex-shrink: 0;"
                                  >
                                    <polyline points="15 17 20 12 15 7" />
                                    <path d="M4 18v-2a4 4 0 0 1 4-4h12" />
                                  </svg>
                                )}
                                {formatStatus(item.status)}
                              </span>
                              <span class="status-badge-tooltip__bubble">
                                {formatErrorMessage(item.error_message!)}
                              </span>
                            </span>
                          </Show>
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
              <Pagination
                currentPage={pager.currentPage}
                totalItems={() => data()?.total_count ?? 0}
                pageSize={pager.pageSize}
                hasNextPage={pager.hasNextPage}
                isLoading={() => data.loading}
                onPrevious={pager.previousPage}
                onNext={pager.nextPage}
              />
            </div>
          </Show>
        </Show>
      </Show>

      <SetupModal
        open={setupOpen()}
        agentName={decodeURIComponent(params.agentName)}
        onClose={() => setSetupOpen(false)}
      />
    </div>
  );
};

export default MessageLog;
