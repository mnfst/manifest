import { Title } from '@solidjs/meta';
import { A, useNavigate, useParams } from '@solidjs/router';
import { createMemo, createResource, createSignal, For, Show, type Component } from 'solid-js';
import {
  getConnectionDetail,
  getProviderAnalytics,
  getProviderAnalyticsAgents,
  getPerAgentTimeseries,
} from '../../services/api/analytics.js';
import { disconnectProvider } from '../../services/api.js';
import { fetchMutate, routingPath } from '../../services/api/core.js';
import { platformIcon } from 'manifest-shared';
import { PROVIDERS } from '../../services/providers.js';
import { providerIcon } from '../../components/ProviderIcon.jsx';
import { formatNumber, formatTimeAgo } from '../../services/formatters.js';
import { getAgents } from '../../services/api.js';
import { getProviders as getAgentProviders } from '../../services/api/routing.js';
import ProviderChartCard from '../../components/ProviderChartCard.jsx';
import ActionMenu from '../../components/ActionMenu.jsx';
import Select from '../../components/Select.jsx';
import { toast } from '../../services/toast-store.js';
import '../../styles/charts.css';

const AUTH_TYPE_LABELS: Record<string, string> = {
  subscription: 'Subscriptions',
  api_key: 'API Keys',
  local: 'Local Providers',
};

const BACK_LINKS: Record<string, string> = {
  subscription: '/providers/subscriptions',
  api_key: '/providers/byok',
  local: '/providers/local',
};

interface AgentRow {
  agent_name: string;
  agent_platform: string | null;
  tokens_30d: number;
  messages_30d: number;
  last_used: string | null;
}

interface ConnectionInfo {
  id: string;
  provider: string;
  auth_type: string;
  label: string;
  cached_model_count: number;
  key_prefix: string | null;
  connected_at: string;
  is_active: boolean;
  last_used_at: string | null;
}

interface DetailResponse {
  connection: ConnectionInfo | null;
  agents: AgentRow[];
  recent_messages: any[];
}

interface AnalyticsResponse {
  summary: {
    messages: { value: number; trend_pct: number };
    tokens: { value: number; trend_pct: number };
  };
  token_usage: Array<{ hour?: string; date?: string; input_tokens: number; output_tokens: number }>;
  message_usage: Array<{ hour?: string; date?: string; count: number }>;
}

const ConnectionDetail: Component = () => {
  const params = useParams<{ connectionId: string }>();

  const [detail] = createResource(
    () => params.connectionId,
    (id) => getConnectionDetail(id) as Promise<DetailResponse>,
  );

  const conn = () => detail()?.connection ?? null;
  const provDef = () => PROVIDERS.find((p) => p.id === conn()?.provider);
  const backLink = () =>
    BACK_LINKS[conn()?.auth_type ?? 'subscription'] ?? '/providers/subscriptions';
  const backLabel = () => AUTH_TYPE_LABELS[conn()?.auth_type ?? 'subscription'] ?? 'Providers';

  // Chart state
  const [chartRange, setChartRange] = createSignal('24h');
  const [chartView, setChartView] = createSignal<'messages' | 'tokens'>('tokens');
  const [chartAgent, setChartAgent] = createSignal('');

  const [chartAgents] = createResource(
    () => conn()?.auth_type,
    (authType) => getProviderAnalyticsAgents(authType).catch(() => ({ agents: [] as string[] })),
  );

  const [analytics] = createResource(
    () => {
      const c = conn();
      if (!c) return null;
      return {
        range: chartRange(),
        agent: chartAgent(),
        authType: c.auth_type,
        provider: c.provider,
      };
    },
    (p) => {
      if (!p) return null;
      return getProviderAnalytics(
        p.authType,
        p.range,
        p.agent || undefined,
        p.provider,
      ) as Promise<AnalyticsResponse>;
    },
  );

  const messageChartData = createMemo(() => {
    const src = analytics()?.message_usage;
    return src?.map((d) => ({ time: d.hour ?? d.date ?? '', value: d.count })) ?? [];
  });

  const [agentTimeseries] = createResource(
    () => {
      const c = conn();
      if (!c) return null;
      return { range: chartRange(), authType: c.auth_type, provider: c.provider };
    },
    (p) => {
      if (!p) return null;
      return getPerAgentTimeseries(p.authType, p.provider, p.range);
    },
  );

  // Agent tag selection for chart filtering
  const [selectedAgents, setSelectedAgents] = createSignal<Set<string>>(new Set());

  // Initialize selectedAgents when agentTimeseries loads
  const allAgents = () => agentTimeseries()?.agents ?? [];
  const effectiveSelected = () => {
    const sel = selectedAgents();
    // If nothing selected yet (initial load), select all
    if (sel.size === 0 && allAgents().length > 0) return new Set(allAgents());
    return sel;
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
  };

  const filteredAgentTimeseries = createMemo(() => {
    const raw = agentTimeseries();
    if (!raw) return undefined;
    const sel = effectiveSelected();
    if (sel.size === 0) return raw;
    const agents = raw.agents.filter((a) => sel.has(a));
    const timeseries = raw.timeseries.map((row) => {
      const filtered: Record<string, number | string> = {};
      for (const [k, v] of Object.entries(row)) {
        if (k === 'hour' || k === 'date' || sel.has(k)) filtered[k] = v;
      }
      return filtered;
    });
    return { agents, timeseries };
  });

  // Manage modal
  const navigate = useNavigate();
  const [showDisconnectModal, setShowDisconnectModal] = createSignal(false);
  const [disconnecting, setDisconnecting] = createSignal(false);
  const [showManageModal, setShowManageModal] = createSignal(false);
  const [labelInput, setLabelInput] = createSignal('');
  const [savingLabel, setSavingLabel] = createSignal(false);
  const [agents] = createResource(async () => {
    try {
      const res = await getAgents();
      return (res as any)?.agents ?? res ?? [];
    } catch {
      return [];
    }
  });
  const firstAgentName = () => (agents() ?? [])[0]?.agent_name ?? '';
  const [modalProviders, { refetch: refetchModalProviders }] = createResource(
    () => firstAgentName(),
    async (name) => {
      if (!name) return [];
      try {
        return await getAgentProviders(name);
      } catch {
        return [];
      }
    },
  );

  const agentOptions = () => {
    const list = chartAgents()?.agents ?? [];
    return [{ label: 'All agents', value: '' }, ...list.map((a) => ({ label: a, value: a }))];
  };

  return (
    <div class="container--lg">
      <Show
        when={detail() && conn()}
        fallback={
          <div style="padding: 48px 0; text-align: center; color: hsl(var(--muted-foreground));">
            Loading...
          </div>
        }
      >
        {(() => {
          const c = conn()!;
          const prov = provDef();
          return (
            <>
              <Title>
                {prov?.name ?? c.provider} — {c.label} | Manifest
              </Title>

              {/* Back link */}
              <div style="margin-bottom: 16px;">
                <A
                  href={backLink()}
                  style="color: hsl(var(--muted-foreground)); font-size: var(--font-size-sm); text-decoration: none;"
                >
                  ← {backLabel()}
                </A>
              </div>

              {/* Header */}
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                <div style="display: flex; align-items: center; gap: 12px;">
                  <span style="display: flex; align-items: center; width: 32px; height: 32px;">
                    {providerIcon(c.provider, 32)}
                  </span>
                  <h1 class="page-header__title" style="margin: 0;">
                    {prov?.name ?? c.provider}
                  </h1>
                </div>
                <button class="btn btn--outline btn--sm" onClick={() => setShowManageModal(true)}>
                  Manage
                </button>
              </div>
              <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 4px 24px; margin-bottom: 24px; padding: 12px 0; border-bottom: 1px solid hsl(var(--border));">
                <div>
                  <span style="font-size: var(--font-size-xs); color: hsl(var(--muted-foreground)); font-weight: 600;">
                    Status
                  </span>
                  <div style="margin-top: 4px;">
                    <Show
                      when={c.is_active}
                      fallback={
                        <span style="display: inline-flex; align-items: center; padding: 2px 8px; border-radius: var(--radius-sm); background: hsl(var(--muted)); color: hsl(var(--muted-foreground)); font-size: var(--font-size-xs); font-weight: 500;">
                          Inactive
                        </span>
                      }
                    >
                      <span style="display: inline-flex; align-items: center; padding: 2px 8px; border-radius: var(--radius-sm); background: hsl(var(--success)); color: white; font-size: var(--font-size-xs); font-weight: 600;">
                        Active
                      </span>
                    </Show>
                  </div>
                </div>
                <div>
                  <span style="font-size: var(--font-size-xs); color: hsl(var(--muted-foreground)); font-weight: 600;">
                    Connection name
                  </span>
                  <div style="font-size: var(--font-size-sm); color: hsl(var(--foreground)); margin-top: 4px;">
                    {c.label}
                  </div>
                </div>
                <div>
                  <span style="font-size: var(--font-size-xs); color: hsl(var(--muted-foreground)); font-weight: 600;">
                    Models
                  </span>
                  <div style="font-size: var(--font-size-sm); color: hsl(var(--foreground)); margin-top: 4px;">
                    {c.cached_model_count}
                  </div>
                </div>
                <div>
                  <span style="font-size: var(--font-size-xs); color: hsl(var(--muted-foreground)); font-weight: 600;">
                    First connection
                  </span>
                  <div style="font-size: var(--font-size-sm); color: hsl(var(--foreground)); margin-top: 4px;">
                    {c.connected_at ? formatTimeAgo(c.connected_at) : '—'}
                  </div>
                </div>
                <div>
                  <span style="font-size: var(--font-size-xs); color: hsl(var(--muted-foreground)); font-weight: 600;">
                    Last used
                  </span>
                  <div style="font-size: var(--font-size-sm); color: hsl(var(--foreground)); margin-top: 4px;">
                    {c.last_used_at ? formatTimeAgo(c.last_used_at) : '—'}
                  </div>
                </div>
              </div>

              {/* Chart filters */}
              <div style="display: flex; align-items: center; justify-content: flex-end; gap: 8px; margin-bottom: 16px;">
                <Select
                  value={chartRange()}
                  onChange={setChartRange}
                  options={[
                    { label: 'Last 24 hours', value: '24h' },
                    { label: 'Last 7 days', value: '7d' },
                    { label: 'Last 30 days', value: '30d' },
                  ]}
                />
              </div>

              {/* Chart */}
              <Show when={analytics()}>
                <ProviderChartCard
                  activeView={chartView()}
                  onViewChange={setChartView}
                  messagesValue={analytics()!.summary.messages.value}
                  messagesTrendPct={analytics()!.summary.messages.trend_pct}
                  tokensValue={analytics()!.summary.tokens.value}
                  tokensTrendPct={analytics()!.summary.tokens.trend_pct}
                  tokenUsage={analytics()!.token_usage}
                  messageChartData={messageChartData()}
                  range={chartRange()}
                  agentTimeseries={filteredAgentTimeseries() ?? undefined}
                  fullAgentTimeseries={agentTimeseries() ?? undefined}
                  allAgents={allAgents()}
                  selectedAgents={effectiveSelected()}
                  onToggleAgent={toggleAgent}
                />
              </Show>

              {/* Two-column grid: Agents + Recent Messages */}
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 24px;">
                {/* Left: Agents table */}
                <div class="panel" style="padding: 0;">
                  <div class="panel__title" style="padding: 16px 16px 0;">
                    Agents
                  </div>
                  <Show
                    when={detail()!.agents.length > 0}
                    fallback={
                      <div style="padding: 24px 16px; color: hsl(var(--muted-foreground)); font-size: var(--font-size-sm); text-align: center;">
                        No agents have used this provider yet.
                      </div>
                    }
                  >
                    <table class="data-table">
                      <thead>
                        <tr>
                          <th>Agent</th>
                          <th>Tokens (30d)</th>
                          <th>Last used</th>
                        </tr>
                      </thead>
                      <tbody>
                        <For each={detail()!.agents}>
                          {(agent) => (
                            <tr>
                              <td>
                                <A
                                  href={`/agents/${agent.agent_name}`}
                                  style="text-decoration: none; color: hsl(var(--foreground)); font-weight: 500; display: flex; align-items: center; gap: 8px;"
                                >
                                  <Show when={platformIcon(agent.agent_platform, null)}>
                                    <img
                                      src={platformIcon(agent.agent_platform, null)!}
                                      alt=""
                                      width="16"
                                      height="16"
                                      style="border-radius: 3px;"
                                    />
                                  </Show>
                                  {agent.agent_name}
                                </A>
                              </td>
                              <td>{formatNumber(agent.tokens_30d)}</td>
                              <td style="color: hsl(var(--muted-foreground));">
                                {agent.last_used ? formatTimeAgo(agent.last_used) : '—'}
                              </td>
                            </tr>
                          )}
                        </For>
                      </tbody>
                    </table>
                  </Show>
                </div>

                {/* Right: Recent Messages */}
                <div class="panel" style="padding: 0;">
                  <div
                    class="panel__title"
                    style="padding: 16px 16px 0; display: flex; justify-content: space-between; align-items: center;"
                  >
                    Recent Messages
                    <A href={`/messages`} class="view-more-link">
                      View more
                    </A>
                  </div>
                  <Show
                    when={detail()!.recent_messages.length > 0}
                    fallback={
                      <div style="padding: 24px 16px; color: hsl(var(--muted-foreground)); font-size: var(--font-size-sm); text-align: center;">
                        No messages yet.
                      </div>
                    }
                  >
                    <table class="data-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Message</th>
                          <th>Model</th>
                          <th>Tokens</th>
                        </tr>
                      </thead>
                      <tbody>
                        <For each={detail()!.recent_messages}>
                          {(msg: any) => (
                            <tr>
                              <td style="white-space: nowrap;">
                                {msg.timestamp ? formatTimeAgo(msg.timestamp) : '—'}
                              </td>
                              <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                {msg.description || msg.first_message || '—'}
                              </td>
                              <td style="max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                {msg.model || '—'}
                              </td>
                              <td>
                                {formatNumber((msg.input_tokens ?? 0) + (msg.output_tokens ?? 0))}
                              </td>
                            </tr>
                          )}
                        </For>
                      </tbody>
                    </table>
                  </Show>
                </div>
              </div>
              {/* Manage modal */}
              <Show when={showManageModal()}>
                <div
                  class="modal-overlay"
                  onClick={(e) => {
                    if (e.target === e.currentTarget) setShowManageModal(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setShowManageModal(false);
                  }}
                >
                  <div
                    class="modal-card"
                    style="max-width: 440px;"
                    role="dialog"
                    aria-modal="true"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <h2 class="modal-card__title">Manage connection</h2>

                    <div style="margin-top: 16px;">
                      <label class="modal-card__field-label" style="margin-top: 0;">
                        Connection name
                      </label>
                      <input
                        type="text"
                        class="input"
                        value={labelInput() || c.label}
                        onInput={(e) => setLabelInput(e.currentTarget.value)}
                        style="width: 100%; height: 36px; padding: 0 12px; border: 1px solid hsl(var(--border)); border-radius: var(--radius); font-size: var(--font-size-sm); background: hsl(var(--background)); color: hsl(var(--foreground));"
                      />
                    </div>

                    <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 20px; padding-top: 16px; border-top: 1px solid hsl(var(--border));">
                      <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: var(--font-size-sm); font-weight: 500; color: hsl(var(--muted-foreground));">
                          Status:
                        </span>
                        <Show
                          when={c.is_active}
                          fallback={
                            <span style="display: inline-flex; align-items: center; padding: 2px 8px; border-radius: var(--radius-sm); background: hsl(var(--muted)); color: hsl(var(--muted-foreground)); font-size: var(--font-size-xs); font-weight: 500;">
                              Inactive
                            </span>
                          }
                        >
                          <span style="display: inline-flex; align-items: center; padding: 2px 8px; border-radius: var(--radius-sm); background: hsl(var(--success)); color: white; font-size: var(--font-size-xs); font-weight: 600;">
                            Active
                          </span>
                        </Show>
                      </div>
                      <Show when={c.is_active}>
                        <button
                          class="btn btn--danger btn--sm"
                          onClick={() => {
                            setShowManageModal(false);
                            setShowDisconnectModal(true);
                          }}
                        >
                          Disconnect
                        </button>
                      </Show>
                    </div>

                    <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px;">
                      <button
                        class="btn btn--ghost btn--sm"
                        onClick={() => setShowManageModal(false)}
                      >
                        Cancel
                      </button>
                      <button
                        class="btn btn--primary btn--sm"
                        disabled={savingLabel() || !labelInput() || labelInput() === c.label}
                        onClick={async () => {
                          if (!labelInput() || labelInput() === c.label) return;
                          setSavingLabel(true);
                          try {
                            const url = routingPath(
                              firstAgentName(),
                              `/providers/${encodeURIComponent(c.provider)}/keys/${encodeURIComponent(c.label)}`,
                            );
                            await fetchMutate(url, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                newLabel: labelInput(),
                                authType: c.auth_type,
                              }),
                            });
                            toast.success('Connection renamed');
                            setShowManageModal(false);
                            // Refresh detail data
                            window.location.reload();
                          } catch {
                            // toast from fetchMutate
                          } finally {
                            setSavingLabel(false);
                          }
                        }}
                      >
                        {savingLabel() ? <span class="spinner" /> : 'Save'}
                      </button>
                    </div>
                  </div>
                </div>
              </Show>

              {/* Disconnect modal */}
              <Show when={showDisconnectModal()}>
                <div
                  class="modal-overlay"
                  onClick={(e) => {
                    if (e.target === e.currentTarget) setShowDisconnectModal(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setShowDisconnectModal(false);
                  }}
                >
                  <div
                    class="modal-card"
                    style="max-width: 420px;"
                    role="dialog"
                    aria-modal="true"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <h2 class="modal-card__title">Disconnect {prov?.name ?? c.provider}</h2>
                    <p class="modal-card__desc">
                      Disconnecting this provider will remove it from your active connections. Your
                      routing configuration may be affected if models from this provider are
                      currently assigned.
                    </p>
                    <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px;">
                      <button
                        class="btn btn--ghost btn--sm"
                        onClick={() => setShowDisconnectModal(false)}
                      >
                        Cancel
                      </button>
                      <button
                        class="btn btn--primary btn--sm"
                        disabled={disconnecting()}
                        onClick={async () => {
                          setDisconnecting(true);
                          try {
                            await disconnectProvider(
                              firstAgentName(),
                              c.provider,
                              c.auth_type as any,
                              c.label,
                            );
                            toast.success(`${prov?.name ?? c.provider} disconnected`);
                            navigate(backLink());
                          } catch {
                            // toast from fetchMutate
                          } finally {
                            setDisconnecting(false);
                            setShowDisconnectModal(false);
                          }
                        }}
                      >
                        {disconnecting() ? <span class="spinner" /> : 'Disconnect'}
                      </button>
                    </div>
                  </div>
                </div>
              </Show>
            </>
          );
        })()}
      </Show>
    </div>
  );
};

export default ConnectionDetail;
