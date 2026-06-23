import { Meta, Title } from '@solidjs/meta';
import { A, useNavigate, useParams, useSearchParams } from '@solidjs/router';
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
  getAgents,
  getSpecificityAssignments,
  getMessages,
  getMessageFilterOptions,
  getRoutingStatus,
  listHeaderTiers,
  setMessageFeedback,
  clearMessageFeedback,
} from '../services/api.js';
import { createCursorPagination } from '../services/cursor-pagination.js';
import { preloadModelDisplayNames } from '../services/model-display.js';
import { PROVIDERS, SPECIFICITY_STAGES } from '../services/providers.js';
import { providerIcon } from '../components/ProviderIcon.jsx';
import { platformIcon } from 'manifest-shared';
import { ALL_TIERS, TIER_LABELS_ALL } from 'manifest-shared';
import { checkIsSelfHosted } from '../services/setup-status.js';
import { messagePing } from '../services/sse.js';
import '../styles/overview.css';
import '../styles/routing.css';
// The filtered-empty state here reuses .model-filter__empty classes, so this
// route imports model-filter.css directly (also imported by ModelPrices).
import '../styles/model-filter.css';

interface MessagesData {
  items: MessageRow[];
  next_cursor: string | null;
  total_count: number;
  total_count_exact?: boolean;
  providers: string[];
  provider_labels?: Record<string, string>;
}

interface MessageFilterOptionsData {
  providers: string[];
  provider_labels?: Record<string, string>;
}

interface AgentFilterOption {
  agent_name: string;
  agent_platform?: string | null;
  agent_category?: string | null;
}

const SPECIFICITY_FILTER_PREFIX = 'specificity:';
const HEADER_TIER_FILTER_PREFIX = 'header:';

const MessageLog: Component = () => {
  const params = useParams<{ agentName: string }>();
  const [searchParams] = useSearchParams<{ agent?: string }>();
  const navigate = useNavigate();

  preloadModelDisplayNames();
  const [isSelfHosted, setIsSelfHosted] = createSignal(false);
  onMount(() => {
    checkIsSelfHosted().then(setIsSelfHosted);
  });
  const columns = () => {
    const base = isSelfHosted()
      ? DETAILED_COLUMNS.filter((c) => c !== 'feedback')
      : DETAILED_COLUMNS;
    if (params.agentName) return base;
    // Global Messages spans every harness, so show which harness each row belongs to.
    const at = base.indexOf('model');
    return [...base.slice(0, at), 'agent' as const, ...base.slice(at)];
  };
  // Seed from ?agent= (set by AgentMessagesRedirect) so "View more" on a
  // harness overview lands pre-filtered; only meaningful in global mode —
  // when the route itself carries an agent, that param scopes the query.
  const [agentFilter, setAgentFilter] = createSignal(
    !params.agentName && typeof searchParams.agent === 'string' ? searchParams.agent : '',
  );
  createEffect(
    on(
      () => searchParams.agent,
      (agent) => setAgentFilter(typeof agent === 'string' ? agent : ''),
      { defer: true },
    ),
  );
  const [agentListRaw] = createResource(
    () => !params.agentName,
    async (isGlobal) => {
      if (!isGlobal) return [] as AgentFilterOption[];
      // includePlayground=true so the reserved Playground agent appears in the
      // filter and the log can be narrowed to Playground runs.
      const data = (await getAgents(true)) as
        | { agents?: AgentFilterOption[] }
        | AgentFilterOption[];
      return (Array.isArray(data) ? data : (data?.agents ?? [])) as AgentFilterOption[];
    },
  );
  const agentList = createMemo(() => (agentListRaw() ?? []).map((a) => a.agent_name).sort());
  const agentPlatformMap = createMemo(() => {
    const map = new Map<string, { platform: string | null; category: string | null }>();
    for (const a of agentListRaw() ?? []) {
      map.set(a.agent_name, {
        platform: a.agent_platform ?? null,
        category: a.agent_category ?? null,
      });
    }
    return map;
  });
  const agentFilterOptions = createMemo(() => [
    { label: 'All harnesses', value: '' },
    ...(agentList() ?? []).map((a) => {
      const info = agentPlatformMap().get(a);
      const iconPath = info?.platform ? platformIcon(info.platform, info.category) : null;
      return {
        label: a,
        value: a,
        icon: iconPath ? (
          <img src={iconPath} alt="" width="14" height="14" style="border-radius: 3px;" />
        ) : (
          <span style="display: inline-block; width: 14px; height: 14px;" />
        ),
      };
    }),
  ]);
  const [providerFilter, setProviderFilter] = createSignal('');
  const [tierFilter, setTierFilter] = createSignal('');
  const [costMin, setCostMin] = createSignal('');
  const [costMax, setCostMax] = createSignal('');
  const [setupOpen, setSetupOpen] = createSignal(false);
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

  const hasProviders = () => routingStatus()?.enabled === true;

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
      q.include_total = 'false';
      q.include_filter_options = 'false';
      return getMessages(q) as Promise<MessagesData>;
    },
  );

  const [messageFilterOptions] = createResource(
    () => ({ agentName: agentFilter() || params.agentName, _ping: messagePing() }),
    (p) => {
      const q: Record<string, string> = {};
      if (p.agentName) q.agent_name = p.agentName;
      return getMessageFilterOptions(q) as Promise<MessageFilterOptionsData>;
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

  const totalForPager = () => {
    const d = data();
    if (!d) return 0;
    if (d.total_count_exact !== false) return d.total_count;
    return (pager.currentPage() - 1) * pager.pageSize + d.total_count;
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
    if (id === 'manifest') return 'Manifest';
    const prov = PROVIDERS.find((p) => p.id === id);
    if (prov) return prov.name;
    // Custom providers arrive as `custom:<uuid>` — the backend ships a label
    // map alongside the provider list so the dropdown can show their names.
    return messageFilterOptions()?.provider_labels?.[id] ?? id;
  };

  const providerOptions = createMemo(() => [
    { label: 'All providers', value: '' },
    ...(messageFilterOptions()?.providers ?? []).map((id) => ({
      label: providerDisplayName(id),
      icon: providerIcon(id, 14) ?? undefined,
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
        {params.agentName
          ? `${agentDisplayName() ?? decodeURIComponent(params.agentName)} Messages - Manifest`
          : 'Messages - Manifest'}
      </Title>
      <Meta
        name="description"
        content={
          params.agentName
            ? `Browse all messages sent and received by ${agentDisplayName() ?? decodeURIComponent(params.agentName)}. Filter by provider or cost.`
            : 'Browse all messages across all harnesses. Filter by provider or cost.'
        }
      />
      <div class="page-header">
        <div>
          <h1>Messages</h1>
          <span class="breadcrumb">Full log of every LLM call. Filter by provider or cost.</span>
        </div>
        <div class="header-controls">
          <Show when={!showEmptyState()}>
            <Show when={!params.agentName}>
              <Select
                value={agentFilter()}
                onChange={setAgentFilter}
                options={agentFilterOptions()}
              />
            </Show>
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
          </Show>
          <Show when={showEmptyState() && !!params.agentName && !setupCompleted()}>
            <button class="btn btn--primary btn--sm" onClick={() => setSetupOpen(true)}>
              Set up harness
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
              when={params.agentName && setupCompleted()}
              fallback={
                <div class="empty-state">
                  <div class="empty-state__title">No messages yet</div>
                  <Show
                    when={params.agentName}
                    fallback={
                      <>
                        <p>Create a harness and send a message. Every LLM call shows up here.</p>
                        <A
                          href="/harnesses"
                          class="btn btn--primary btn--sm"
                          style="margin-top: var(--gap-md);"
                        >
                          Go to Harnesses
                        </A>
                      </>
                    }
                  >
                    <p>Set up your harness and send a message. Every LLM call shows up here.</p>
                    <button
                      class="btn btn--primary btn--sm"
                      style="margin-top: var(--gap-md);"
                      onClick={() => setSetupOpen(true)}
                    >
                      Set up harness
                    </button>
                  </Show>
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
                    navigate(`/harnesses/${encodeURIComponent(params.agentName)}/routing`, {
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
                  {totalForPager()} total
                </span>
              </div>
              <div class="data-table-scroll">
                <MessageTable
                  items={displayedItems()}
                  columns={columns()}
                  agentName={params.agentName}
                  customProviderName={() => undefined}
                  agentPlatformLookup={(name) => agentPlatformMap().get(name)}
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
                totalItems={totalForPager}
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

      <Show when={!!params.agentName}>
        <SetupModal
          open={setupOpen()}
          agentName={decodeURIComponent(params.agentName)}
          agentPlatform={agentPlatform()}
          agentCategory={agentCategory()}
          onClose={() => setSetupOpen(false)}
        />
      </Show>

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
