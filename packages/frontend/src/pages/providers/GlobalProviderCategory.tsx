import { createMemo, createResource, createSignal, For, Show, type Component } from 'solid-js';
import { Meta, Title } from '@solidjs/meta';
import {
  disconnectGlobalProvider,
  getGlobalProviders,
  refreshGlobalProviderModels,
  type AuthType,
  type RoutingProvider,
} from '../../services/api.js';
import { PROVIDERS, type ProviderDef } from '../../services/providers.js';
import { providerIcon } from '../../components/ProviderIcon.js';
import { formatTimeAgo } from '../../services/formatters.js';
import { toast } from '../../services/toast-store.js';
import ProviderSelectModal from '../../components/ProviderSelectModal.js';
import type { ProviderDeepLink } from '../../services/routing-params.js';
import '../../styles/global-providers.css';

type GlobalProviderCategory = 'subscription' | 'api_key' | 'local';

interface CategoryConfig {
  authType: GlobalProviderCategory;
  title: string;
  documentTitle: string;
  description: string;
  addButton: string;
  libraryButton?: string;
  connectedTitle: string;
  supportedTitle: string;
  emptyTitle: string;
  providerFilter: (provider: ProviderDef) => boolean;
}

const providerName = (id: string): string => PROVIDERS.find((p) => p.id === id)?.name ?? id;

const supportsGlobalSubscription = (provider: ProviderDef): boolean => {
  if (!provider.supportsSubscription) return false;
  if (provider.deviceLogin) return false;
  if (provider.subscriptionTokenAlternative) return true;
  return (
    provider.subscriptionAuthMode !== 'popup_oauth' &&
    provider.subscriptionAuthMode !== 'popup_paste' &&
    provider.subscriptionAuthMode !== 'device_code'
  );
};

const CATEGORY_CONFIG: Record<GlobalProviderCategory, CategoryConfig> = {
  subscription: {
    authType: 'subscription',
    title: 'Subscriptions',
    documentTitle: 'Subscriptions - Manifest',
    description: 'Connect flat-rate subscriptions to route agents through your existing plans.',
    addButton: 'Add subscription',
    connectedTitle: 'My Subscriptions',
    supportedTitle: 'Supported subscriptions',
    emptyTitle: 'No subscriptions connected',
    providerFilter: supportsGlobalSubscription,
  },
  api_key: {
    authType: 'api_key',
    title: 'Bring Your Own Key',
    documentTitle: 'API Keys - Manifest',
    description: 'Connect providers using your own API keys for pay-as-you-go usage.',
    addButton: 'Add API key',
    connectedTitle: 'My API Keys',
    supportedTitle: 'Supported API key providers',
    emptyTitle: 'No API keys connected',
    providerFilter: (provider) => !provider.subscriptionOnly && !provider.localOnly,
  },
  local: {
    authType: 'local',
    title: 'Local Providers',
    documentTitle: 'Local Providers - Manifest',
    description: 'Connect to LLM servers running on your machine.',
    addButton: 'Add local provider',
    libraryButton: 'Connect',
    connectedTitle: 'My Local Providers',
    supportedTitle: 'Supported local providers',
    emptyTitle: 'No local providers connected',
    providerFilter: (provider) => Boolean(provider.localOnly),
  },
};

const authTypeLabel = (authType: AuthType): string => {
  if (authType === 'subscription') return 'Subscription';
  if (authType === 'local') return 'Local';
  return 'API key';
};

const modelCountForProvider = (provider: ProviderDef, rows: RoutingProvider[]): string => {
  const connectedModels = rows
    .filter((row) => row.provider === provider.id && row.is_active)
    .reduce((total, row) => total + (row.cached_model_count ?? 0), 0);
  if (connectedModels > 0) return `${connectedModels}`;
  if (provider.models.length > 0) return `${provider.models.length}`;
  return 'Dynamic';
};

const GlobalProviderCategoryPage: Component<{ category: GlobalProviderCategory }> = (props) => {
  const config = () => CATEGORY_CONFIG[props.category];
  const [providers, { refetch }] = createResource(getGlobalProviders);
  const categoryProviders = createMemo(() => PROVIDERS.filter(config().providerFilter));
  const [busyId, setBusyId] = createSignal<string | null>(null);
  const [showModal, setShowModal] = createSignal(false);
  const [deepLinkProvider, setDeepLinkProvider] = createSignal<string | null>(null);
  const [viewMode, setViewMode] = createSignal<'list' | 'grid'>('list');

  const providerRows = createMemo(() =>
    (providers() ?? [])
      .filter((row) => row.auth_type === config().authType)
      .slice()
      .sort((a, b) => {
        const name = providerName(a.provider).localeCompare(providerName(b.provider));
        if (name !== 0) return name;
        return a.priority - b.priority;
      }),
  );
  const activeRows = createMemo(() => providerRows().filter((row) => row.is_active));
  const activeProviderCount = createMemo(
    () => new Set(activeRows().map((row) => row.provider)).size,
  );
  const totalCachedModels = createMemo(() =>
    activeRows().reduce((total, row) => total + (row.cached_model_count ?? 0), 0),
  );
  const activeConnectionsFor = (id: string) =>
    activeRows().filter((row) => row.provider === id).length;

  const openConnect = (providerId?: string) => {
    setDeepLinkProvider(providerId ?? null);
    setShowModal(true);
  };

  const handleModalClose = () => {
    setShowModal(false);
    setDeepLinkProvider(null);
    refetch();
  };

  const providerDeepLink = (): ProviderDeepLink | null => {
    const providerId = deepLinkProvider();
    if (!providerId) return null;
    return {
      providerId,
      authType: config().authType,
      closeOnBack: true,
      addKey: activeConnectionsFor(providerId) > 0,
    };
  };

  const handleRefresh = async (row: RoutingProvider) => {
    setBusyId(row.id);
    try {
      const result = await refreshGlobalProviderModels(row.provider, row.auth_type);
      if (result.ok) {
        toast.success(
          `Refreshed ${result.model_count} model${result.model_count === 1 ? '' : 's'}`,
        );
      } else {
        toast.error(result.error ?? 'Refresh failed');
      }
      await refetch();
    } catch {
      // fetchMutate already shows the server error.
    } finally {
      setBusyId(null);
    }
  };

  const handleDisconnect = async (row: RoutingProvider) => {
    setBusyId(row.id);
    try {
      await disconnectGlobalProvider(row.provider, row.auth_type, row.label);
      toast.success(`${providerName(row.provider)} disconnected`);
      await refetch();
    } catch {
      // fetchMutate already shows the server error.
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <Title>{config().documentTitle}</Title>
      <Meta name="description" content={config().description} />
      <div class="container--lg global-providers-page">
        <header class="page-header global-providers-header">
          <div>
            <h1 class="page-header__title">{config().title}</h1>
            <p class="page-header__subtitle">{config().description}</p>
          </div>
          <button class="btn btn--primary btn--sm" onClick={() => openConnect()}>
            {config().addButton}
          </button>
        </header>

        <div class="global-provider-stats" aria-label={`${config().title} summary`}>
          <div class="chart-card global-provider-stat">
            <span class="chart-card__label">Active connections</span>
            <div class="chart-card__value-row">
              <span class="chart-card__value">{activeRows().length}</span>
            </div>
          </div>
          <div class="chart-card global-provider-stat">
            <span class="chart-card__label">Connected providers</span>
            <div class="chart-card__value-row">
              <span class="chart-card__value">{activeProviderCount()}</span>
            </div>
          </div>
          <div class="chart-card global-provider-stat">
            <span class="chart-card__label">Cached models</span>
            <div class="chart-card__value-row">
              <span class="chart-card__value">{totalCachedModels()}</span>
            </div>
          </div>
        </div>

        <section aria-labelledby="global-provider-list-title">
          <div class="global-provider-section-heading">
            <h2 id="global-provider-list-title">{config().connectedTitle}</h2>
            <span>
              {activeRows().length} active / {providerRows().length} total
            </span>
          </div>

          <Show
            when={providerRows().length > 0}
            fallback={
              <div class="empty-state">
                <div class="empty-state__title">{config().emptyTitle}</div>
              </div>
            }
          >
            <div class="panel global-provider-table-panel">
              <table class="data-table global-provider-table">
                <colgroup>
                  <col class="global-provider-table__provider" />
                  <col class="global-provider-table__models" />
                  <col class="global-provider-table__label" />
                  <col class="global-provider-table__credential" />
                  <col class="global-provider-table__status" />
                  <col class="global-provider-table__refreshed" />
                  <col class="global-provider-table__actions" />
                </colgroup>
                <thead>
                  <tr>
                    <th>Provider</th>
                    <th>Models</th>
                    <th>Name</th>
                    <th>Credential</th>
                    <th>Status</th>
                    <th>Refreshed</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  <For each={providerRows()}>
                    {(row) => {
                      const definition = () => PROVIDERS.find((p) => p.id === row.provider);
                      return (
                        <tr classList={{ 'global-provider-table__row--inactive': !row.is_active }}>
                          <td>
                            <span class="global-provider-name">
                              <span class="global-provider-name__icon">
                                {providerIcon(row.provider, 20) ?? (
                                  <span
                                    class="global-provider-logo-letter"
                                    style={{
                                      background: definition()?.color ?? 'hsl(var(--muted))',
                                    }}
                                  >
                                    {(
                                      definition()?.initial ??
                                      row.provider[0] ??
                                      '?'
                                    ).toUpperCase()}
                                  </span>
                                )}
                              </span>
                              <span class="global-provider-name__text">
                                {providerName(row.provider)}
                              </span>
                            </span>
                          </td>
                          <td>{row.cached_model_count ?? 0}</td>
                          <td>{row.label}</td>
                          <td class="global-provider-muted">
                            {row.key_prefix
                              ? `${row.key_prefix}********`
                              : row.region
                                ? row.region
                                : authTypeLabel(row.auth_type)}
                          </td>
                          <td>
                            <Show
                              when={row.is_active}
                              fallback={
                                <span class="global-provider-status global-provider-status--muted">
                                  Inactive
                                </span>
                              }
                            >
                              <span class="global-provider-status global-provider-status--active">
                                Active
                              </span>
                            </Show>
                          </td>
                          <td class="global-provider-muted">
                            {row.models_fetched_at ? formatTimeAgo(row.models_fetched_at) : '-'}
                          </td>
                          <td>
                            <span class="global-provider-actions">
                              <button
                                class="btn btn--outline btn--sm"
                                disabled={busyId() === row.id || !row.is_active}
                                onClick={() => void handleRefresh(row)}
                              >
                                Refresh
                              </button>
                              <button
                                class="btn btn--ghost btn--sm"
                                disabled={busyId() === row.id || !row.is_active}
                                onClick={() => void handleDisconnect(row)}
                              >
                                Disconnect
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
        </section>

        <section aria-labelledby="global-provider-library-title">
          <div class="global-provider-section-heading">
            <h2 id="global-provider-library-title">{config().supportedTitle}</h2>
            <div class="panel__tabs" role="tablist" aria-label="Provider library view">
              <button
                role="tab"
                aria-selected={viewMode() === 'list'}
                class="panel__tab"
                classList={{ 'panel__tab--active': viewMode() === 'list' }}
                onClick={() => setViewMode('list')}
                aria-label="List view"
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
            <div class="panel global-provider-table-panel">
              <table class="data-table global-provider-table global-provider-table--library">
                <colgroup>
                  <col class="global-provider-table__provider" />
                  <col class="global-provider-table__models" />
                  <col class="global-provider-table__status" />
                  <col class="global-provider-table__actions" />
                </colgroup>
                <thead>
                  <tr>
                    <th>Provider</th>
                    <th>Models</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  <For each={categoryProviders()}>
                    {(provider) => {
                      const activeCount = () => activeConnectionsFor(provider.id);
                      return (
                        <tr>
                          <td>
                            <span class="global-provider-name">
                              <span class="global-provider-name__icon">
                                {providerIcon(provider.id, 20) ?? (
                                  <span
                                    class="global-provider-logo-letter"
                                    style={{ background: provider.color }}
                                  >
                                    {provider.initial.toUpperCase()}
                                  </span>
                                )}
                              </span>
                              <span class="global-provider-name__text">{provider.name}</span>
                            </span>
                          </td>
                          <td>{modelCountForProvider(provider, providerRows())}</td>
                          <td>
                            <Show
                              when={activeCount() > 0}
                              fallback={<span class="global-provider-muted">Not connected</span>}
                            >
                              <span class="global-provider-connected">
                                {activeCount()} active{' '}
                                {activeCount() === 1 ? 'connection' : 'connections'}
                              </span>
                            </Show>
                          </td>
                          <td>
                            <span class="global-provider-actions">
                              <button
                                class="btn btn--outline btn--sm"
                                onClick={() => openConnect(provider.id)}
                              >
                                {config().libraryButton ?? config().addButton}
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
            <div class="global-provider-library-grid">
              <For each={categoryProviders()}>
                {(provider) => {
                  const activeCount = () => activeConnectionsFor(provider.id);
                  return (
                    <div class="panel global-provider-library-card">
                      <div class="global-provider-library-card__header">
                        <span class="global-provider-name">
                          <span class="global-provider-name__icon">
                            {providerIcon(provider.id, 24) ?? (
                              <span
                                class="global-provider-logo-letter"
                                style={{ background: provider.color }}
                              >
                                {provider.initial.toUpperCase()}
                              </span>
                            )}
                          </span>
                          <span class="global-provider-name__text">{provider.name}</span>
                        </span>
                        <span class="global-provider-muted">
                          {modelCountForProvider(provider, providerRows())} models
                        </span>
                      </div>
                      <div class="global-provider-library-card__footer">
                        <Show when={activeCount() > 0} fallback={<span />}>
                          <span class="global-provider-connected">
                            {activeCount()} active{' '}
                            {activeCount() === 1 ? 'connection' : 'connections'}
                          </span>
                        </Show>
                        <button
                          class="btn btn--outline btn--sm"
                          onClick={() => openConnect(provider.id)}
                        >
                          {config().libraryButton ?? config().addButton}
                        </button>
                      </div>
                    </div>
                  );
                }}
              </For>
            </div>
          </Show>
        </section>
        <Show when={showModal()}>
          <ProviderSelectModal
            agentName=""
            providers={providers() ?? []}
            customProviders={[]}
            providerDeepLink={providerDeepLink()}
            initialTab={config().authType}
            connectionScope="global"
            onUpdate={() => refetch()}
            onClose={handleModalClose}
          />
        </Show>
      </div>
    </>
  );
};

export default GlobalProviderCategoryPage;
