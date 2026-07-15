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
import UnifiedChartCard from '../components/UnifiedChartCard.jsx';
import AutofixKpiCards from '../components/AutofixKpiCards.jsx';

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
import {
  getAutofixStats,
  getAutofixTimeseries,
  getPerProviderReliability,
  getPerAgentReliability,
} from '../services/api/analytics.js';
import { getAutofixCohort } from '../services/api/autofix.js';

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
  request_reliability: {
    total: number;
    successful: number;
    success_rate: number;
    attempt_success_rate: number;
    manifest_lift_pct: number;
    recovered: number;
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
      if (v === 'status' || v === 'provider' || v === 'agent') return v;
    } catch {
      /* ignore */
    }
    return 'status';
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
  const [chartView, setChartView] = createSignal<'requests' | 'selfheal' | 'tokens' | 'cost'>(
    'requests',
  );

  // Local providers only exist on self-hosted installs; cloud hides the
  // Local stat card and drops the stats grid to three columns.
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

  // ── Auto-fix resources (conditional on tenant access) ────────────────
  const [autofixCohort] = createResource(
    () => ({ _ping: messagePing() }),
    () => getAutofixCohort(),
  );
  const autofixEligible = () => autofixCohort()?.eligible ?? false;
  const [autofixStats] = createResource(
    () => (autofixEligible() ? { range: effectiveChartRange(), _ping: messagePing() } : false),
    (p) => getAutofixStats(p.range),
  );

  // Disposition timeseries: feeds the "By request status" chart view AND the
  // Self-healed requests tab (recovered subset: healed + fallback series).
  const [requestStatusTs] = createResource(
    () => ({ range: effectiveChartRange(), _ping: messagePing() }),
    (p) => getAutofixTimeseries(p.range, 'disposition'),
  );
  const selfHealedTs = () => {
    const ts = requestStatusTs();
    if (!ts) return undefined;
    const picked = ts.keys
      .map((k, i) => ({ k, i }))
      .filter(({ k }) => k === 'healed' || k === 'fallback');
    return {
      ...ts,
      keys: picked.map(({ k }) => k),
      buckets: ts.buckets.map((b) => ({
        bucket: b.bucket,
        counts: picked.map(({ i }) => b.counts[i] ?? 0),
      })),
    };
  };

  const [agentReliability] = createResource(
    () => (autofixEligible() ? { range: effectiveChartRange(), _ping: messagePing() } : false),
    (p) => getPerAgentReliability(p.range),
  );

  const [providerReliability] = createResource(
    () => (autofixEligible() ? { range: effectiveChartRange(), _ping: messagePing() } : false),
    (p) => getPerProviderReliability(p.range),
  );

  // Shimmer the usage cells until the first usage load resolves; SSE refetches
  // keep the prior numbers on screen so the table doesn't flicker.

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
  const setAllAgents = (on: boolean) => {
    const next = on ? new Set(allAgents()) : new Set<string>();
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
        {/* ── Auto-fix KPI cards (autofix-gated) ── */}
        <Show when={autofixEligible()}>
          <AutofixKpiCards stats={autofixStats()} />
        </Show>

        {/* ── 2. Unified Chart Card ─────────────────────────────────── */}
        {(() => {
          const o = () => overview()!;
          return (
            <UnifiedChartCard
              activeTab={chartView()}
              onTabChange={setChartView}
              requestsValue={o().summary.messages.value}
              requestsTrendPct={o().summary.messages.trend_pct}
              selfHealedValue={
                (autofixStats()?.autofix_saves.value ?? 0) +
                (autofixStats()?.fallback_saves?.value ?? 0)
              }
              selfHealedTrendPct={(() => {
                const s = autofixStats();
                if (!s) return 0;
                const cur = s.autofix_saves.value + (s.fallback_saves?.value ?? 0);
                const prev = s.autofix_saves.previous + (s.fallback_saves?.previous ?? 0);
                if (prev === 0) return 0;
                return Math.max(-999, Math.min(999, Math.round(((cur - prev) / prev) * 100)));
              })()}
              selfHealedTimeseries={autofixEligible() ? selfHealedTs() : undefined}
              costValue={o().summary.cost_today.value}
              costTrendPct={o().summary.cost_today.trend_pct}
              costInfoTooltip="Actual API key costs only. Subscription usage is not included."
              tokensValue={o().summary.tokens_today.value}
              tokensTrendPct={o().summary.tokens_today.trend_pct}
              range={effectiveChartRange()}
              requestStatusTimeseries={groupBy() === 'status' ? requestStatusTs() : undefined}
              agentRequestTimeseries={
                groupBy() !== 'status' ? (filteredAgentMessageTimeseries() ?? undefined) : undefined
              }
              agentTimeseries={filteredAgentTimeseries() ?? undefined}
              agentCostTimeseries={filteredAgentCostTimeseries() ?? undefined}
              colorMap={agentColorMap()}
              seriesFilters={
                <>
                  <button
                    class="chart-card__filter-btn"
                    classList={{ 'chart-card__filter-btn--active': groupBy() === 'status' }}
                    onClick={() => setGroupBy('status')}
                  >
                    By request status
                  </button>
                  <button
                    class="chart-card__filter-btn"
                    classList={{ 'chart-card__filter-btn--active': groupBy() === 'provider' }}
                    onClick={() => setGroupBy('provider')}
                  >
                    By provider
                  </button>
                  <button
                    class="chart-card__filter-btn"
                    classList={{ 'chart-card__filter-btn--active': groupBy() === 'agent' }}
                    onClick={() => setGroupBy('agent')}
                  >
                    By harness
                  </button>
                  <Show when={groupBy() !== 'status'}>
                    <div style="min-width: 140px;">
                      <FilterSelect
                        noun={groupBy() === 'provider' ? 'providers' : 'harnesses'}
                        items={allAgents()}
                        selected={effectiveSelected()}
                        colorMap={agentColorMap()}
                        onToggle={toggleAgent}
                        onSelectAll={() => setAllAgents(true)}
                        onUnselectAll={() => setAllAgents(false)}
                      />
                    </div>
                  </Show>
                </>
              }
            />
          );
        })()}

        {/* "Error classes by frequency" stays unmounted until the backend has
            real error_class data (see the preservation spec in tests/components). */}

        {/* Stat cards removed — info is in Provider connections + Harnesses tables below */}

        {/* ── 4. Recent Requests (full width) ──────────────────────────── */}
        <div class="panel scroll-panel" style="margin-bottom: 24px;">
          <div
            class="panel__title"
            style="display: flex; justify-content: space-between; align-items: center;"
          >
            Recent Requests
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
                  <th>Status</th>
                  <th style="text-align: right;">Total requests</th>
                  <Show when={autofixEligible()}>
                    <th style="text-align: right;">Auto-fixed</th>
                  </Show>
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
                        {(() => {
                          const pKey = group.provider.startsWith('custom:')
                            ? 'custom'
                            : group.provider;
                          const rel = () => providerReliability()?.find((r) => r.provider === pKey);
                          return (
                            <>
                              <td style="text-align: right; font-variant-numeric: tabular-nums;">
                                {formatNumber(group.consumption_messages)}
                              </td>
                              <Show when={autofixEligible()}>
                                <td style="text-align: right; font-variant-numeric: tabular-nums;">
                                  <Show when={rel()} fallback="—">
                                    <div style="display: flex; align-items: center; gap: 6px; justify-content: flex-end;">
                                      <div style="width: 40px; height: 6px; background: hsl(var(--border)); border-radius: 3px; overflow: hidden;">
                                        <div
                                          style={{
                                            height: '100%',
                                            'border-radius': '3px',
                                            background: 'hsl(var(--success))',
                                            width: `${rel()!.requests > 0 ? (rel()!.autofixed / rel()!.requests) * 100 : 0}%`,
                                          }}
                                        />
                                      </div>
                                      <span>{formatNumber(rel()!.autofixed)}</span>
                                    </div>
                                  </Show>
                                </td>
                              </Show>
                            </>
                          );
                        })()}
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
                  <th style="text-align: right;">Requests</th>
                  <Show when={autofixEligible()}>
                    <th style="text-align: right;">Auto-fixed</th>
                  </Show>
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
                        {(() => {
                          const rel = () =>
                            agentReliability()?.find((r) => r.agent_name === agent.agent_name);
                          return (
                            <Show when={autofixEligible()}>
                              <td style="text-align: right; font-variant-numeric: tabular-nums;">
                                <Show when={rel()} fallback="—">
                                  <div style="display: flex; align-items: center; gap: 6px; justify-content: flex-end;">
                                    <div style="width: 40px; height: 6px; background: hsl(var(--border)); border-radius: 3px; overflow: hidden;">
                                      <div
                                        style={{
                                          height: '100%',
                                          'border-radius': '3px',
                                          background: 'hsl(var(--success))',
                                          width: `${rel()!.requests > 0 ? (rel()!.autofixed / rel()!.requests) * 100 : 0}%`,
                                        }}
                                      />
                                    </div>
                                    <span>{formatNumber(rel()!.autofixed)}</span>
                                  </div>
                                </Show>
                              </td>
                            </Show>
                          );
                        })()}
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
