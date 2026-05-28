import { Title } from '@solidjs/meta';
import { A, useParams } from '@solidjs/router';
import { createMemo, createResource, createSignal, For, Show, type Component } from 'solid-js';
import {
  getConnectionDetail,
  getProviderAnalytics,
  getProviderAnalyticsAgents,
} from '../../services/api/analytics.js';
import { platformIcon } from 'manifest-shared';
import { PROVIDERS } from '../../services/providers.js';
import { providerIcon } from '../../components/ProviderIcon.jsx';
import { formatNumber, formatTimeAgo } from '../../services/formatters.js';
import { getAgents } from '../../services/api.js';
import { getProviders as getAgentProviders } from '../../services/api/routing.js';
import ProviderChartCard from '../../components/ProviderChartCard.jsx';
import ProviderSelectModal from '../../components/ProviderSelectModal.jsx';
import Select from '../../components/Select.jsx';
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

  // Manage modal
  const [showManageModal, setShowManageModal] = createSignal(false);
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
                <button
                  class="btn btn--sm"
                  onClick={() => {
                    refetchModalProviders();
                    setShowManageModal(true);
                  }}
                >
                  Manage
                </button>
              </div>
              <p style="color: hsl(var(--muted-foreground)); font-size: var(--font-size-sm); margin-bottom: 24px;">
                {c.label} · {c.cached_model_count} models · Connected{' '}
                {new Date(c.connected_at).toLocaleDateString()}
              </p>

              {/* Chart filters */}
              <div style="display: flex; align-items: center; justify-content: flex-end; gap: 8px; margin-bottom: 16px;">
                <Select value={chartAgent()} onChange={setChartAgent} options={agentOptions()} />
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
                />
              </Show>

              {/* Two-column grid: Agents + Recent Messages */}
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 24px;">
                {/* Left: Agents table */}
                <div class="panel" style="padding: 0;">
                  <div class="panel__title" style="padding: 16px 16px 12px;">
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
                    style="padding: 16px 16px 12px; display: flex; justify-content: space-between; align-items: center;"
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
              <Show when={showManageModal() && firstAgentName()}>
                <ProviderSelectModal
                  agentName={firstAgentName()}
                  providers={modalProviders() ?? []}
                  providerDeepLink={{
                    providerId: c.provider,
                    authType: c.auth_type as any,
                    closeOnBack: true,
                  }}
                  onUpdate={() => refetchModalProviders()}
                  onClose={() => setShowManageModal(false)}
                />
              </Show>
            </>
          );
        })()}
      </Show>
    </div>
  );
};

export default ConnectionDetail;
