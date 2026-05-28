import { Title } from '@solidjs/meta';
import { A } from '@solidjs/router';
import { createResource, For, Show, type Component } from 'solid-js';
import { fetchJson } from '../services/api/core.js';
import { getAgents } from '../services/api.js';
import { formatNumber } from '../services/formatters.js';
import { providerIcon } from '../components/ProviderIcon.jsx';
import GlobalOverviewSkeleton from '../components/GlobalOverviewSkeleton.jsx';
import { agentPing, messagePing } from '../services/sse.js';
import '../styles/overview.css';

interface ProviderSummary {
  provider: string;
  auth_type: string;
  connection_count: number;
  total_models: number;
  consumption_tokens: number;
  consumption_messages: number;
}

interface OverviewStats {
  total_messages: number;
  total_tokens: number;
  subscriptions: { count: number; tokens: number };
  byok: { count: number; tokens: number };
  local: { count: number; tokens: number };
  top_models: Array<{ model: string; provider: string; tokens: number; messages: number }>;
}

const GlobalOverview: Component = () => {
  const [providers] = createResource(
    () => messagePing(),
    async () => {
      try {
        const res = (await fetchJson('/providers')) as { providers: ProviderSummary[] };
        return res?.providers ?? [];
      } catch {
        return [];
      }
    },
  );

  const [agents] = createResource(
    () => agentPing(),
    async () => {
      try {
        const data = await getAgents();
        return (data as any)?.agents ?? data ?? [];
      } catch {
        return [];
      }
    },
  );

  const stats = () => {
    const list = providers() ?? [];
    const subs = list.filter((p) => p.auth_type === 'subscription');
    const byok = list.filter((p) => p.auth_type === 'api_key');
    const local = list.filter((p) => p.auth_type === 'local');
    return {
      total_providers: list.length,
      total_tokens: list.reduce((s, p) => s + p.consumption_tokens, 0),
      total_messages: list.reduce((s, p) => s + p.consumption_messages, 0),
      subscriptions: {
        count: subs.length,
        tokens: subs.reduce((s, p) => s + p.consumption_tokens, 0),
      },
      byok: {
        count: byok.length,
        tokens: byok.reduce((s, p) => s + p.consumption_tokens, 0),
      },
      local: {
        count: local.length,
        tokens: local.reduce((s, p) => s + p.consumption_tokens, 0),
      },
    };
  };

  const agentList = () => agents() ?? [];

  return (
    <div class="container--lg">
      <Title>Overview | Manifest</Title>
      <div class="page-header">
        <h1 class="page-header__title">Overview</h1>
        <p class="page-header__subtitle">Your AI stack at a glance.</p>
      </div>

      <Show
        when={providers() !== undefined && agents() !== undefined}
        fallback={<GlobalOverviewSkeleton />}
      >
        {/* Stats cards */}
        <div class="overview-stats">
          <div class="overview-stat-card">
            <span class="overview-stat-card__label">Providers</span>
            <span class="overview-stat-card__value">{stats().total_providers}</span>
          </div>
          <div class="overview-stat-card">
            <span class="overview-stat-card__label">Agents</span>
            <span class="overview-stat-card__value">{agentList().length}</span>
          </div>
          <div class="overview-stat-card">
            <span class="overview-stat-card__label">Messages (30d)</span>
            <span class="overview-stat-card__value">{formatNumber(stats().total_messages)}</span>
          </div>
          <div class="overview-stat-card">
            <span class="overview-stat-card__label">Tokens (30d)</span>
            <span class="overview-stat-card__value">{formatNumber(stats().total_tokens)}</span>
          </div>
        </div>

        {/* Provider categories */}
        <div class="overview-sections">
          <A href="/providers/subscriptions" class="overview-section-card">
            <div class="overview-section-card__header">
              <h3 class="overview-section-card__title">Subscriptions</h3>
              <span class="overview-section-card__count">
                {stats().subscriptions.count} connected
              </span>
            </div>
            <Show when={stats().subscriptions.tokens > 0}>
              <p class="overview-section-card__stat">
                {formatNumber(stats().subscriptions.tokens)} tokens consumed
              </p>
            </Show>
            <Show when={stats().subscriptions.count === 0}>
              <p class="overview-section-card__hint">
                Connect ChatGPT Plus, Claude Max, Copilot and more.
              </p>
            </Show>
          </A>

          <A href="/providers/byok" class="overview-section-card">
            <div class="overview-section-card__header">
              <h3 class="overview-section-card__title">API Keys</h3>
              <span class="overview-section-card__count">{stats().byok.count} connected</span>
            </div>
            <Show when={stats().byok.tokens > 0}>
              <p class="overview-section-card__stat">
                {formatNumber(stats().byok.tokens)} tokens consumed
              </p>
            </Show>
            <Show when={stats().byok.count === 0}>
              <p class="overview-section-card__hint">
                Bring your own API keys for pay-as-you-go providers.
              </p>
            </Show>
          </A>

          <A href="/providers/local" class="overview-section-card">
            <div class="overview-section-card__header">
              <h3 class="overview-section-card__title">Local</h3>
              <span class="overview-section-card__count">{stats().local.count} connected</span>
            </div>
            <Show when={stats().local.tokens > 0}>
              <p class="overview-section-card__stat">
                {formatNumber(stats().local.tokens)} tokens consumed
              </p>
            </Show>
            <Show when={stats().local.count === 0}>
              <p class="overview-section-card__hint">Connect Ollama, LM Studio, or llama.cpp.</p>
            </Show>
          </A>
        </div>

        {/* Agents summary */}
        <Show when={agentList().length > 0}>
          <div class="overview-agents">
            <h3 class="overview-agents__title">Agents</h3>
            <div class="overview-agents__list">
              <For each={agentList()}>
                {(agent: any) => (
                  <A href={`/agents/${agent.agent_name}`} class="overview-agent-row">
                    <span class="overview-agent-row__name">
                      {agent.display_name || agent.agent_name}
                    </span>
                    <span class="overview-agent-row__stat">
                      {formatNumber(agent.message_count ?? 0)} messages
                    </span>
                  </A>
                )}
              </For>
            </div>
          </div>
        </Show>
      </Show>
    </div>
  );
};

export default GlobalOverview;
