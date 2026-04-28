import { Meta, Title } from '@solidjs/meta';
import { useNavigate, useParams } from '@solidjs/router';
import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  on,
  onCleanup,
  onMount,
  Show,
  type Component,
} from 'solid-js';
import ErrorState from '../components/ErrorState.jsx';
import FeedbackModal from '../components/FeedbackModal.jsx';
import MessageTable from '../components/MessageTable.jsx';
import Pagination from '../components/Pagination.jsx';
import Select from '../components/Select.jsx';
import SetupModal from '../components/SetupModal.jsx';
import { DETAILED_COLUMNS, type MessageRow } from '../components/message-table-types.js';
import { agentDisplayName } from '../services/agent-display-name.js';
import { agentPlatform, agentCategory } from '../services/agent-platform-store.js';
import {
  getCustomProviders,
  getMessages,
  getRoutingStatus,
  setMessageFeedback,
  clearMessageFeedback,
  type CustomProviderData,
} from '../services/api.js';
import { createCursorPagination } from '../services/cursor-pagination.js';
import { preloadModelDisplayNames } from '../services/model-display.js';
import { PROVIDERS } from '../services/providers.js';
import { checkIsSelfHosted } from '../services/setup-status.js';
import { pingCount } from '../services/sse.js';
import '../styles/overview.css';

interface MessagesData {
  items: MessageRow[];
  next_cursor: string | null;
  total_count: number;
  providers: string[];
}

const MessageLog: Component = () => {
  const params = useParams<{ agentName: string }>();
  const navigate = useNavigate();
  preloadModelDisplayNames();
  const [isSelfHosted, setIsSelfHosted] = createSignal(false);
  onMount(() => {
    checkIsSelfHosted().then(setIsSelfHosted);
  });
  const columns = () =>
    isSelfHosted() ? DETAILED_COLUMNS.filter((c) => c !== 'feedback') : DETAILED_COLUMNS;
  const [providerFilter, setProviderFilter] = createSignal('');
  const [costMin, setCostMin] = createSignal('');
  const [costMax, setCostMax] = createSignal('');
  const [setupOpen, setSetupOpen] = createSignal(false);
  const [setupCompleted] = createSignal(
    !!localStorage.getItem(`setup_completed_${params.agentName}`),
  );

  const [feedbackModalOpen, setFeedbackModalOpen] = createSignal(false);
  const [feedbackMessageId, setFeedbackMessageId] = createSignal('');
  const [feedbackOverrides, setFeedbackOverrides] = createSignal<Record<string, string | null>>({});

  const applyFeedbackOverrides = (items: MessageRow[]): MessageRow[] => {
    const overrides = feedbackOverrides();
    return items.map((item) =>
      item.id in overrides ? { ...item, feedback_rating: overrides[item.id] ?? undefined } : item,
    );
  };

  const handleFeedbackLike = (id: string) => {
    setFeedbackOverrides((prev) => ({ ...prev, [id]: 'like' }));
    setMessageFeedback(id, { rating: 'like' }).catch(() => {
      setFeedbackOverrides((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    });
  };

  const handleFeedbackDislike = (id: string) => {
    setFeedbackOverrides((prev) => ({ ...prev, [id]: 'dislike' }));
    setFeedbackMessageId(id);
    setFeedbackModalOpen(true);
    setMessageFeedback(id, { rating: 'dislike' }).catch(() => {
      setFeedbackOverrides((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    });
  };

  const handleFeedbackClear = (id: string) => {
    setFeedbackOverrides((prev) => ({ ...prev, [id]: null }));
    clearMessageFeedback(id).catch(() => {
      setFeedbackOverrides((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    });
  };

  const handleFeedbackSubmit = (tags: string[], details: string) => {
    const id = feedbackMessageId();
    if (id) {
      setMessageFeedback(id, { rating: 'dislike', tags, details });
    }
    setFeedbackModalOpen(false);
  };

  const [customProviders] = createResource(
    () => params.agentName,
    (name) => getCustomProviders(decodeURIComponent(name)),
  );

  const [routingStatus] = createResource(
    () => params.agentName,
    (name) => getRoutingStatus(decodeURIComponent(name)),
  );

  const hasProviders = () => routingStatus()?.enabled === true;

  /** Map custom:<uuid> → provider display name */
  const customProviderName = (model: string): string | undefined => {
    const match = model.match(/^custom:([^/]+)\//);
    if (!match) return undefined;
    const id = match[1];
    return customProviders()?.find((cp: CustomProviderData) => cp.id === id)?.name;
  };

  const pager = createCursorPagination(50);

  let costMinTimer: ReturnType<typeof setTimeout>;
  let costMaxTimer: ReturnType<typeof setTimeout>;
  onCleanup(() => {
    clearTimeout(costMinTimer);
    clearTimeout(costMaxTimer);
  });
  const debouncedSetCostMin = (val: string) => {
    clearTimeout(costMinTimer);
    costMinTimer = setTimeout(() => setCostMin(val), 400);
  };
  const debouncedSetCostMax = (val: string) => {
    clearTimeout(costMaxTimer);
    costMaxTimer = setTimeout(() => setCostMax(val), 400);
  };

  createEffect(on([providerFilter, costMin, costMax], () => pager.resetPage(), { defer: true }));

  const [data, { refetch }] = createResource(
    () => ({
      provider: providerFilter(),
      costMin: costMin(),
      costMax: costMax(),
      agentName: params.agentName,
      _ping: pingCount(),
      cursor: pager.currentCursor(),
      limit: pager.pageSize,
    }),
    (p) => {
      const q: Record<string, string> = {};
      if (p.provider) q.provider = p.provider;
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

  const hasActiveFilters = () => providerFilter() !== '' || costMin() !== '' || costMax() !== '';

  const hasNoData = () => {
    const d = data();
    return d && d.total_count === 0;
  };

  const showEmptyState = () => hasNoData() && !hasActiveFilters() && !hasProviders();
  const isFilteredEmpty = () => hasNoData() && hasActiveFilters();
  const showMessages = () => !hasNoData() || (hasProviders() && !hasActiveFilters());

  const clearFilters = () => {
    setProviderFilter('');
    setCostMin('');
    setCostMax('');
  };

  /** Resolve provider ID to display name */
  const providerDisplayName = (id: string): string => {
    const prov = PROVIDERS.find((p) => p.id === id);
    return prov?.name ?? id;
  };

  const providerOptions = createMemo(() => [
    { label: 'All providers', value: '' },
    ...(data()?.providers ?? []).map((id) => ({
      label: providerDisplayName(id),
      value: id,
    })),
  ]);

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
        content={`Browse all messages sent and received by ${agentDisplayName() ?? decodeURIComponent(params.agentName)}. Filter by provider or cost.`}
      />
      <div class="page-header">
        <div>
          <h1>Messages</h1>
          <span class="breadcrumb">Full log of every LLM call. Filter by provider or cost.</span>
        </div>
        <div class="header-controls">
          <Show when={!showEmptyState()}>
            <Select
              value={providerFilter()}
              onChange={setProviderFilter}
              options={providerOptions()}
            />
            <div class="cost-range-filter">
              <input
                type="number"
                class="cost-range-filter__input"
                placeholder="Min $"
                aria-label="Minimum cost filter"
                min="0"
                step="0.01"
                value={costMin()}
                onInput={(e) => debouncedSetCostMin(e.currentTarget.value)}
              />
              <span class="cost-range-filter__sep">&ndash;</span>
              <input
                type="number"
                class="cost-range-filter__input"
                placeholder="Max $"
                aria-label="Maximum cost filter"
                min="0"
                step="0.01"
                value={costMax()}
                onInput={(e) => debouncedSetCostMax(e.currentTarget.value)}
              />
            </div>
          </Show>
          <Show when={showEmptyState() && !setupCompleted()}>
            <button class="btn btn--primary btn--sm" onClick={() => setSetupOpen(true)}>
              Set up agent
            </button>
          </Show>
        </div>
      </div>

      <Show
        when={data() !== undefined || !data.loading}
        fallback={
          <div class="panel">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--gap-lg);">
              <div class="skeleton skeleton--text" style="width: 80px; height: 16px;" />
              <div class="skeleton skeleton--text" style="width: 60px; height: 14px;" />
            </div>
            <div class="data-table-scroll">
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
                    <th>Latency</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}>
                    {() => (
                      <tr>
                        <td>
                          <div class="skeleton skeleton--text" style="width: 90px;" />
                        </td>
                        <td>
                          <div class="skeleton skeleton--text" style="width: 55px;" />
                        </td>
                        <td>
                          <div class="skeleton skeleton--text" style="width: 40px;" />
                        </td>
                        <td>
                          <div class="skeleton skeleton--text" style="width: 40px;" />
                        </td>
                        <td>
                          <div class="skeleton skeleton--text" style="width: 35px;" />
                        </td>
                        <td>
                          <div class="skeleton skeleton--text" style="width: 35px;" />
                        </td>
                        <td>
                          <div class="skeleton skeleton--text" style="width: 110px;" />
                        </td>
                        <td>
                          <div class="skeleton skeleton--text" style="width: 90px;" />
                        </td>
                        <td>
                          <div class="skeleton skeleton--text" style="width: 35px;" />
                        </td>
                        <td>
                          <div class="skeleton skeleton--text" style="width: 50px;" />
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </div>
        }
      >
        <Show when={!data.error} fallback={<ErrorState error={data.error} onRetry={refetch} />}>
          <Show when={showEmptyState()}>
            <Show
              when={setupCompleted()}
              fallback={
                <div class="empty-state">
                  <div class="empty-state__title">No messages yet</div>
                  <p>Set up your agent and send a message. Every LLM call shows up here.</p>
                  <button
                    class="btn btn--primary btn--sm"
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
                      loading="lazy"
                    />
                  </div>
                </div>
              }
            >
              <div class="empty-state">
                <div class="empty-state__title">No messages yet</div>
                <p>Connect a provider to start routing LLM calls.</p>
                <button
                  class="btn btn--primary btn--sm"
                  style="margin-top: var(--gap-md);"
                  onClick={() =>
                    navigate(`/agents/${encodeURIComponent(params.agentName)}/routing`, {
                      state: { openProviders: true },
                    })
                  }
                >
                  Connect provider
                </button>
                <div class="empty-state__img-wrapper">
                  <img
                    src="/example-messages.svg"
                    alt="Example message log showing LLM call history"
                    class="empty-state__img"
                    loading="lazy"
                  />
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
                  Try adjusting your provider or cost filters to see more results.
                </p>
                <button class="btn btn--outline btn--sm" onClick={clearFilters} type="button">
                  Clear filters
                </button>
              </div>
            </div>
          </Show>
          <Show when={showMessages()}>
            <Show when={hasNoData() && hasProviders()}>
              <div class="waiting-banner">
                <i class="bxd bx-florist" />
                <p>No messages yet. They appear seconds after your first LLM call.</p>
              </div>
            </Show>
            <div class="panel">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--gap-lg);">
                <div class="panel__title" style="margin-bottom: 0;">
                  Messages
                </div>
                <span style="font-size: var(--font-size-xs); color: hsl(var(--muted-foreground));">
                  {data()?.total_count ?? 0} total
                </span>
              </div>
              <div class="data-table-scroll">
                <MessageTable
                  items={
                    isSelfHosted()
                      ? (data()?.items ?? [])
                      : applyFeedbackOverrides(data()?.items ?? [])
                  }
                  columns={columns()}
                  agentName={params.agentName}
                  customProviderName={customProviderName}
                  onFallbackErrorClick={scrollToFallbackSuccess}
                  onFeedbackLike={isSelfHosted() ? undefined : handleFeedbackLike}
                  onFeedbackDislike={isSelfHosted() ? undefined : handleFeedbackDislike}
                  onFeedbackClear={isSelfHosted() ? undefined : handleFeedbackClear}
                  rowIdPrefix="msg-"
                  showHeaderTooltips
                  expandable
                />
              </div>
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
        agentPlatform={agentPlatform()}
        agentCategory={agentCategory()}
        onClose={() => setSetupOpen(false)}
      />

      <Show when={!isSelfHosted()}>
        <FeedbackModal
          open={feedbackModalOpen()}
          onClose={() => setFeedbackModalOpen(false)}
          onSubmit={handleFeedbackSubmit}
        />
      </Show>
    </div>
  );
};

export default MessageLog;
