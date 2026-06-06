import { Title } from '@solidjs/meta';
import { useSearchParams } from '@solidjs/router';
import { createResource, createSignal, For, Show, type Component } from 'solid-js';
import { fetchJson } from '../../services/api/core.js';
import { getAgents } from '../../services/api.js';
import { getProviders as getAgentProviders } from '../../services/api/routing.js';
import { PROVIDERS } from '../../services/providers.js';
import { providerIcon } from '../../components/ProviderIcon.jsx';
import ProviderSelectModal from '../../components/ProviderSelectModal.jsx';
import '../../styles/routing.css';

interface Connection {
  id: string;
  label: string;
  key_prefix: string | null;
  cached_model_count: number;
  is_active: boolean;
}

interface ConnectedProvider {
  provider: string;
  auth_type: string;
  connection_count: number;
  connections: Connection[];
  total_models: number;
}

interface ProvidersResponse {
  providers: ConnectedProvider[];
  model_counts: Record<string, number>;
}

const SUBSCRIPTION_PROVIDERS = PROVIDERS.filter((p) => p.supportsSubscription);

const Subscriptions: Component = () => {
  const [showModal, setShowModal] = createSignal(false);
  const [deepLinkProvider, setDeepLinkProvider] = createSignal<string | null>(null);
  const [viewMode, setViewMode] = createSignal<'list' | 'grid'>('list');

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

  const [searchParams, setSearchParams] = useSearchParams();
  if (searchParams.add === 'true') {
    queueMicrotask(() => {
      setSearchParams({ add: undefined });
      openConnect();
    });
  }

  const handleModalClose = () => {
    setShowModal(false);
    setDeepLinkProvider(null);
    refetch();
  };

  const providerDeepLink = () => {
    const p = deepLinkProvider();
    if (!p) return null;
    const alreadyConnected = isConnected(p);
    return {
      providerId: p,
      authType: 'subscription' as const,
      closeOnBack: true,
      addKey: alreadyConnected,
    };
  };

  return (
    <div class="container--lg">
      <Title>Subscriptions | Manifest</Title>
      <div class="page-header" style="border-bottom: none; padding-bottom: 0;">
        <div>
          <h1 class="page-header__title">Subscriptions</h1>
          <p class="page-header__subtitle">
            Connect flat-rate subscriptions to route queries through your existing plans.
          </p>
        </div>
        <button class="btn btn--primary btn--sm" onClick={() => openConnect()}>
          Add subscription
        </button>
      </div>

      <Show when={connectedRows().length > 0}>
        <h3 style="font-size: var(--font-size-base); font-weight: 600; color: hsl(var(--foreground)); margin-bottom: 12px;">
          My Subscriptions
        </h3>
        <div class="panel" style="padding: 0; margin-bottom: 24px; overflow-x: auto;">
          <table class="data-table" style="min-width: 500px;">
            <colgroup>
              <col style="width: 214px;" />
              <col style="width: 60px;" />
              <col style="width: 100px;" />
              <col />
              <col style="width: 90px;" />
            </colgroup>
            <thead>
              <tr>
                <th>Provider</th>
                <th>Models</th>
                <th>Name</th>
                <th />
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <For each={connectedRows()}>
                {(row) => {
                  const active = () => row.conn.is_active;
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
                      <td>{row.conn.cached_model_count || getModelCount(row.prov.id) || '—'}</td>
                      <td style="color: hsl(var(--muted-foreground));">{row.conn.label}</td>
                      <td />
                      <td>
                        <Show
                          when={active()}
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
                      </td>
                    </tr>
                  );
                }}
              </For>
            </tbody>
          </table>
        </div>
      </Show>

      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
        <h3 style="font-size: var(--font-size-base); font-weight: 600; color: hsl(var(--foreground)); margin: 0;">
          Supported providers
        </h3>
        <div class="panel__tabs" role="tablist" style="height: 30px;">
          <button
            role="tab"
            aria-selected={viewMode() === 'list'}
            class="panel__tab"
            classList={{ 'panel__tab--active': viewMode() === 'list' }}
            onClick={() => setViewMode('list')}
            aria-label="List view"
            style="padding: 0 8px;"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              fill="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M4 11h16v2H4zm0-5h16v2H4zm0 10h16v2H4z" />
            </svg>
          </button>
          <button
            role="tab"
            aria-selected={viewMode() === 'grid'}
            class="panel__tab"
            classList={{ 'panel__tab--active': viewMode() === 'grid' }}
            onClick={() => setViewMode('grid')}
            aria-label="Grid view"
            style="padding: 0 8px;"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              fill="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M3 3h4v4H3zm7 0h4v4h-4z" />
              <path d="M10 3h4v4h-4zm7 0h4v4h-4zM3 17h4v4H3zm7 0h4v4h-4z" />
              <path d="M10 17h4v4h-4zm7 0h4v4h-4zM3 10h4v4H3zm7 0h4v4h-4z" />
              <path d="M10 10h4v4h-4zm7 0h4v4h-4z" />
            </svg>
          </button>
        </div>
      </div>

      <Show when={viewMode() === 'list'}>
        <div class="panel" style="padding: 0; overflow-x: auto;">
          <table class="data-table" style="min-width: 500px;">
            <colgroup>
              <col style="width: 214px;" />
              <col style="width: 80px;" />
              <col />
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
                  const cp = () => getConnected(prov.id);
                  const activeCount = () =>
                    cp()?.connections.filter((c) => c.is_active).length ?? 0;
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
                          <Show when={activeCount() > 0}>
                            <span style="color: hsl(var(--success)); font-size: var(--font-size-xs); font-weight: 500; white-space: nowrap; display: inline-flex; align-items: center; gap: 4px;">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="8"
                                height="8"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                                aria-hidden="true"
                              >
                                <path d="M12 5a7 7 0 1 0 0 14 7 7 0 1 0 0-14" />
                              </svg>
                              {activeCount()} active{' '}
                              {activeCount() === 1 ? 'connection' : 'connections'}
                            </span>
                          </Show>
                          <button
                            class="btn btn--outline btn--sm"
                            style="white-space: nowrap;"
                            onClick={() => openConnect(prov.id)}
                          >
                            Add subscription
                          </button>
                        </span>
                      </td>
                    </tr>
                  );
                }}
              </For>
            </tbody>
          </table>
        </div>
      </Show>

      <Show when={viewMode() === 'grid'}>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 24px;">
          <For each={SUBSCRIPTION_PROVIDERS}>
            {(prov) => {
              const cp = () => getConnected(prov.id);
              const activeCount = () => cp()?.connections.filter((c) => c.is_active).length ?? 0;
              return (
                <div
                  class="panel"
                  style="padding: 16px; display: flex; flex-direction: column; gap: 12px; margin-bottom: 0;"
                >
                  <div style="display: flex; align-items: center; justify-content: space-between;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                      <span style="display: flex; align-items: center; width: 24px; height: 24px;">
                        {providerIcon(prov.id, 24)}
                      </span>
                      <span style="font-weight: 600; font-size: var(--font-size-sm); color: hsl(var(--foreground));">
                        {prov.name}
                      </span>
                    </div>
                    <span style="font-size: var(--font-size-xs); color: hsl(var(--muted-foreground));">
                      {getModelCount(prov.id) ?? 0} models
                    </span>
                  </div>
                  <div style="display: flex; align-items: center; justify-content: space-between;">
                    <Show when={activeCount() > 0} fallback={<span />}>
                      <span style="color: hsl(var(--success)); font-size: var(--font-size-xs); font-weight: 500; display: inline-flex; align-items: center; gap: 4px;">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="8"
                          height="8"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path d="M12 5a7 7 0 1 0 0 14 7 7 0 1 0 0-14" />
                        </svg>
                        {activeCount()} active {activeCount() === 1 ? 'connection' : 'connections'}
                      </span>
                    </Show>
                    <button
                      class="btn btn--outline btn--sm"
                      style="font-size: var(--font-size-xs); white-space: nowrap;"
                      onClick={() => openConnect(prov.id)}
                    >
                      Add subscription
                    </button>
                  </div>
                </div>
              );
            }}
          </For>
        </div>
      </Show>

      <Show when={showModal() && firstAgentName()}>
        <ProviderSelectModal
          agentName={firstAgentName()}
          providers={modalProviders() ?? []}
          providerDeepLink={providerDeepLink()}
          initialTab="subscription"
          onUpdate={async () => {
            await refetchModalProviders();
            refetch();
          }}
          onClose={handleModalClose}
        />
      </Show>
    </div>
  );
};

export default Subscriptions;
