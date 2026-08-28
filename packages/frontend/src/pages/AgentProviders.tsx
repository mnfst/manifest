import { useParams } from '@solidjs/router';
import { createResource, createSignal, For, Show, type Component } from 'solid-js';
import {
  disableProviderForAgent,
  enableProviderForAgent,
  getEnabledProviders,
  getAgentProviderDisableImpact,
  getCustomProviders,
} from '../services/api.js';
import { getProviders as getGlobalProviders } from '../services/api/providers.js';
import { getAgentModelAccess, type ProviderModelAccess } from '../services/api/teams.js';
import { PROVIDERS } from '../services/providers.js';
import { toast } from '../services/toast-store.js';
import { customProviderColor } from '../services/formatters.js';
import { providerIcon } from '../components/ProviderIcon.jsx';
import NoConnectionsPrompt from '../components/NoConnectionsPrompt.jsx';
import ModelAccessModal from '../components/ModelAccessModal.jsx';
import '../styles/routing.css';

const AUTH_BADGES: Record<string, string> = {
  api_key: 'API key',
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

/**
 * Providers and models. Each provider row: name, connection type, models
 * enabled, a toggle for the whole provider (as before) and a "Models" button
 * that opens that provider's model list. Turning a provider off keeps its
 * model selection so turning it back on restores it.
 */
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
        return new Set((await getEnabledProviders(name)).enabled);
      } catch {
        return new Set<string>();
      }
    },
  );

  // `null` means the lookup failed. It is not an empty list: showing every
  // model as allowed would let a Save replace the real selection.
  const [modelAccess, { mutate: mutateModelAccess, refetch: refetchModelAccess }] = createResource(
    () => agentName(),
    async (name): Promise<ProviderModelAccess[] | null> => {
      try {
        return await getAgentModelAccess(name);
      } catch {
        return null;
      }
    },
  );
  const modelAccessFailed = () => modelAccess() === null;
  // The editor stays closed until the lookup resolved: opening it on an
  // unknown record would let an early Save replace the real selection.
  const modelAccessReady = () => !modelAccess.loading && modelAccess() != null;

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
  const [editing, setEditing] = createSignal<ProviderModelAccess | null>(null);

  const isEnabled = (userProviderId: string) => access()?.has(userProviderId) ?? false;
  const accessFor = (userProviderId: string) =>
    (modelAccess() ?? []).find((p) => p.user_provider_id === userProviderId) ?? null;

  const modelsLabel = (connection: AgentProviderConnection): string => {
    if (!isEnabled(connection.userProviderId)) return 'Off';
    if (modelAccessFailed()) return 'Unavailable';
    if (!modelAccessReady()) return '…';
    const a = accessFor(connection.userProviderId);
    if (!a) return connection.models ? `All ${connection.models}` : '-';
    if (a.all_models) return `All ${a.total_count}`;
    return `${a.enabled_count} of ${a.total_count}`;
  };

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

  const enableConnection = async (userProviderId: string) => {
    setBusy(userProviderId);
    try {
      await enableProviderForAgent(agentName(), userProviderId);
      await refetchAccess();
    } catch {
      // fetchMutate already surfaces the toast.
    } finally {
      setBusy(null);
    }
  };

  const handleToggle = async (connection: AgentProviderConnection) => {
    if (!isEnabled(connection.userProviderId)) {
      await enableConnection(connection.userProviderId);
      return;
    }

    setBusy(connection.userProviderId);

    // A provider whose models are wired into this agent's routing can't be
    // disabled — that would silently strip live tier assignments. Block it with
    // an error and tell the user to update routing first, rather than removing
    // the assignments for them.
    let affectedTiers: Array<{ tier: string; model: string; position: string }>;
    try {
      affectedTiers = (await getAgentProviderDisableImpact(agentName(), connection.userProviderId))
        .affected_tiers;
    } catch {
      setBusy(null);
      toast.error("Couldn't check this provider's routing impact. Please try again.");
      return;
    }

    if (affectedTiers.length > 0) {
      setBusy(null);
      toast.error(
        `Can't disable ${providerName(connection.provider)}. Its models are assigned to this agent's routing. Update routing to stop using them first.`,
      );
      return;
    }

    try {
      await disableProviderForAgent(agentName(), connection.userProviderId);
      await refetchAccess();
    } catch {
      // fetchMutate already surfaces the toast.
    } finally {
      setBusy(null);
    }
  };

  const openModels = (connection: AgentProviderConnection) => {
    const a = accessFor(connection.userProviderId);
    setEditing(
      a ?? {
        user_provider_id: connection.userProviderId,
        provider: connection.provider,
        auth_type: connection.authType,
        label: connection.label,
        provider_enabled: true,
        all_models: true,
        models: [],
        enabled_count: 0,
        total_count: 0,
      },
    );
  };

  const handleSaved = (updated: ProviderModelAccess) => {
    mutateModelAccess((list) => {
      const rest = (list ?? []).filter((p) => p.user_provider_id !== updated.user_provider_id);
      return [...rest, updated];
    });
  };

  return (
    <div>
      <Show when={modelAccessFailed()}>
        <div class="bulk-result bulk-result--failed" role="alert">
          <div style="display: flex; align-items: center; gap: var(--gap-sm);">
            <span style="flex: 1;">
              Model access couldn't be loaded, so the per-model switches are disabled until it does.
            </span>
            <button
              type="button"
              class="btn btn--outline btn--sm"
              onClick={() => void refetchModelAccess()}
            >
              Retry
            </button>
          </div>
        </div>
      </Show>
      <p style="color: hsl(var(--muted-foreground)); font-size: var(--font-size-sm); margin-bottom: 16px;">
        Enable the provider connections this agent may use, then choose its models provider by
        provider. A provider can't be turned off while its models are assigned to this agent's
        routing. Turning a provider off keeps its model selection.
      </p>

      <Show when={connections().length > 0} fallback={<NoConnectionsPrompt />}>
        <div class="panel" style="padding: 0; overflow-x: auto;">
          <table class="data-table" style="min-width: 640px; table-layout: fixed;">
            <colgroup>
              <col style="width: 200px;" />
              <col style="width: 110px;" />
              <col />
              <col style="width: 100px;" />
              <col style="width: 150px;" />
            </colgroup>
            <thead>
              <tr>
                <th>Provider</th>
                <th>Connection</th>
                <th>Label</th>
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
                      <td>
                        <span
                          title={connection.label}
                          style={{
                            display: 'block',
                            overflow: 'hidden',
                            'text-overflow': 'ellipsis',
                            color: 'hsl(var(--muted-foreground))',
                          }}
                        >
                          {connection.label}
                        </span>
                      </td>
                      <td class="num" classList={{ 'num--muted': !enabled() }}>
                        {modelsLabel(connection)}
                      </td>
                      <td style="text-align: right;">
                        <span style="display: inline-flex; align-items: center; gap: 10px; justify-content: flex-end;">
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
                          <button
                            type="button"
                            class="btn btn--outline btn--sm"
                            disabled={!enabled() || !modelAccessReady()}
                            title={
                              modelAccessFailed()
                                ? 'Model access could not be loaded. Retry above.'
                                : undefined
                            }
                            aria-label={`Models for ${name()} ${connection.label}`}
                            onClick={() => openModels(connection)}
                          >
                            Models
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

      <Show when={editing()}>
        <ModelAccessModal
          open={editing() !== null}
          agentName={agentName()}
          access={editing()!}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      </Show>
    </div>
  );
};

export default AgentProviders;
