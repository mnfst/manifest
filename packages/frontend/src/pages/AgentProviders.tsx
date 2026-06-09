import { useParams } from '@solidjs/router';
import { createResource, createSignal, For, Show, type Component } from 'solid-js';
import {
  disableAgentProviderAccess,
  enableAgentProviderAccess,
  getAgentProviderAccess,
  getAgentProviderDisableImpact,
  getCustomProviders,
} from '../services/api.js';
import { getProviders as getGlobalProviders } from '../services/api/providers.js';
import { PROVIDERS } from '../services/providers.js';
import { customProviderColor } from '../services/formatters.js';
import { providerIcon } from '../components/ProviderIcon.jsx';
import '../styles/routing.css';

const AUTH_BADGES: Record<string, string> = {
  api_key: 'API Key',
  subscription: 'Subscription',
  local: 'Local',
};

interface AgentProviderConnection {
  userProviderId: string;
  provider: string;
  authType: string;
  label: string;
  models: number;
}

const AgentProviders: Component = () => {
  const params = useParams<{ agentName: string }>();
  const agentName = () => decodeURIComponent(params.agentName);

  const [providers] = createResource(async () => {
    try {
      return (await getGlobalProviders()).providers;
    } catch {
      return [];
    }
  });

  const [access, { refetch: refetchAccess }] = createResource(
    () => agentName(),
    async (name) => {
      try {
        return new Set((await getAgentProviderAccess(name)).enabled);
      } catch {
        return new Set<string>();
      }
    },
  );

  const [customProviders] = createResource(
    () => agentName(),
    (name) => getCustomProviders(name).catch(() => []),
  );

  const connections = (): AgentProviderConnection[] => {
    const rows: AgentProviderConnection[] = [];
    for (const provider of providers() ?? []) {
      for (const connection of provider.connections) {
        if (!connection.is_active) continue;
        rows.push({
          userProviderId: connection.id,
          provider: provider.provider,
          authType: provider.auth_type,
          label: connection.label,
          models: connection.cached_model_count || provider.total_models,
        });
      }
    }
    return rows;
  };

  const [busy, setBusy] = createSignal<string | null>(null);
  const [confirmTarget, setConfirmTarget] = createSignal<AgentProviderConnection | null>(null);
  const [impactTiers, setImpactTiers] = createSignal<
    Array<{ tier: string; model: string; position: string }>
  >([]);

  const isEnabled = (userProviderId: string) => access()?.has(userProviderId) ?? false;

  const providerName = (providerId: string) => {
    const known = PROVIDERS.find((provider) => provider.id === providerId);
    if (known) return known.name;
    if (providerId.startsWith('custom:')) {
      const customId = providerId.slice('custom:'.length);
      const custom = (customProviders() ?? []).find((provider) => provider.id === customId);
      if (custom) return custom.name;
    }
    return providerId;
  };

  const loadImpact = async (userProviderId: string) => {
    try {
      return (await getAgentProviderDisableImpact(agentName(), userProviderId)).affected_tiers;
    } catch {
      return [];
    }
  };

  const enableConnection = async (userProviderId: string) => {
    setBusy(userProviderId);
    try {
      await enableAgentProviderAccess(agentName(), userProviderId);
      await refetchAccess();
    } catch {
      // fetchMutate already surfaces the toast.
    } finally {
      setBusy(null);
    }
  };

  const disableConnection = async (userProviderId: string) => {
    setBusy(userProviderId);
    try {
      await disableAgentProviderAccess(agentName(), userProviderId);
      await refetchAccess();
    } catch {
      // fetchMutate already surfaces the toast.
    } finally {
      setBusy(null);
      setConfirmTarget(null);
      setImpactTiers([]);
    }
  };

  const handleToggle = async (connection: AgentProviderConnection) => {
    if (!isEnabled(connection.userProviderId)) {
      await enableConnection(connection.userProviderId);
      return;
    }
    setImpactTiers(await loadImpact(connection.userProviderId));
    setConfirmTarget(connection);
  };

  return (
    <div>
      <p style="color: hsl(var(--muted-foreground)); font-size: var(--font-size-sm); margin-bottom: 16px;">
        Enable the global provider connections this harness may use. Turning a provider off removes
        routing assignments that depend on its models.
      </p>

      <Show
        when={connections().length > 0}
        fallback={
          <div style="display: flex; flex-direction: column; align-items: center; text-align: center; padding: 48px 24px; gap: 8px; width: 100%; background: hsl(var(--muted) / 0.45); border-radius: var(--radius);">
            <p style="font-size: var(--font-size-base); font-weight: 600; color: hsl(var(--foreground)); margin: 0;">
              No providers connected
            </p>
            <p style="font-size: var(--font-size-sm); color: hsl(var(--muted-foreground)); margin: 0;">
              Connect providers in the Subscriptions, BYOK, or Local pages first.
            </p>
          </div>
        }
      >
        <div class="panel" style="padding: 0; overflow-x: auto;">
          <table class="data-table" style="min-width: 600px; table-layout: fixed;">
            <colgroup>
              <col style="width: 220px;" />
              <col style="width: 120px;" />
              <col style="width: 140px;" />
              <col style="width: 80px;" />
              <col />
            </colgroup>
            <thead>
              <tr>
                <th>Provider</th>
                <th>Type</th>
                <th>Connection</th>
                <th>Models</th>
                <th />
              </tr>
            </thead>
            <tbody>
              <For each={connections()}>
                {(connection) => {
                  const enabled = () => isEnabled(connection.userProviderId);
                  const name = () => providerName(connection.provider);
                  return (
                    <tr style={{ opacity: enabled() ? '1' : '0.55' }}>
                      <td>
                        <span style="display: flex; align-items: center; gap: 10px;">
                          <Show
                            when={providerIcon(connection.provider, 20)}
                            fallback={
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
                                  background: customProviderColor(name()),
                                }}
                              >
                                {name().charAt(0).toUpperCase()}
                              </span>
                            }
                          >
                            <span style="display: flex; align-items: center; width: 20px; height: 20px;">
                              {providerIcon(connection.provider, 20)}
                            </span>
                          </Show>
                          <span style="font-weight: 500;">{name()}</span>
                        </span>
                      </td>
                      <td>
                        <span style="font-size: var(--font-size-xs); color: hsl(var(--muted-foreground));">
                          {AUTH_BADGES[connection.authType] ?? connection.authType}
                        </span>
                      </td>
                      <td style="color: hsl(var(--muted-foreground));">{connection.label}</td>
                      <td>{connection.models || '-'}</td>
                      <td style="text-align: right;">
                        <button
                          class="routing-switch"
                          classList={{ 'routing-switch--on': enabled() }}
                          disabled={busy() === connection.userProviderId}
                          aria-label={`${enabled() ? 'Disable' : 'Enable'} ${name()} ${
                            connection.label
                          }`}
                          onClick={() => void handleToggle(connection)}
                        >
                          <span class="routing-switch__track">
                            <span class="routing-switch__thumb" />
                          </span>
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

      <Show when={confirmTarget()}>
        {(target) => (
          <div
            class="modal-overlay"
            onClick={(event) => {
              if (event.target === event.currentTarget) setConfirmTarget(null);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setConfirmTarget(null);
              if (event.key === 'Enter') void disableConnection(target().userProviderId);
            }}
          >
            <div
              class="modal-card"
              style="max-width: 440px;"
              role="dialog"
              aria-modal="true"
              onClick={(event) => event.stopPropagation()}
            >
              <h2 class="modal-card__title">Disable provider</h2>
              <p class="modal-card__desc">
                This harness will no longer route requests through{' '}
                <strong style="color: hsl(var(--foreground));">
                  {providerName(target().provider)}
                </strong>
                . You can re-enable it later.
              </p>
              <Show when={impactTiers().length > 0}>
                <div style="margin-top: 12px; padding: 12px; background: hsl(var(--muted) / 0.45); border-radius: var(--radius); font-size: var(--font-size-sm);">
                  <p style="margin: 0 0 8px; font-weight: 600; color: hsl(var(--foreground));">
                    The following routing assignments will be removed:
                  </p>
                  <For each={impactTiers()}>
                    {(item) => (
                      <div style="display: flex; justify-content: space-between; gap: 12px; padding: 4px 0; color: hsl(var(--muted-foreground));">
                        <span>
                          {item.tier} - {item.position}
                        </span>
                        <span style="font-family: monospace;">{item.model}</span>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
              <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px;">
                <button class="btn btn--ghost btn--sm" onClick={() => setConfirmTarget(null)}>
                  Keep enabled
                </button>
                <button
                  class="btn btn--primary btn--sm"
                  disabled={busy() === target().userProviderId}
                  onClick={() => void disableConnection(target().userProviderId)}
                >
                  Disable
                </button>
              </div>
            </div>
          </div>
        )}
      </Show>
    </div>
  );
};

export default AgentProviders;
