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
import RecordedMessageModal from '../components/RecordedMessageModal.jsx';
import Select from '../components/Select.jsx';
import SetupModal from '../components/SetupModal.jsx';
import AddAgentModal from '../components/AddAgentModal.jsx';
import { DETAILED_COLUMNS, type MessageRow } from '../components/message-table-types.js';
import { agentDisplayName } from '../services/agent-display-name.js';
import { agentPlatform, agentCategory } from '../services/agent-platform-store.js';
import { getAgents } from '../services/api.js';
import {
  getCustomProviders,
  getSpecificityAssignments,
  getMessages,
  getRoutingStatus,
  listHeaderTiers,
  setMessageFeedback,
  clearMessageFeedback,
  type CustomProviderData,
} from '../services/api.js';
import { createCursorPagination } from '../services/cursor-pagination.js';
import { preloadModelDisplayNames } from '../services/model-display.js';
import { PROVIDERS, SPECIFICITY_STAGES } from '../services/providers.js';
import { getProviders, type RoutingProvider } from '../services/api/routing.js';
import { fetchJson } from '../services/api/core.js';
import { providerIcon } from '../components/ProviderIcon.jsx';
import { authBadgeFor } from '../components/AuthBadge.jsx';
import { ALL_TIERS, TIER_LABELS_ALL } from 'manifest-shared';
import { checkIsSelfHosted } from '../services/setup-status.js';
import { messagePing } from '../services/sse.js';
import '../styles/overview.css';
// The recorded-message drawer/modal styles. Only the Messages log mounts
// RecordedMessageModal, so this CSS stays out of the global theme bundle.
import '../styles/recording.css';
// The filtered-empty state here reuses .model-filter__empty classes, so this
// route imports model-filter.css directly (also imported by ModelPrices).
import '../styles/model-filter.css';

interface MessagesData {
  items: MessageRow[];
  next_cursor: string | null;
  total_count: number;
  providers: string[];
}

const SPECIFICITY_FILTER_PREFIX = 'specificity:';
const HEADER_TIER_FILTER_PREFIX = 'header:';

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
  const [agentFilter, setAgentFilter] = createSignal('');
  const [agentList] = createResource(
    () => true,
    async () => {
      try {
        const data = await getAgents();
        const list = ((data as any)?.agents ?? data ?? []) as Array<{ agent_name: string }>;
        return list.map((a) => a.agent_name).sort();
      } catch {
        return [] as string[];
      }
    },
  );
  const agentFilterOptions = createMemo(() => [
    { label: 'All harnesses', value: '' },
    ...(agentList() ?? []).map((a) => ({ label: a, value: a })),
  ]);
  const [providerFilter, setProviderFilter] = createSignal('');
  const [tierFilter, setTierFilter] = createSignal('');
  const [costMin, setCostMin] = createSignal('');
  const [costMax, setCostMax] = createSignal('');
  const [recordingModalId, setRecordingModalId] = createSignal<string | null>(null);
  const closeDr = () => setRecordingModalId(null);
  onMount(() => window.addEventListener('sidebar-navigate', closeDr));
  onCleanup(() => window.removeEventListener('sidebar-navigate', closeDr));
  const [setupOpen, setSetupOpen] = createSignal(false);
  const [addAgentOpen, setAddAgentOpen] = createSignal(false);
  const [setupCompleted] = createSignal(
    !!localStorage.getItem(`setup_completed_${params.agentName}`),
  );

  const [feedbackModalOpen, setFeedbackModalOpen] = createSignal(false);
  const [feedbackMessageId, setFeedbackMessageId] = createSignal('');
  const [feedbackOverrides, setFeedbackOverrides] = createSignal<Record<string, string | null>>({});

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

  const [customProviders] = createResource(getCustomProviders);

  const [routingStatus] = createResource(
    () => params.agentName,
    (name) => getRoutingStatus(decodeURIComponent(name)),
  );

  const [specificityAssignments] = createResource(
    () => params.agentName,
    (name) => getSpecificityAssignments(decodeURIComponent(name)),
  );

  const [headerTiers] = createResource(
    () => params.agentName,
    (name) => listHeaderTiers(decodeURIComponent(name)),
  );

  const [agentProviders] = createResource(
    () => params.agentName,
    (name) => getProviders(decodeURIComponent(name)).catch(() => [] as RoutingProvider[]),
  );

  const [globalProviders] = createResource(
    () => true,
    async () => {
      try {
        const res = (await fetchJson('/providers')) as { providers: Array<{ provider: string }> };
        return res?.providers ?? [];
      } catch {
        return [];
      }
    },
  );

  const hasProviders = () => (globalProviders() ?? []).length > 0;

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

  createEffect(
    on([agentFilter, providerFilter, tierFilter, costMin, costMax], () => pager.resetPage(), {
      defer: true,
    }),
  );

  const [data, { refetch }] = createResource(
    () => ({
      provider: providerFilter(),
      tier: tierFilter(),
      costMin: costMin(),
      costMax: costMax(),
      agentName: agentFilter() || params.agentName,
      _ping: messagePing(),
      cursor: pager.currentCursor(),
      limit: pager.pageSize,
    }),
    (p) => {
      const q: Record<string, string> = {};
      if (p.provider) q.provider = p.provider;
      if (p.tier) {
        if (p.tier.startsWith(SPECIFICITY_FILTER_PREFIX)) {
          q.specificity_category = p.tier.slice(SPECIFICITY_FILTER_PREFIX.length);
        } else if (p.tier.startsWith(HEADER_TIER_FILTER_PREFIX)) {
          q.header_tier_id = p.tier.slice(HEADER_TIER_FILTER_PREFIX.length);
        } else {
          q.routing_tier = p.tier;
        }
      }
      if (p.costMin) q.cost_min = p.costMin;
      if (p.costMax) q.cost_max = p.costMax;
      if (p.agentName) q.agent_name = p.agentName;
      if (p.cursor) q.cursor = p.cursor;
      q.limit = String(p.limit);
      return getMessages(q) as Promise<MessagesData>;
    },
  );

  const displayedItems = createMemo<MessageRow[]>(() => {
    const items = data()?.items ?? [];
    if (isSelfHosted()) return items;
    const overrides = feedbackOverrides();
    return items.map((item) =>
      item.id in overrides ? { ...item, feedback_rating: overrides[item.id] ?? undefined } : item,
    );
  });

  createEffect(
    on(
      () => data(),
      (d) => {
        if (d) pager.recordResponse(d.next_cursor);
      },
    ),
  );

  const hasActiveFilters = () =>
    agentFilter() !== '' ||
    providerFilter() !== '' ||
    tierFilter() !== '' ||
    costMin() !== '' ||
    costMax() !== '';

  const hasNoData = () => {
    const d = data();
    return d && d.total_count === 0;
  };

  const showEmptyState = () => hasNoData() && !hasActiveFilters() && !hasProviders();
  const isFilteredEmpty = () => hasNoData() && hasActiveFilters();
  const showMessages = () => !hasNoData() || (hasProviders() && !hasActiveFilters());

  const clearFilters = () => {
    setAgentFilter('');
    setProviderFilter('');
    setTierFilter('');
    setCostMin('');
    setCostMax('');
  };

  const activeSpecificityCategories = createMemo(
    () =>
      new Set(
        (specificityAssignments() ?? [])
          .filter((assignment) => assignment.is_active)
          .map((assignment) => assignment.category),
      ),
  );

  const tierOptions = createMemo(() => [
    { label: 'All tiers', value: '' },
    ...ALL_TIERS.map((t) => ({ label: TIER_LABELS_ALL[t], value: t })),
    ...SPECIFICITY_STAGES.filter((stage) => activeSpecificityCategories().has(stage.id)).map(
      (stage) => ({
        label: stage.label,
        value: `${SPECIFICITY_FILTER_PREFIX}${stage.id}`,
      }),
    ),
    ...(headerTiers() ?? []).map((tier) => ({
      label: tier.name,
      value: `${HEADER_TIER_FILTER_PREFIX}${tier.id}`,
    })),
  ]);

  /** Resolve provider ID to display name */
  const providerDisplayName = (id: string): string => {
    const prov = PROVIDERS.find((p) => p.id === id);
    return prov?.name ?? id;
  };

  /** Build enriched provider connection options with logo + auth badge + name + label */
  const providerOptions = createMemo(() => {
    const providerIds = data()?.providers ?? [];
    const connections = agentProviders() ?? [];

    // Build a map from provider ID → first connection (for auth type display)
    const connectionByProvider = new Map<string, RoutingProvider>();
    for (const conn of connections) {
      if (!connectionByProvider.has(conn.provider)) {
        connectionByProvider.set(conn.provider, conn);
      }
    }

    const options: Array<{ label: string; value: string; render?: () => any }> = [
      { label: 'All provider connections', value: '' },
    ];

    for (const id of providerIds) {
      const name = providerDisplayName(id);
      const conn = connectionByProvider.get(id);

      options.push({
        label: name,
        value: id,
        render: () => (
          <span style="display: inline-flex; align-items: center; gap: 6px;">
            <span style="display: inline-flex; flex-shrink: 0; position: relative; color: hsl(var(--foreground));">
              {providerIcon(id, 14)}
              {conn ? authBadgeFor(conn.auth_type, 8) : null}
            </span>
            <span>{name}</span>
            {conn?.label && conn.label !== 'Default' && (
              <span style="color: hsl(var(--muted-foreground)); font-size: var(--font-size-xs);">
                {conn.label}
              </span>
            )}
          </span>
        ),
      });
    }
    return options;
  });

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
      <div
        class="page-header"
        style={showEmptyState() ? 'border-bottom: none; padding-bottom: 0;' : undefined}
      >
        <div>
          <h1>Messages</h1>
          <span class="breadcrumb">Full log of every LLM call. Filter by provider or cost.</span>
        </div>
        <Show when={!showEmptyState()}>
          <div class="header-controls">
            <Select
              value={agentFilter()}
              onChange={setAgentFilter}
              options={agentFilterOptions()}
            />
            <Select
              value={providerFilter()}
              onChange={setProviderFilter}
              options={providerOptions()}
            />
            <Select value={tierFilter()} onChange={setTierFilter} options={tierOptions()} />
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
          </div>
        </Show>
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
            <div style="display: flex; flex-direction: column; align-items: center; text-align: center; padding: 48px 24px; gap: 8px; width: 100%; background: hsl(var(--muted) / 0.45); border-radius: var(--radius);">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="32"
                height="32"
                fill="currentColor"
                viewBox="0 0 24 24"
                style="color: hsl(var(--muted-foreground)); margin-bottom: 4px;"
                aria-hidden="true"
              >
                <path d="M20 3H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h3v2c0 .36.19.69.51.87a1 1 0 0 0 1-.01L13.27 19h6.72c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2Zm0 14h-7c-.18 0-.36.05-.51.14L9 19.23V18c0-.55-.45-1-1-1H4V5h16z" />
                <path d="M6 9h3v2H6zm5 0h7v2h-7zm4 4h3v2h-3zm-9 0h7v2H6z" />
              </svg>
              <div style="font-size: var(--font-size-base); font-weight: 600; color: hsl(var(--foreground));">
                No messages yet
              </div>
              <div style="font-size: var(--font-size-sm); color: hsl(var(--muted-foreground)); margin-bottom: 8px;">
                <Show
                  when={agentList()?.length}
                  fallback="Set up your harness and connect a provider. Every LLM call shows up here."
                >
                  <Show
                    when={hasProviders()}
                    fallback="Connect a model provider to start routing your harness' LLM calls."
                  >
                    Every request sent through your harness will be recorded here.
                  </Show>
                </Show>
              </div>
              <Show
                when={agentList()?.length}
                fallback={
                  <button class="btn btn--primary btn--sm" onClick={() => setAddAgentOpen(true)}>
                    Set up harness
                  </button>
                }
              >
                <Show
                  when={hasProviders()}
                  fallback={
                    <button
                      class="btn btn--primary btn--sm"
                      onClick={() => navigate('/providers/subscriptions?add=true')}
                    >
                      Connect provider
                    </button>
                  }
                >
                  {/* No CTA needed — harness + providers are set up, just waiting for first request */}
                </Show>
              </Show>
            </div>
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
                  items={displayedItems()}
                  columns={columns()}
                  agentName={params.agentName}
                  customProviderName={customProviderName}
                  onFallbackErrorClick={scrollToFallbackSuccess}
                  onFeedbackLike={isSelfHosted() ? undefined : handleFeedbackLike}
                  onFeedbackDislike={isSelfHosted() ? undefined : handleFeedbackDislike}
                  onFeedbackClear={isSelfHosted() ? undefined : handleFeedbackClear}
                  onOpenRecording={(id) => setRecordingModalId(id)}
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

      <AddAgentModal open={addAgentOpen()} onClose={() => setAddAgentOpen(false)} />

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

      <RecordedMessageModal
        open={recordingModalId() !== null}
        messageId={recordingModalId()}
        onClose={() => setRecordingModalId(null)}
        onDeleted={() => refetch()}
      />
    </div>
  );
};

export default MessageLog;
