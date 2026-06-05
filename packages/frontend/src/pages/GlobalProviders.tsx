import { createMemo, createResource, createSignal, For, Show, type Component } from 'solid-js';
import { Meta, Title } from '@solidjs/meta';
import {
  connectGlobalProvider,
  disconnectGlobalProvider,
  getGlobalProviders,
  refreshGlobalProviderModels,
  type AuthType,
  type RoutingProvider,
} from '../services/api.js';
import { PROVIDERS, type ProviderDef } from '../services/providers.js';
import { providerIcon } from '../components/ProviderIcon.js';
import { validateApiKey, validateSubscriptionKey } from '../services/provider-utils.js';
import { formatTimeAgo } from '../services/formatters.js';
import { toast } from '../services/toast-store.js';
import '../styles/global-providers.css';

const providerName = (id: string): string => PROVIDERS.find((p) => p.id === id)?.name ?? id;

const supportsGlobalSubscription = (provider: ProviderDef): boolean => {
  if (!provider.supportsSubscription) return false;
  if (provider.deviceLogin) return false;
  return (
    provider.subscriptionAuthMode !== 'popup_oauth' &&
    provider.subscriptionAuthMode !== 'popup_paste'
  );
};

const authTypeLabel = (authType: AuthType): string => {
  if (authType === 'subscription') return 'Subscription';
  if (authType === 'local') return 'Local';
  return 'API key';
};

const GlobalProviders: Component = () => {
  const [providers, { refetch }] = createResource(getGlobalProviders);
  const selectableProviders = () =>
    PROVIDERS.filter(
      (provider) => !provider.subscriptionOnly || supportsGlobalSubscription(provider),
    );
  const [providerId, setProviderId] = createSignal(selectableProviders()[0]?.id ?? 'openai');
  const [authType, setAuthType] = createSignal<AuthType>('api_key');
  const [apiKey, setApiKey] = createSignal('');
  const [label, setLabel] = createSignal('');
  const [region, setRegion] = createSignal<string | undefined>(undefined);
  const [saving, setSaving] = createSignal(false);
  const [busyId, setBusyId] = createSignal<string | null>(null);
  const selectedProvider = createMemo(
    () => PROVIDERS.find((p) => p.id === providerId()) ?? selectableProviders()[0],
  );
  const authOptions = createMemo<AuthType[]>(() => {
    const provider = selectedProvider();
    if (!provider) return ['api_key'];
    const options: AuthType[] = [];
    if (!provider.subscriptionOnly) options.push(provider.localOnly ? 'local' : 'api_key');
    if (supportsGlobalSubscription(provider)) options.push('subscription');
    return options.length > 0 ? options : ['api_key'];
  });
  const endpointRegions = () =>
    authType() === 'subscription' ? (selectedProvider()?.subscriptionEndpointRegions ?? []) : [];

  const providerRows = createMemo(() =>
    (providers() ?? []).slice().sort((a, b) => {
      const name = providerName(a.provider).localeCompare(providerName(b.provider));
      if (name !== 0) return name;
      if (a.auth_type !== b.auth_type) return a.auth_type.localeCompare(b.auth_type);
      return a.priority - b.priority;
    }),
  );

  const resetForm = () => {
    setApiKey('');
    setLabel('');
    setRegion(undefined);
  };

  const handleProviderChange = (id: string) => {
    setProviderId(id);
    const nextProvider = PROVIDERS.find((p) => p.id === id);
    if (nextProvider?.subscriptionOnly && supportsGlobalSubscription(nextProvider)) {
      setAuthType('subscription');
    } else if (nextProvider?.localOnly) {
      setAuthType('local');
    } else {
      setAuthType('api_key');
    }
    resetForm();
  };

  const handleConnect = async () => {
    const provider = selectedProvider();
    if (!provider) return;
    const key = apiKey().replace(/\s/g, '');
    if (authType() === 'api_key' && !provider.noKeyRequired) {
      const result = validateApiKey(provider, key);
      if (!result.valid) {
        toast.error(result.error ?? 'Invalid API key');
        return;
      }
    }
    if (authType() === 'subscription' && provider.subscriptionKeyPlaceholder) {
      const result = validateSubscriptionKey(provider, key);
      if (!result.valid) {
        toast.error(result.error ?? 'Invalid subscription credential');
        return;
      }
    }

    setSaving(true);
    try {
      await connectGlobalProvider({
        provider: provider.id,
        authType: authType(),
        ...(key ? { apiKey: key } : {}),
        ...(label().trim() ? { label: label().trim() } : {}),
        ...(region() ? { region: region() } : {}),
      });
      toast.success(`${provider.name} connected`);
      resetForm();
      await refetch();
    } catch {
      // fetchMutate already shows the server error.
    } finally {
      setSaving(false);
    }
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
      <Title>Providers - Manifest</Title>
      <Meta name="description" content="Manage global Manifest provider connections." />
      <div class="global-providers-page">
        <header class="page-header">
          <div>
            <span class="breadcrumb">Tenant</span>
            <h1>Providers</h1>
          </div>
        </header>

        <section class="global-provider-panel" aria-labelledby="add-global-provider-title">
          <div class="global-provider-panel__header">
            <h2 id="add-global-provider-title">Add provider</h2>
          </div>
          <div class="global-provider-form">
            <label>
              Provider
              <select
                value={providerId()}
                onChange={(e) => handleProviderChange(e.currentTarget.value)}
                disabled={saving()}
              >
                <For each={selectableProviders()}>
                  {(provider) => <option value={provider.id}>{provider.name}</option>}
                </For>
              </select>
            </label>
            <label>
              Type
              <select
                value={authType()}
                onChange={(e) => {
                  setAuthType(e.currentTarget.value as AuthType);
                  setRegion(undefined);
                }}
                disabled={saving()}
              >
                <For each={authOptions()}>
                  {(option) => <option value={option}>{authTypeLabel(option)}</option>}
                </For>
              </select>
            </label>
            <Show when={endpointRegions().length > 0}>
              <label>
                Region
                <select
                  value={region() ?? endpointRegions()[0]?.value}
                  onChange={(e) => setRegion(e.currentTarget.value)}
                  disabled={saving()}
                >
                  <For each={endpointRegions()}>
                    {(option) => <option value={option.value}>{option.label}</option>}
                  </For>
                </select>
              </label>
            </Show>
            <label>
              Label
              <input
                value={label()}
                placeholder="Default"
                onInput={(e) => setLabel(e.currentTarget.value)}
                disabled={saving()}
              />
            </label>
            <Show when={authType() !== 'local' && !selectedProvider()?.noKeyRequired}>
              <label class="global-provider-form__key">
                Key
                <input
                  value={apiKey()}
                  placeholder={
                    authType() === 'subscription'
                      ? (selectedProvider()?.subscriptionKeyPlaceholder ?? 'Paste credential')
                      : (selectedProvider()?.keyPlaceholder ?? 'Paste API key')
                  }
                  onInput={(e) => setApiKey(e.currentTarget.value)}
                  disabled={saving()}
                />
              </label>
            </Show>
            <button class="btn btn--primary btn--sm" onClick={handleConnect} disabled={saving()}>
              {saving() ? <span class="spinner" /> : 'Connect'}
            </button>
          </div>
        </section>

        <section class="global-provider-panel" aria-labelledby="global-provider-list-title">
          <div class="global-provider-panel__header">
            <h2 id="global-provider-list-title">Connections</h2>
            <span>{providerRows().filter((row) => row.is_active).length} active</span>
          </div>

          <Show
            when={providerRows().length > 0}
            fallback={
              <div class="empty-state">
                <div class="empty-state__title">No global providers yet</div>
              </div>
            }
          >
            <div class="global-provider-list">
              <For each={providerRows()}>
                {(row) => {
                  const definition = () => PROVIDERS.find((p) => p.id === row.provider);
                  return (
                    <div class="global-provider-row" classList={{ 'is-inactive': !row.is_active }}>
                      <div class="global-provider-row__icon">
                        {providerIcon(row.provider, 24) ?? (
                          <span
                            class="provider-card__logo-letter"
                            style={{ background: definition()?.color ?? 'hsl(var(--muted))' }}
                          >
                            {(definition()?.initial ?? row.provider[0] ?? '?').toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div class="global-provider-row__main">
                        <div class="global-provider-row__title">
                          <span>{providerName(row.provider)}</span>
                          <span class="global-provider-row__pill">
                            {authTypeLabel(row.auth_type)}
                          </span>
                          <Show when={!row.is_active}>
                            <span class="global-provider-row__pill">Inactive</span>
                          </Show>
                        </div>
                        <div class="global-provider-row__meta">
                          <span>{row.label}</span>
                          <Show when={row.key_prefix}>
                            <span>{row.key_prefix}********</span>
                          </Show>
                          <span>{row.cached_model_count ?? 0} models</span>
                          <Show when={row.models_fetched_at}>
                            <span>refreshed {formatTimeAgo(row.models_fetched_at ?? null)}</span>
                          </Show>
                        </div>
                      </div>
                      <div class="global-provider-row__actions">
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
                      </div>
                    </div>
                  );
                }}
              </For>
            </div>
          </Show>
        </section>
      </div>
    </>
  );
};

export default GlobalProviders;
