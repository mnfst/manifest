import { Title } from '@solidjs/meta';
import { toggleScrollFade } from '../services/scroll-fade.js';
import { A, useNavigate, useSearchParams } from '@solidjs/router';
import {
  createResource,
  createSignal,
  createMemo,
  createEffect,
  on,
  For,
  Show,
  type Component,
} from 'solid-js';
import AddAgentModal from '../components/AddAgentModal.jsx';
import UpgradeSuccessModal from '../components/UpgradeSuccessModal.jsx';
import { markPlanChosen } from '../services/plan-selection.js';
import { authClient } from '../services/auth-client.js';
import {
  getAgents,
  getGlobalProviders,
  getGlobalProviderUsage,
  mergeUsage,
} from '../services/api.js';
import { checkIsSelfHosted } from '../services/setup-status.js';
import { customProviderColor } from '../services/formatters.js';
import { customProviderLogo } from '../components/ProviderIcon.jsx';
import { stripCustomPrefix } from '../services/routing-utils.js';
import {
  getOverview,
  getOverviewAgentUsage,
  getOverviewProviderUsage,
} from '../services/api/analytics.js';
import { getBillingStatus } from '../services/api/billing.js';
import { formatNumber, formatCost } from '../services/formatters.js';
import { providerIcon } from '../components/ProviderIcon.jsx';
import { preloadModelDisplayNames } from '../services/model-display.js';
import { PROVIDERS } from '../services/providers.js';
import { AGENT_COLORS } from '../components/MultiAgentTokenChart.jsx';
import ProviderChartCard from '../components/ProviderChartCard.jsx';
import SocialFollowBanner from '../components/SocialFollowBanner.jsx';
import Sparkline from '../components/Sparkline.jsx';
import FilterSelect from '../components/FilterSelect.jsx';
import Select from '../components/Select.jsx';
import { authLabel, authBadgeFor } from '../components/AuthBadge.jsx';
import { platformIcon } from 'manifest-shared';
import GlobalOverviewSkeleton from '../components/GlobalOverviewSkeleton.jsx';
import MessageTable from '../components/MessageTable.jsx';
import {
  COMPACT_COLUMNS,
  type MessageColumnKey,
  type MessageRow,
} from '../components/message-table-types.js';
import { agentPing, messagePing, routingPing } from '../services/sse.js';
import '../styles/overview.css';
import '../styles/charts.css';
import '../styles/analytics-overview.css';
import '../styles/routing.css';

interface ProviderGroup {
  provider: string;
  auth_type: string;
  /** Backend-resolved name for `custom:<uuid>` groups; null for built-ins. */
  display_name?: string | null;
  connection_count: number;
  connections: Array<{ id: string; label: string; is_active: boolean }>;
  total_models: number;
  consumption_tokens: number;
  consumption_messages: number;
  consumption_cost: number;
  last_used_at: string | null;
  sparkline_7d: number[];
}

interface CostByModelRow {
  model: string;
  display_name: string;
  tokens: number;
  share_pct: number;
  estimated_cost: number;
  auth_type: string | null;
  provider: string | null;
  custom_provider_name?: string | null;
}

interface OverviewResponse {
  summary: {
    tokens_today: { value: number; trend_pct: number };
    cost_today: { value: number; trend_pct: number };
    messages: { value: number; trend_pct: number };
  };
  token_usage: Array<{ hour?: string; date?: string; input_tokens: number; output_tokens: number }>;
  message_usage: Array<{ hour?: string; date?: string; count: number }>;
  cost_by_model: CostByModelRow[];
  recent_activity: MessageRow[];
  has_data: boolean;
  has_providers: boolean;
}

interface AgentRow {
  agent_name: string;
  display_name: string;
  agent_category: string | null;
  agent_platform: string | null;
  message_count: number;
  total_tokens: number;
  sparkline: number[];
}

const RANGE_OPTIONS = [
  { label: 'Last 24 hours', value: '24h' },
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'Last 90 days', value: '90d' },
  { label: 'Last 365 days', value: '365d' },
];
const PRO_DASHBOARD_RANGES = new Set(['30d', '90d', '365d']);

const GROUP_OPTIONS = [
  { label: 'By provider', value: 'provider' },
  { label: 'By harness', value: 'agent' },
];

const RANGE_STORAGE_KEY = 'manifest_global_range';
const GROUP_STORAGE_KEY = 'manifest_global_group';

function loadRange(): string {
  try {
    const v = localStorage.getItem(RANGE_STORAGE_KEY);
    if (v === '24h' || v === '7d' || v === '30d' || v === '90d' || v === '365d') return v;
  } catch {
    /* ignore */
  }
  return '7d';
}

const GlobalOverview: Component = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const session = authClient.useSession();
  const isUpgraded = searchParams.upgraded === '1';
  if (isUpgraded) {
    const uid = session()?.data?.user?.id;
    if (uid) markPlanChosen(uid);
  }
  const [upgradeModalOpen, setUpgradeModalOpen] = createSignal(isUpgraded);

  const closeUpgradeModal = () => {
    setUpgradeModalOpen(false);
    window.history.replaceState(null, '', '/overview');
    if (hasNoAgents() && !sessionStorage.getItem(ONBOARDING_DISMISSED_KEY)) {
      setAddAgentOpen(true);
    }
  };

  preloadModelDisplayNames();

  const [billing] = createResource(async () => {
    try {
      return await getBillingStatus();
    } catch {
      return null;
    }
  });
  const isFreePlan = () => billing()?.enabled && billing()?.plan === 'free';
  const shouldLockProRanges = () => billing.loading || isFreePlan();
  const isProRangeLocked = (range: string) =>
    shouldLockProRanges() && PRO_DASHBOARD_RANGES.has(range);

  // ── Range state (persisted in localStorage) ──────────────────────────
  const [chartRange, setChartRangeRaw] = createSignal(loadRange());
  const setChartRange = (v: string) => {
    if (isFreePlan() && PRO_DASHBOARD_RANGES.has(v)) return;
    setChartRangeRaw(v);
    try {
      localStorage.setItem(RANGE_STORAGE_KEY, v);
    } catch {
      /* ignore */
    }
  };

  // ── Group by state (persisted in localStorage) ───────────────────────
  const loadGroup = (): string => {
    try {
      const v = localStorage.getItem(GROUP_STORAGE_KEY);
      if (v === 'provider' || v === 'agent') return v;
    } catch {
      /* ignore */
    }
    return 'provider';
  };
  const [groupBy, setGroupByRaw] = createSignal(loadGroup());
  const setGroupBy = (v: string) => {
    setGroupByRaw(v);
    try {
      localStorage.setItem(GROUP_STORAGE_KEY, v);
    } catch {
      /* ignore */
    }
  };

  // ── Chart view state ─────────────────────────────────────────────────
  const [chartView, setChartView] = createSignal<'messages' | 'tokens' | 'cost'>('tokens');

  // Local providers only exist on self-hosted installs; cloud hides the
  // Local stat card and drops the stats grid to three columns.
  const [selfHosted] = createResource(checkIsSelfHosted);
  const effectiveChartRange = createMemo(() =>
    isProRangeLocked(chartRange()) ? '7d' : chartRange(),
  );
  const proBadge = () => (
    <span class="pro-range-badge" aria-label="Pro plan required">
      PRO
    </span>
  );
  const rangeOptions = () =>
    RANGE_OPTIONS.map((option) =>
      isProRangeLocked(option.value) ? { ...option, disabled: true, badge: proBadge() } : option,
    );
  createEffect(() => {
    if (isFreePlan() && PRO_DASHBOARD_RANGES.has(chartRange())) {
      setChartRange('7d');
    }
  });

  // ── Data resources (5 parallel) ──────────────────────────────────────
  const [overview] = createResource(
    () => ({ range: effectiveChartRange(), _ping: messagePing() }),
    (p) => getOverview(p.range) as Promise<OverviewResponse>,
  );

  const [agents] = createResource(
    () => ({ _agentPing: agentPing(), _messagePing: messagePing() }),
    async () => {
      try {
        const data = (await getAgents()) as { agents?: AgentRow[] } | AgentRow[] | null;
        return Array.isArray(data) ? data : (data?.agents ?? []);
      } catch {
        return [] as AgentRow[];
      }
    },
  );

  // CONFIG resource — paints the provider table immediately (cheap endpoint).
  // Provider rows/status are routing-domain state: a connect/disconnect/rename
  // emits a `routing` SSE event (→ routingPing), so the config list must key on
  // routingPing to stay fresh. agentPing is kept because a new/removed agent can
  // also change which providers appear in the global view.
  const [providerConfig] = createResource(
    () => ({ a: agentPing(), r: routingPing() }),
    async () => {
      try {
        return (await getGlobalProviders()).providers;
      } catch {
        return [];
      }
    },
  );

  // USAGE resource — the expensive 30d aggregation, fetched independently. Its
  // source carries the SSE ping signals (a new ingested message → messagePing,
  // a provider connect/disconnect/rename → routingPing) so stats refresh live.
  const [providerUsage] = createResource(
    () => ({ m: messagePing(), r: routingPing() }),
    async () => {
      try {
        return (await getGlobalProviderUsage()).providers;
      } catch {
        return [];
      }
    },
  );

  // Shimmer the usage cells until the first usage load resolves; SSE refetches
  // keep the prior numbers on screen so the table doesn't flicker.
  const providerUsageLoading = () => providerUsage.loading && providerUsage() === undefined;

  // Merged groups (config + usage by provider+auth_type) drive the table.
  // `providers()` stays `undefined` until config resolves so the existing
  // `providers() !== undefined` "has loaded" checks keep working.
  const providers = () => {
    const config = providerConfig();
    if (config === undefined) return undefined;
    return mergeUsage(config, providerUsage()) as unknown as ProviderGroup[];
  };

  type TSResult = { agents: string[]; timeseries: Array<Record<string, number | string>> };
  type UsageTSResult = { tokenUsage: TSResult; messageUsage: TSResult; costUsage: TSResult };
  const usageFetcher = (range: string, group: string): Promise<UsageTSResult> => {
    if (group === 'provider') return getOverviewProviderUsage(range) as Promise<UsageTSResult>;
    return getOverviewAgentUsage(range) as Promise<UsageTSResult>;
  };

  const [usageTimeseries] = createResource(
    () => ({ range: effectiveChartRange(), group: groupBy(), _ping: messagePing() }),
    (p) => usageFetcher(p.range, p.group),
  );

  // Provider-grouped series key custom providers as 'custom:<uuid>'. Remap
  // those keys to the provider's display name so the filter, legend, and
  // tooltip read like every other provider. Reactive to customProviderData,
  // so names fill in once that resource resolves.
  const displaySeriesName = (key: string) => {
    const name = key.startsWith('custom:')
      ? (providers()?.find((g) => g.provider === key)?.display_name ?? null)
      : null;
    // 'hour'/'date' are the row's bucket columns — never let a custom
    // provider named like them clobber the axis.
    return name && name !== 'hour' && name !== 'date' ? name : key;
  };
  const remapCustomSeries = (raw: TSResult | undefined): TSResult | undefined => {
    if (!raw || !raw.agents.some((a) => a.startsWith('custom:'))) return raw;
    return {
      agents: raw.agents.map(displaySeriesName),
      timeseries: raw.timeseries.map((row) =>
        Object.fromEntries(Object.entries(row).map(([k, v]) => [displaySeriesName(k), v])),
      ),
    };
  };
  const tokenSeries = createMemo(() => remapCustomSeries(usageTimeseries()?.tokenUsage));
  const messageSeries = createMemo(() => remapCustomSeries(usageTimeseries()?.messageUsage));
  const costSeries = createMemo(() => remapCustomSeries(usageTimeseries()?.costUsage));

  // ── Harness filter state (sessionStorage) ────────────────────────────
  // Scope the persisted selection by groupBy(): the provider grouping and the
  // harness grouping list completely different series, so a single shared set
  // would carry harness names into provider mode (and vice versa), filtering
  // out every series and blanking the chart. A per-grouping key keeps each
  // mode's selection independent.
  const storageKey = () => `global-agent-filter:${groupBy()}`;
  const loadSavedAgents = (key: string): Set<string> => {
    try {
      const saved = sessionStorage.getItem(key);
      if (saved) return new Set(JSON.parse(saved) as string[]);
    } catch {
      /* ignore */
    }
    return new Set();
  };
  const [selectedAgents, setSelectedAgents] = createSignal<Set<string>>(
    loadSavedAgents(storageKey()),
  );
  // When the grouping changes, reload the selection persisted for that grouping
  // (defaulting to "all selected" when none was saved for it).
  createEffect(
    on(
      () => groupBy(),
      () => setSelectedAgents(loadSavedAgents(storageKey())),
      { defer: true },
    ),
  );
  const allAgents = createMemo(() => {
    const tokenAgents = tokenSeries()?.agents ?? [];
    const msgAgents = messageSeries()?.agents ?? [];
    const costAgents = costSeries()?.agents ?? [];
    const set = new Set([...tokenAgents, ...msgAgents, ...costAgents]);
    return [...set].sort();
  });

  const agentColorMap = createMemo(() => {
    const map: Record<string, string> = {};
    const list = allAgents();
    for (let i = 0; i < list.length; i++) {
      map[list[i]!] = AGENT_COLORS[i % AGENT_COLORS.length]!;
    }
    return map;
  });

  const effectiveSelected = () => {
    const sel = selectedAgents();
    const all = allAgents();
    if (all.length === 0) return sel;
    // Prune the persisted selection against the series actually present for the
    // current grouping. If nothing intersects (e.g. a stale set left over from
    // the other grouping, or an empty selection), fall back to "all selected"
    // so the chart never renders blank.
    const pruned = new Set(all.filter((a) => sel.has(a)));
    if (pruned.size === 0) return new Set(all);
    return pruned;
  };

  const toggleAgent = (agent: string) => {
    const current = effectiveSelected();
    const next = new Set(current);
    if (next.has(agent)) {
      next.delete(agent);
    } else {
      next.add(agent);
    }
    setSelectedAgents(next);
    try {
      sessionStorage.setItem(storageKey(), JSON.stringify([...next]));
    } catch {
      /* ignore */
    }
  };

  const filteredAgentTimeseries = createMemo(() => {
    const raw = tokenSeries();
    if (!raw) return undefined;
    const sel = effectiveSelected();
    if (sel.size === 0) return raw;
    const filtered_agents = raw.agents.filter((a) => sel.has(a));
    const timeseries = raw.timeseries.map((row) => {
      const filtered: Record<string, number | string> = {};
      for (const [k, v] of Object.entries(row)) {
        if (k === 'hour' || k === 'date' || sel.has(k)) filtered[k] = v;
      }
      return filtered;
    });
    return { agents: filtered_agents, timeseries };
  });

  const filteredAgentMessageTimeseries = createMemo(() => {
    const raw = messageSeries();
    if (!raw) return undefined;
    const sel = effectiveSelected();
    if (sel.size === 0) return raw;
    const filtered_agents = raw.agents.filter((a) => sel.has(a));
    const timeseries = raw.timeseries.map((row) => {
      const filtered: Record<string, number | string> = {};
      for (const [k, v] of Object.entries(row)) {
        if (k === 'hour' || k === 'date' || sel.has(k)) filtered[k] = v;
      }
      return filtered;
    });
    return { agents: filtered_agents, timeseries };
  });

  const filteredAgentCostTimeseries = createMemo(() => {
    const raw = costSeries();
    if (!raw) return undefined;
    const sel = effectiveSelected();
    if (sel.size === 0) return raw;
    const filtered_agents = raw.agents.filter((a: string) => sel.has(a));
    const timeseries = raw.timeseries.map((row: Record<string, number | string>) => {
      const filtered: Record<string, number | string> = {};
      for (const [k, v] of Object.entries(row)) {
        if (k === 'hour' || k === 'date' || sel.has(k)) filtered[k] = v;
      }
      return filtered;
    });
    return { agents: filtered_agents, timeseries };
  });

  // ── Derived data ─────────────────────────────────────────────────────
  const agentList = () => (agents() ?? []) as AgentRow[];
  const providerList = () => (providers() ?? []) as ProviderGroup[];

  const sortedAgents = createMemo(() => {
    return [...agentList()].sort((a, b) => (b.total_tokens ?? 0) - (a.total_tokens ?? 0));
  });

  // Onboarding: detect empty states
  const hasNoAgents = () => agents() !== undefined && agentList().length === 0;
  const hasNoProviders = () => providers() !== undefined && providerList().length === 0;

  // Auto-open the Create Harness modal for first-time users (once per session)
  const ONBOARDING_DISMISSED_KEY = 'overview_onboarding_dismissed';
  const [addAgentOpen, setAddAgentOpen] = createSignal(false);
  const dismissAddAgent = () => {
    setAddAgentOpen(false);
    try {
      sessionStorage.setItem(ONBOARDING_DISMISSED_KEY, '1');
    } catch {
      /* ignore */
    }
  };
  createEffect(
    on(
      () => hasNoAgents(),
      (empty) => {
        if (empty && !sessionStorage.getItem(ONBOARDING_DISMISSED_KEY) && !upgradeModalOpen()) {
          setAddAgentOpen(true);
        }
      },
      { defer: true },
    ),
  );

  return (
    <div class="container--lg">
      <Title>Overview | Manifest</Title>

      {/* Add Harness Modal */}
      <AddAgentModal open={addAgentOpen()} onClose={dismissAddAgent} />
      <UpgradeSuccessModal open={upgradeModalOpen()} onClose={closeUpgradeModal} />

      <SocialFollowBanner />

      {/* ── 1. Page Header ──────────────────────────────────────────── */}
      <div class="page-header" style="border-bottom: none; padding-bottom: 0;">
        <div>
          <h1 class="page-header__title">Overview</h1>
          <p class="page-header__subtitle">All your harnesses and providers</p>
        </div>
        <Show when={!hasNoAgents() || !hasNoProviders()}>
          <div style="display: flex; align-items: center; gap: 8px;">
            <Select value={groupBy()} onChange={setGroupBy} options={GROUP_OPTIONS} />
            <Show when={allAgents().length > 1}>
              <FilterSelect
                noun={groupBy() === 'provider' ? 'providers' : 'harnesses'}
                items={allAgents()}
                selected={effectiveSelected()}
                colorMap={agentColorMap()}
                onToggle={toggleAgent}
                onSelectAll={() => {
                  setSelectedAgents(new Set(allAgents()));
                  try {
                    sessionStorage.setItem(storageKey(), JSON.stringify([...allAgents()]));
                  } catch {
                    /* ignore */
                  }
                }}
                onUnselectAll={() => {
                  setSelectedAgents(new Set<string>());
                  try {
                    sessionStorage.setItem(storageKey(), JSON.stringify([]));
                  } catch {
                    /* ignore */
                  }
                }}
              />
            </Show>
            <Select value={chartRange()} onChange={setChartRange} options={rangeOptions()} />
          </div>
        </Show>
      </div>

      {/* Onboarding empty state: replaces all dashboard content */}
      <Show when={hasNoAgents() && hasNoProviders()}>
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
            <path d="M4 2H2v19c0 .55.45 1 1 1h19v-2H4z" />
            <path d="M11 18c.55 0 1-.45 1-1V6c0-.55-.45-1-1-1H7c-.55 0-1 .45-1 1v11c0 .55.45 1 1 1zm-1-2H8v-2h2zm0-9v5H8V7zm9 11c.55 0 1-.45 1-1V3c0-.55-.45-1-1-1h-4c-.55 0-1 .45-1 1v14c0 .55.45 1 1 1zm-1-2h-2v-6h2zM16 4h2v4h-2z" />
          </svg>
          <div style="font-size: var(--font-size-base); font-weight: 600; color: hsl(var(--foreground));">
            No activity yet
          </div>
          <div style="font-size: var(--font-size-sm); color: hsl(var(--muted-foreground)); margin-bottom: 8px;">
            Set up your harness and connect at least one provider. Once your harness sends requests,
            data will appear here.
          </div>
          <button class="btn btn--primary btn--sm" onClick={() => setAddAgentOpen(true)}>
            Set up harness
          </button>
        </div>
      </Show>

      <Show when={!hasNoAgents() && hasNoProviders()}>
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
            <path d="M4 2H2v19c0 .55.45 1 1 1h19v-2H4z" />
            <path d="M11 18c.55 0 1-.45 1-1V6c0-.55-.45-1-1-1H7c-.55 0-1 .45-1 1v11c0 .55.45 1 1 1zm-1-2H8v-2h2zm0-9v5H8V7zm9 11c.55 0 1-.45 1-1V3c0-.55-.45-1-1-1h-4c-.55 0-1 .45-1 1v14c0 .55.45 1 1 1zm-1-2h-2v-6h2zM16 4h2v4h-2z" />
          </svg>
          <div style="font-size: var(--font-size-base); font-weight: 600; color: hsl(var(--foreground));">
            No providers connected
          </div>
          <div style="font-size: var(--font-size-sm); color: hsl(var(--muted-foreground)); margin-bottom: 8px;">
            Connect a model provider to start routing your harnesses' LLM calls.
          </div>
          <A
            href="/providers/subscriptions"
            class="btn btn--primary btn--sm"
            style="text-decoration: none;"
          >
            Connect provider
          </A>
        </div>
      </Show>

      {/* Dashboard content: hidden when fully empty */}
      <Show
        when={
          !hasNoAgents() &&
          !hasNoProviders() &&
          overview() !== undefined &&
          agents() !== undefined &&
          providers() !== undefined
        }
        fallback={
          <Show when={!hasNoAgents() && !hasNoProviders()}>
            <GlobalOverviewSkeleton />
          </Show>
        }
      >
        {/* ── 2. Chart Card ───────────────────────────────────────────── */}
        <div style="margin-bottom: 24px;">
          {(() => {
            // The enclosing Show guarantees overview() is defined here.
            const o = () => overview()!;
            return (
              <ProviderChartCard
                activeView={chartView()}
                onViewChange={setChartView}
                messagesValue={o().summary.messages.value}
                messagesTrendPct={o().summary.messages.trend_pct}
                tokensValue={o().summary.tokens_today.value}
                tokensTrendPct={o().summary.tokens_today.trend_pct}
                costValue={o().summary.cost_today.value}
                costTrendPct={o().summary.cost_today.trend_pct}
                costInfoTooltip="Actual API key costs only. Subscription usage is not included."
                range={effectiveChartRange()}
                agentTimeseries={filteredAgentTimeseries() ?? undefined}
                agentMessageTimeseries={filteredAgentMessageTimeseries() ?? undefined}
                agentCostTimeseries={filteredAgentCostTimeseries() ?? undefined}
                colorMap={agentColorMap()}
              />
            );
          })()}
        </div>

        {/* ── 3. Summary Stat Cards (4 columns) ────────────────────── */}
        {(() => {
          const subs = () => providerList().filter((g) => g.auth_type === 'subscription');
          const byok = () => providerList().filter((g) => g.auth_type === 'api_key');
          const local = () => providerList().filter((g) => g.auth_type === 'local');
          const totalConns = (list: ProviderGroup[]) =>
            list.reduce((s, g) => s + g.connections.length, 0);
          const connList = (groups: ProviderGroup[]) => {
            const items: Array<{
              id: string;
              icon: string;
              name: string;
              label: string;
              isCustom: boolean;
            }> = [];
            for (const g of groups) {
              for (const c of g.connections.slice(0, 5 - items.length)) {
                const prov = PROVIDERS.find((p) => p.id === g.provider);
                const customName = g.display_name ?? null;
                const isCustom = g.provider.startsWith('custom:');
                items.push({
                  id: c.id,
                  icon: g.provider,
                  name: prov?.name ?? customName ?? g.provider,
                  label: c.label,
                  isCustom,
                });
                if (items.length >= 5) break;
              }
              if (items.length >= 5) break;
            }
            return items;
          };
          const cardStyle = 'display: flex; flex-direction: column; padding: 20px;';
          return (
            <div
              class="overview-stats"
              style={`grid-template-columns: repeat(${selfHosted() ? 4 : 3}, 1fr); align-items: stretch;`}
            >
              <div class="overview-stat-card" style={cardStyle}>
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                  <span class="overview-stat-card__label">Subscriptions</span>
                  <A
                    href="/providers/subscriptions"
                    class="btn btn--outline btn--sm"
                    style="font-size: var(--font-size-xs); padding: 2px 10px; height: 24px; text-decoration: none;"
                  >
                    + Add
                  </A>
                </div>
                <span class="overview-stat-card__value" style="margin-bottom: 12px;">
                  {totalConns(subs())}
                </span>
                <div style="display: flex; flex-direction: column; gap: 6px; flex: 1;">
                  <For each={connList(subs())}>
                    {(item) => (
                      <A
                        href={`/providers/connections/${item.id}`}
                        style="display: flex; align-items: center; gap: 8px; text-decoration: none; font-size: var(--font-size-xs); color: hsl(var(--muted-foreground));"
                      >
                        <span style="flex-shrink: 0; display: flex; align-items: center;">
                          {providerIcon(item.icon, 14) ?? customProviderLogo(item.name, 14) ?? (
                            <span
                              style={{
                                display: 'inline-flex',
                                'align-items': 'center',
                                'justify-content': 'center',
                                width: '14px',
                                height: '14px',
                                'border-radius': '3px',
                                'font-size': '9px',
                                'font-weight': '600',
                                color: 'white',
                                background: customProviderColor(item.name),
                              }}
                            >
                              {item.name.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </span>
                        <span style="font-weight: 500; color: hsl(var(--foreground));">
                          {item.name}
                        </span>
                        <Show when={item.isCustom}>
                          <span style="font-size: 10px; font-weight: 500; color: hsl(var(--muted-foreground)); background: hsl(var(--muted)); padding: 1px 6px; border-radius: var(--radius-sm);">
                            custom
                          </span>
                        </Show>
                        <Show when={item.label !== 'Default'}>
                          <span>{item.label}</span>
                        </Show>
                      </A>
                    )}
                  </For>
                </div>
                <div style="display: flex; justify-content: flex-end; margin-top: 12px;">
                  <A href="/providers/subscriptions" class="view-more-link">
                    View more
                  </A>
                </div>
              </div>
              <div class="overview-stat-card" style={cardStyle}>
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                  <span class="overview-stat-card__label">Usage-based</span>
                  <A
                    href="/providers/usage-based"
                    class="btn btn--outline btn--sm"
                    style="font-size: var(--font-size-xs); padding: 2px 10px; height: 24px; text-decoration: none;"
                  >
                    + Add
                  </A>
                </div>
                <span class="overview-stat-card__value" style="margin-bottom: 12px;">
                  {totalConns(byok())}
                </span>
                <div style="display: flex; flex-direction: column; gap: 6px; flex: 1;">
                  <For each={connList(byok())}>
                    {(item) => (
                      <A
                        href={`/providers/connections/${item.id}`}
                        style="display: flex; align-items: center; gap: 8px; text-decoration: none; font-size: var(--font-size-xs); color: hsl(var(--muted-foreground));"
                      >
                        <span style="flex-shrink: 0; display: flex; align-items: center;">
                          {providerIcon(item.icon, 14) ?? customProviderLogo(item.name, 14) ?? (
                            <span
                              style={{
                                display: 'inline-flex',
                                'align-items': 'center',
                                'justify-content': 'center',
                                width: '14px',
                                height: '14px',
                                'border-radius': '3px',
                                'font-size': '9px',
                                'font-weight': '600',
                                color: 'white',
                                background: customProviderColor(item.name),
                              }}
                            >
                              {item.name.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </span>
                        <span style="font-weight: 500; color: hsl(var(--foreground));">
                          {item.name}
                        </span>
                        <Show when={item.isCustom}>
                          <span style="font-size: 10px; font-weight: 500; color: hsl(var(--muted-foreground)); background: hsl(var(--muted)); padding: 1px 6px; border-radius: var(--radius-sm);">
                            custom
                          </span>
                        </Show>
                        <Show when={item.label !== 'Default'}>
                          <span>{item.label}</span>
                        </Show>
                      </A>
                    )}
                  </For>
                </div>
                <div style="display: flex; justify-content: flex-end; margin-top: 12px;">
                  <A href="/providers/usage-based" class="view-more-link">
                    View more
                  </A>
                </div>
              </div>
              <Show when={selfHosted()}>
                <div class="overview-stat-card" style={cardStyle}>
                  <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                    <span class="overview-stat-card__label">Local</span>
                    <A
                      href="/providers/local"
                      class="btn btn--outline btn--sm"
                      style="font-size: var(--font-size-xs); padding: 2px 10px; height: 24px; text-decoration: none;"
                    >
                      + Add
                    </A>
                  </div>
                  <span class="overview-stat-card__value" style="margin-bottom: 12px;">
                    {totalConns(local())}
                  </span>
                  <div style="display: flex; flex-direction: column; gap: 6px; flex: 1;">
                    <For each={connList(local())}>
                      {(item) => (
                        <A
                          href={`/providers/connections/${item.id}`}
                          style="display: flex; align-items: center; gap: 8px; text-decoration: none; font-size: var(--font-size-xs); color: hsl(var(--muted-foreground));"
                        >
                          <span style="flex-shrink: 0; display: flex; align-items: center;">
                            {providerIcon(item.icon, 14) ?? customProviderLogo(item.name, 14) ?? (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  'align-items': 'center',
                                  'justify-content': 'center',
                                  width: '14px',
                                  height: '14px',
                                  'border-radius': '3px',
                                  'font-size': '9px',
                                  'font-weight': '600',
                                  color: 'white',
                                  background: customProviderColor(item.name),
                                }}
                              >
                                {item.name.charAt(0).toUpperCase()}
                              </span>
                            )}
                          </span>
                          <span style="font-weight: 500; color: hsl(var(--foreground));">
                            {item.name}
                          </span>
                          <Show when={item.isCustom}>
                            <span style="font-size: 10px; font-weight: 500; color: hsl(var(--muted-foreground)); background: hsl(var(--muted)); padding: 1px 6px; border-radius: var(--radius-sm);">
                              custom
                            </span>
                          </Show>
                          <Show when={item.label !== 'Default'}>
                            <span>{item.label}</span>
                          </Show>
                        </A>
                      )}
                    </For>
                  </div>
                  <div style="display: flex; justify-content: flex-end; margin-top: 12px;">
                    <A href="/providers/local" class="view-more-link">
                      View more
                    </A>
                  </div>
                </div>
              </Show>
              <div class="overview-stat-card" style={cardStyle}>
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                  <span class="overview-stat-card__label">Harnesses</span>
                  <A
                    href="/harnesses?add=true"
                    class="btn btn--outline btn--sm"
                    style="font-size: var(--font-size-xs); padding: 2px 10px; height: 24px; text-decoration: none;"
                  >
                    + Add
                  </A>
                </div>
                <span class="overview-stat-card__value" style="margin-bottom: 12px;">
                  {agentList().length}
                </span>
                <div style="display: flex; flex-direction: column; gap: 6px; flex: 1;">
                  <For each={sortedAgents().slice(0, 5)}>
                    {(agent) => {
                      const icon = platformIcon(agent.agent_platform, agent.agent_category);
                      return (
                        <A
                          href={`/harnesses/${encodeURIComponent(agent.agent_name)}`}
                          style="display: flex; align-items: center; gap: 8px; text-decoration: none; font-size: var(--font-size-xs); color: hsl(var(--muted-foreground));"
                        >
                          <Show when={icon}>
                            <img
                              src={icon!}
                              alt=""
                              width="14"
                              height="14"
                              style="flex-shrink: 0;"
                            />
                          </Show>
                          <span style="font-weight: 500; color: hsl(var(--foreground));">
                            {agent.display_name || agent.agent_name}
                          </span>
                        </A>
                      );
                    }}
                  </For>
                </div>
                <div style="display: flex; justify-content: flex-end; margin-top: 12px;">
                  <A href="/harnesses" class="view-more-link">
                    View more
                  </A>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── 4. Recent Messages (full width) ──────────────────────────── */}
        <div class="panel scroll-panel" style="margin-bottom: 24px;">
          <div
            class="panel__title"
            style="display: flex; justify-content: space-between; align-items: center;"
          >
            Recent Messages
            <A href="/messages" class="view-more-link">
              View more
            </A>
          </div>
          <div class="scroll-panel__body" onScroll={toggleScrollFade}>
            {(() => {
              const cols = (): MessageColumnKey[] => {
                const at = COMPACT_COLUMNS.indexOf('model');
                return [
                  ...COMPACT_COLUMNS.slice(0, at),
                  'agent' as const,
                  ...COMPACT_COLUMNS.slice(at),
                ];
              };
              return (
                <MessageTable
                  items={overview()?.recent_activity ?? []}
                  columns={cols()}
                  customProviderName={() => undefined}
                />
              );
            })()}
          </div>
        </div>

        {/* ── 5. Model usage (full width) ────────────────────────────── */}
        <div class="panel scroll-panel" style="margin-bottom: 24px;">
          <div class="panel__title">Model usage</div>
          <div class="scroll-panel__body" onScroll={toggleScrollFade}>
            <table class="data-table">
              <thead>
                <tr>
                  <th>Model</th>
                  <th style="text-align: right;">Tokens</th>
                  <th style="text-align: right;">Share</th>
                  <th style="text-align: right;">Est. cost</th>
                </tr>
              </thead>
              <tbody>
                <For each={(overview()?.cost_by_model ?? []).slice(0, 10)}>
                  {(row) => (
                    <tr>
                      <td>
                        <div style="display: flex; align-items: center; gap: 6px;">
                          {(() => {
                            const isCustom = row.provider?.startsWith('custom:') === true;
                            if (isCustom) {
                              const name = row.custom_provider_name ?? undefined;
                              return (
                                customProviderLogo(name ?? '', 16, undefined, row.model) ?? (
                                  <span
                                    class="provider-card__logo-letter"
                                    title={name}
                                    style={{
                                      background: customProviderColor(name ?? ''),
                                      width: '16px',
                                      height: '16px',
                                      'font-size': '9px',
                                      'flex-shrink': '0',
                                      'border-radius': '50%',
                                    }}
                                  >
                                    {(name ?? stripCustomPrefix(row.model)).charAt(0).toUpperCase()}
                                  </span>
                                )
                              );
                            }
                            return row.provider ? (
                              <span style="position: relative; flex-shrink: 0; display: flex; align-items: center; width: 14px; height: 14px;">
                                {providerIcon(row.provider, 16)}
                                {authBadgeFor(row.auth_type, 12)}
                              </span>
                            ) : null;
                          })()}
                          <span style="font-weight: 500; color: hsl(var(--foreground));">
                            {row.model.startsWith('custom:')
                              ? stripCustomPrefix(row.model)
                              : row.display_name || row.model}
                          </span>
                        </div>
                      </td>
                      <td style="text-align: right; font-variant-numeric: tabular-nums;">
                        {formatNumber(row.tokens)}
                      </td>
                      <td style="text-align: right;">
                        <div style="display: flex; align-items: center; gap: 8px; justify-content: flex-end;">
                          <div style="width: 60px; height: 6px; background: hsl(var(--muted)); border-radius: 3px; overflow: hidden;">
                            <div
                              style={{
                                width: `${row.share_pct}%`,
                                height: '100%',
                                background: 'hsl(var(--success))',
                                'border-radius': '3px',
                              }}
                            />
                          </div>
                          <span style="color: hsl(var(--muted-foreground)); font-size: var(--font-size-xs);">
                            {row.share_pct}%
                          </span>
                        </div>
                      </td>
                      <td style="text-align: right; font-weight: 600; font-variant-numeric: tabular-nums;">
                        {formatCost(row.estimated_cost) ?? '$0.00'}
                      </td>
                    </tr>
                  )}
                </For>
                <Show when={(overview()?.cost_by_model ?? []).length === 0}>
                  <tr>
                    <td
                      colspan="3"
                      style="text-align: center; color: hsl(var(--muted-foreground)); padding: 24px 0;"
                    >
                      No model data yet
                    </td>
                  </tr>
                </Show>
              </tbody>
            </table>
          </div>
        </div>

        {/* ── 6. Provider connections (full width) ────────────────────── */}
        <div class="panel scroll-panel" style="margin-bottom: 24px;">
          <div class="panel__title">Provider connections</div>
          <div class="scroll-panel__body" onScroll={toggleScrollFade}>
            <table class="data-table">
              <thead>
                <tr>
                  <th>Provider</th>
                  <th>Type</th>
                  <th>Usage (30d)</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <For each={providerList()}>
                  {(group) => {
                    const firstId = () => group.connections[0]?.id;
                    const isActive = () => group.connections.some((c) => c.is_active);
                    return (
                      <tr
                        style="cursor: pointer;"
                        onClick={() => {
                          const id = firstId();
                          if (id) navigate(`/providers/connections/${id}`);
                        }}
                      >
                        <td>
                          <div style="display: flex; align-items: center; gap: 8px;">
                            {(() => {
                              const isCustom = group.provider.startsWith('custom:');
                              const customName = isCustom ? (group.display_name ?? null) : null;
                              const prov = PROVIDERS.find((p) => p.id === group.provider);
                              const displayName = prov?.name ?? customName ?? group.provider;
                              return (
                                <>
                                  <span style="flex-shrink: 0; display: flex; align-items: center;">
                                    {providerIcon(group.provider, 20) ??
                                      (isCustom
                                        ? customProviderLogo(customName ?? '', 20)
                                        : null) ??
                                      (isCustom ? (
                                        <span
                                          style={{
                                            display: 'inline-flex',
                                            'align-items': 'center',
                                            'justify-content': 'center',
                                            width: '20px',
                                            height: '20px',
                                            'border-radius': '4px',
                                            'font-size': '11px',
                                            'font-weight': '600',
                                            color: 'white',
                                            background: customProviderColor(customName ?? ''),
                                          }}
                                        >
                                          {(customName ?? displayName).charAt(0).toUpperCase()}
                                        </span>
                                      ) : null)}
                                  </span>
                                  <span style="font-weight: 500; color: hsl(var(--foreground));">
                                    {displayName}
                                  </span>
                                  {isCustom && (
                                    <span style="font-size: 10px; font-weight: 500; color: hsl(var(--muted-foreground)); background: hsl(var(--muted)); padding: 1px 6px; border-radius: var(--radius-sm);">
                                      custom
                                    </span>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        </td>
                        <td>
                          <span
                            style={{
                              'font-size': 'var(--font-size-xs)',
                              'font-weight': '500',
                              color: 'hsl(var(--muted-foreground))',
                            }}
                          >
                            {authLabel(group.auth_type)}
                          </span>
                        </td>
                        <td>
                          <Show
                            when={!providerUsageLoading()}
                            fallback={
                              <span
                                aria-hidden="true"
                                style={{
                                  display: 'inline-block',
                                  width: '96px',
                                  height: '12px',
                                  'border-radius': 'var(--radius-sm)',
                                  background: 'hsl(var(--muted) / 0.6)',
                                  animation: 'skeleton-pulse 1.2s ease-in-out infinite',
                                }}
                              />
                            }
                          >
                            <div style="display: flex; align-items: center; gap: 8px;">
                              <Show when={group.sparkline_7d.length > 0}>
                                <span style="flex-shrink: 0;">
                                  <Sparkline data={group.sparkline_7d} width={60} height={24} />
                                </span>
                              </Show>
                              <span style="font-variant-numeric: tabular-nums;">
                                {formatNumber(group.consumption_tokens)} tokens
                              </span>
                            </div>
                          </Show>
                        </td>
                        <td>
                          <Show
                            when={isActive()}
                            fallback={
                              <span style="display: inline-flex; padding: 2px 8px; border-radius: var(--radius-sm); background: hsl(var(--muted)); color: hsl(var(--muted-foreground)); font-size: var(--font-size-xs); font-weight: 500;">
                                Inactive
                              </span>
                            }
                          >
                            <span style="display: inline-flex; padding: 2px 8px; border-radius: var(--radius-sm); background: hsl(var(--success)); color: white; font-size: var(--font-size-xs); font-weight: 600;">
                              Active
                            </span>
                          </Show>
                        </td>
                      </tr>
                    );
                  }}
                </For>
                <Show when={providerList().length === 0}>
                  <tr>
                    <td
                      colspan="5"
                      style="text-align: center; color: hsl(var(--muted-foreground)); padding: 24px 0;"
                    >
                      No connections yet
                    </td>
                  </tr>
                </Show>
              </tbody>
            </table>
          </div>
        </div>

        {/* ── 7. Harnesses (full width) ──────────────────────────────── */}
        <div class="panel scroll-panel" style="margin-bottom: 24px;">
          <div class="panel__title">Harnesses</div>
          <div class="scroll-panel__body" onScroll={toggleScrollFade}>
            <table class="data-table">
              <thead>
                <tr>
                  <th>Harness</th>
                  <th>Usage (30d)</th>
                  <th style="text-align: right;">Messages</th>
                </tr>
              </thead>
              <tbody>
                <For each={sortedAgents()}>
                  {(agent) => {
                    const icon = platformIcon(agent.agent_platform, agent.agent_category);
                    return (
                      <tr
                        style="cursor: pointer;"
                        onClick={() =>
                          navigate(`/harnesses/${encodeURIComponent(agent.agent_name)}`)
                        }
                      >
                        <td>
                          <div style="display: flex; align-items: center; gap: 8px;">
                            <Show when={icon}>
                              <img
                                src={icon!}
                                alt=""
                                width="20"
                                height="20"
                                style="flex-shrink: 0;"
                              />
                            </Show>
                            <span style="font-weight: 500; color: hsl(var(--foreground));">
                              {agent.display_name || agent.agent_name}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div style="display: flex; align-items: center; gap: 8px;">
                            <Show when={(agent.sparkline ?? []).length > 0}>
                              <span style="flex-shrink: 0;">
                                <Sparkline data={agent.sparkline} width={60} height={24} />
                              </span>
                            </Show>
                            <span style="font-variant-numeric: tabular-nums;">
                              {formatNumber(agent.total_tokens ?? 0)} tokens
                            </span>
                          </div>
                        </td>
                        <td style="text-align: right; font-variant-numeric: tabular-nums;">
                          {formatNumber(agent.message_count ?? 0)}
                        </td>
                      </tr>
                    );
                  }}
                </For>
                <Show when={agentList().length === 0}>
                  <tr>
                    <td
                      colspan="4"
                      style="text-align: center; color: hsl(var(--muted-foreground)); padding: 24px 0;"
                    >
                      No harnesses yet
                    </td>
                  </tr>
                </Show>
              </tbody>
            </table>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default GlobalOverview;
