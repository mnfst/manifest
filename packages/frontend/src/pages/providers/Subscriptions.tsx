import { Title } from '@solidjs/meta';
import { createResource, createSignal, For, Show, type Component } from 'solid-js';
import { fetchJson } from '../../services/api/core.js';
import { getAgents } from '../../services/api.js';
import { getProviders as getAgentProviders } from '../../services/api/routing.js';
import { PROVIDERS } from '../../services/providers.js';
import { providerIcon } from '../../components/ProviderIcon.jsx';
import { formatNumber } from '../../services/formatters.js';
import ProviderSelectModal from '../../components/ProviderSelectModal.jsx';
import type { RoutingProvider } from '../../services/api/routing.js';

interface Connection {
  id: string;
  label: string;
  key_prefix: string | null;
  cached_model_count: number;
}

interface ConnectedProvider {
  provider: string;
  auth_type: string;
  connection_count: number;
  connections: Connection[];
  total_models: number;
  consumption_tokens: number;
  consumption_messages: number;
}

interface ProvidersResponse {
  providers: ConnectedProvider[];
  model_counts: Record<string, number>;
}

const SUBSCRIPTION_PROVIDERS = PROVIDERS.filter((p) => p.supportsSubscription);

const Subscriptions: Component = () => {
  const [showModal, setShowModal] = createSignal(false);
  const [deepLinkProvider, setDeepLinkProvider] = createSignal<string | null>(null);

  const [data, { refetch }] = createResource(async () => {
    try {
      return (await fetchJson('/providers')) as ProvidersResponse;
    } catch {
      return { providers: [], model_counts: {} };
    }
  });

  const [agents] = createResource(async () => {
    try {
      const res = await getAgents();
      return (res as any)?.agents ?? res ?? [];
    } catch {
      return [];
    }
  });

  const firstAgentName = () => (agents() ?? [])[0]?.agent_name ?? '';

  // Fetch the real RoutingProvider[] from the agent endpoint for the modal
  const [modalProviders, { refetch: refetchModalProviders }] = createResource(
    () => firstAgentName(),
    async (agentName) => {
      if (!agentName) return [];
      try {
        return await getAgentProviders(agentName);
      } catch {
        return [];
      }
    },
  );

  const connectedMap = () => {
    const map = new Map<string, ConnectedProvider>();
    for (const p of data()?.providers ?? []) {
      if (p.auth_type === 'subscription') map.set(p.provider, p);
    }
    return map;
  };

  const modelCounts = () => data()?.model_counts ?? {};
  const isConnected = (id: string) => connectedMap().has(id);
  const getConnected = (id: string) => connectedMap().get(id);
  const connectedProviders = () => SUBSCRIPTION_PROVIDERS.filter((p) => isConnected(p.id));

  // Flatten: one row per connection (not per provider)
  const connectedRows = () => {
    const rows: Array<{
      prov: (typeof SUBSCRIPTION_PROVIDERS)[0];
      conn: Connection;
      cp: ConnectedProvider;
    }> = [];
    for (const prov of connectedProviders()) {
      const cp = getConnected(prov.id)!;
      for (const conn of cp.connections) {
        rows.push({ prov, conn, cp });
      }
    }
    return rows;
  };

  const getModelCount = (provId: string) => {
    const cp = getConnected(provId);
    if (cp && cp.total_models > 0) return cp.total_models;
    const counts = modelCounts();
    return counts[provId.toLowerCase()] ?? counts[provId] ?? null;
  };

  const openConnect = (provId?: string) => {
    setDeepLinkProvider(provId ?? null);
    refetchModalProviders();
    setShowModal(true);
  };

  const handleModalClose = () => {
    setShowModal(false);
    setDeepLinkProvider(null);
    refetch();
  };

  const providerDeepLink = () => {
    const p = deepLinkProvider();
    return p ? { providerId: p, authType: 'subscription' as const, closeOnBack: true } : null;
  };

  return (
    <div class="container--lg">
      <Title>Subscriptions | Manifest</Title>
      <div class="page-header">
        <h1 class="page-header__title">Subscriptions</h1>
        <p class="page-header__subtitle">
          Connect flat-rate subscriptions to route queries through your existing plans.
        </p>
      </div>

      {/* TABLE 1: Connected subscriptions */}
      <Show when={connectedRows().length > 0}>
        <div class="panel" style="padding: 0; margin-bottom: 24px;">
          <table class="data-table" style="table-layout: fixed;">
            <colgroup>
              <col />
              <col style="width: 120px;" />
              <col style="width: 80px;" />
              <col style="width: 180px;" />
              <col style="width: 100px;" />
            </colgroup>
            <thead>
              <tr>
                <th>Provider</th>
                <th>Subscription</th>
                <th>Models</th>
                <th>Usage / month</th>
                <th />
              </tr>
            </thead>
            <tbody>
              <For each={connectedRows()}>
                {(row) => {
                  const perKeyTokens = () =>
                    Math.round(row.cp.consumption_tokens / row.cp.connection_count);
                  return (
                    <tr>
                      <td>
                        <span style="display: flex; align-items: center; gap: 10px;">
                          <span style="display: flex; align-items: center; width: 20px; height: 20px;">
                            {providerIcon(row.prov.id, 20)}
                          </span>
                          <span style="font-weight: 500;">{row.prov.name}</span>
                        </span>
                      </td>
                      <td style="color: hsl(var(--muted-foreground));">{row.conn.label}</td>
                      <td>{row.conn.cached_model_count || getModelCount(row.prov.id) || '—'}</td>
                      <td>
                        <Show when={perKeyTokens() > 0} fallback="—">
                          <div style="display: flex; align-items: center; gap: 8px;">
                            <span>{formatNumber(perKeyTokens())} tokens</span>
                            <div class="usage-bar">
                              <div
                                class="usage-bar__fill"
                                style={{
                                  width: `${Math.min(100, Math.round((perKeyTokens() / 1_000_000) * 100))}%`,
                                }}
                              />
                            </div>
                          </div>
                        </Show>
                      </td>
                      <td style="text-align: right;">
                        <button
                          class="btn btn--sm"
                          style="font-size: var(--font-size-xs);"
                          onClick={() => openConnect(row.prov.id)}
                        >
                          Manage
                        </button>
                      </td>
                    </tr>
                  );
                }}
              </For>
            </tbody>
          </table>
        </div>
      </Show>

      {/* TABLE 2: All supported providers */}
      <h3 style="font-size: var(--font-size-base); font-weight: 600; color: hsl(var(--foreground)); margin-bottom: 12px;">
        Supported providers
      </h3>
      <div class="panel" style="padding: 0;">
        <table class="data-table" style="table-layout: fixed;">
          <colgroup>
            <col />
            <col style="width: 80px;" />
            <col style="width: 260px;" />
          </colgroup>
          <thead>
            <tr>
              <th>Provider</th>
              <th>Models</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <For each={SUBSCRIPTION_PROVIDERS}>
              {(prov) => {
                const has = () => isConnected(prov.id);
                const cp = () => getConnected(prov.id);
                return (
                  <tr>
                    <td>
                      <span style="display: flex; align-items: center; gap: 10px;">
                        <span style="display: flex; align-items: center; width: 20px; height: 20px;">
                          {providerIcon(prov.id, 20)}
                        </span>
                        <span style="font-weight: 500;">{prov.name}</span>
                      </span>
                    </td>
                    <td style="color: hsl(var(--muted-foreground));">
                      {getModelCount(prov.id) ?? '—'}
                    </td>
                    <td>
                      <span style="display: flex; align-items: center; justify-content: flex-end; gap: 8px;">
                        <Show when={has()}>
                          <span style="color: hsl(var(--success)); font-size: var(--font-size-xs); font-weight: 500; white-space: nowrap;">
                            {cp()!.connection_count}{' '}
                            {cp()!.connection_count === 1 ? 'connection' : 'connections'}
                          </span>
                        </Show>
                        <Show
                          when={has()}
                          fallback={
                            <button
                              class="btn btn--primary btn--sm"
                              onClick={() => openConnect(prov.id)}
                            >
                              Connect
                            </button>
                          }
                        >
                          <button
                            class="btn btn--sm"
                            style="font-size: var(--font-size-xs); white-space: nowrap;"
                            onClick={() => openConnect(prov.id)}
                          >
                            Add connection
                          </button>
                        </Show>
                      </span>
                    </td>
                  </tr>
                );
              }}
            </For>
          </tbody>
        </table>
      </div>

      {/* Connection modal — uses real RoutingProvider[] from agent endpoint */}
      <Show when={showModal() && firstAgentName()}>
        <ProviderSelectModal
          agentName={firstAgentName()}
          providers={modalProviders() ?? []}
          providerDeepLink={providerDeepLink()}
          onUpdate={() => {
            refetch();
            refetchModalProviders();
          }}
          onClose={handleModalClose}
        />
      </Show>
    </div>
  );
};

export default Subscriptions;
