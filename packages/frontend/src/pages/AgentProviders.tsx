import { useParams } from '@solidjs/router';
import { createResource, createSignal, For, Show, type Component } from 'solid-js';
import { fetchJson, fetchMutate } from '../services/api/core.js';
import { getCustomProviders } from '../services/api.js';
import { PROVIDERS } from '../services/providers.js';
import { providerIcon } from '../components/ProviderIcon.jsx';
import { customProviderColor } from '../services/formatters.js';
import { toast } from '../services/toast-store.js';

interface Connection {
  id: string;
  label: string;
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
}

const AUTH_BADGES: Record<string, string> = {
  subscription: 'Subscription',
  api_key: 'API Key',
  local: 'Local',
};

const AgentProviders: Component = () => {
  const params = useParams<{ agentName: string }>();
  const agentName = () => decodeURIComponent(params.agentName);

  const [providers] = createResource(async () => {
    try {
      const res = (await fetchJson('/providers')) as ProvidersResponse;
      return res?.providers ?? [];
    } catch {
      return [];
    }
  });

  const [access, { refetch: refetchAccess }] = createResource(
    () => agentName(),
    async (name) => {
      try {
        const res = (await fetchJson(`/agents/${encodeURIComponent(name)}/provider-access`)) as {
          enabled: string[];
          explicit: boolean;
        };
        return { set: new Set(res.enabled), explicit: res.explicit };
      } catch {
        return { set: new Set<string>(), explicit: false };
      }
    },
  );

  const allConnections = () => {
    const list: Array<{
      userProviderId: string;
      provider: string;
      authType: string;
      label: string;
      models: number;
    }> = [];
    for (const p of providers() ?? []) {
      for (const c of p.connections) {
        if (!c.is_active) continue;
        list.push({
          userProviderId: c.id,
          provider: p.provider,
          authType: p.auth_type,
          label: c.label,
          models: c.cached_model_count || p.total_models,
        });
      }
    }
    return list;
  };

  const isEnabled = (id: string) => {
    const a = access();
    if (!a || !a.explicit) return true;
    return a.set.has(id);
  };

  const [busy, setBusy] = createSignal<string | null>(null);
  const [confirmTarget, setConfirmTarget] = createSignal<{
    userProviderId: string;
    provider: string;
    label: string;
  } | null>(null);
  const [impactTiers, setImpactTiers] = createSignal<
    Array<{ tier: string; model: string; position: string }>
  >([]);

  const fetchImpact = async (userProviderId: string) => {
    try {
      const url = `/agents/${encodeURIComponent(agentName())}/provider-access/${userProviderId}/impact`;
      const res = (await fetchJson(url)) as {
        affected_tiers: Array<{ tier: string; model: string; position: string }>;
      };
      return res.affected_tiers ?? [];
    } catch {
      return [];
    }
  };

  const doDisable = async (userProviderId: string) => {
    setBusy(userProviderId);
    try {
      const url = `/agents/${encodeURIComponent(agentName())}/provider-access/${userProviderId}`;
      await fetchMutate(url, { method: 'DELETE' });
      refetchAccess();
    } catch {
      // toast from fetchMutate
    } finally {
      setBusy(null);
      setConfirmTarget(null);
      setImpactTiers([]);
    }
  };

  const doEnable = async (userProviderId: string) => {
    setBusy(userProviderId);
    try {
      const url = `/agents/${encodeURIComponent(agentName())}/provider-access/${userProviderId}`;
      await fetchMutate(url, { method: 'PUT' });
      refetchAccess();
    } catch {
      // toast from fetchMutate
    } finally {
      setBusy(null);
    }
  };

  const handleToggle = async (conn: {
    userProviderId: string;
    provider: string;
    label: string;
  }) => {
    if (isEnabled(conn.userProviderId)) {
      const impact = await fetchImpact(conn.userProviderId);
      setImpactTiers(impact);
      setConfirmTarget(conn);
    } else {
      doEnable(conn.userProviderId);
    }
  };

  const provDef = (id: string) => PROVIDERS.find((p) => p.id === id);
  const [customProvidersList] = createResource(
    () => agentName(),
    (name) => getCustomProviders(name).catch(() => []),
  );
  const resolveProviderName = (id: string) => {
    const known = provDef(id);
    if (known) return known.name;
    if (id.startsWith('custom:')) {
      const uuid = id.replace('custom:', '');
      const cp = (customProvidersList() ?? []).find((c: any) => c.id === uuid);
      if (cp) return (cp as any).name;
    }
    return id;
  };

  return (
    <div>
      <p style="color: hsl(var(--muted-foreground)); font-size: var(--font-size-sm); margin-bottom: 16px;">
        All connected providers are enabled by default. Disable a provider to prevent this agent
        from routing to it.
      </p>

      <Show
        when={allConnections().length > 0}
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
        <div class="panel" style="padding: 0;">
          <table class="data-table" style="table-layout: fixed;">
            <colgroup>
              <col style="width: 200px;" />
              <col style="width: 100px;" />
              <col style="width: 120px;" />
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
              <For each={allConnections()}>
                {(conn) => {
                  const prov = provDef(conn.provider);
                  const enabled = () => isEnabled(conn.userProviderId);
                  return (
                    <tr style={{ opacity: enabled() ? '1' : '0.5' }}>
                      <td>
                        <span style="display: flex; align-items: center; gap: 10px;">
                          <Show
                            when={providerIcon(conn.provider, 20)}
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
                                  background: customProviderColor(
                                    resolveProviderName(conn.provider),
                                  ),
                                }}
                              >
                                {resolveProviderName(conn.provider).charAt(0).toUpperCase()}
                              </span>
                            }
                          >
                            <span style="display: flex; align-items: center; width: 20px; height: 20px;">
                              {providerIcon(conn.provider, 20)}
                            </span>
                          </Show>
                          <span style="font-weight: 500;">
                            {resolveProviderName(conn.provider)}
                          </span>
                          <Show when={conn.provider.startsWith('custom:')}>
                            <span style="display: inline-flex; padding: 1px 6px; border-radius: var(--radius-sm); border: 1px solid hsl(var(--border)); font-size: var(--font-size-xs); color: hsl(var(--muted-foreground));">
                              Custom
                            </span>
                          </Show>
                        </span>
                      </td>
                      <td>
                        <span style="font-size: var(--font-size-xs); color: hsl(var(--muted-foreground));">
                          {AUTH_BADGES[conn.authType] ?? conn.authType}
                        </span>
                      </td>
                      <td style="color: hsl(var(--muted-foreground));">{conn.label}</td>
                      <td>{conn.models || '—'}</td>
                      <td style="text-align: right;">
                        <button
                          class="routing-switch"
                          classList={{ 'routing-switch--on': enabled() }}
                          disabled={busy() === conn.userProviderId}
                          onClick={() => handleToggle(conn)}
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

      {/* Confirmation modal for disabling */}
      <Show when={confirmTarget()}>
        <div
          class="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfirmTarget(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setConfirmTarget(null);
            if (e.key === 'Enter') doDisable(confirmTarget()!.userProviderId);
          }}
        >
          <div
            class="modal-card"
            style="max-width: 420px;"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 class="modal-card__title">Disable provider</h2>
            <p class="modal-card__desc">
              This agent will no longer be able to route requests through{' '}
              <strong style="color: hsl(var(--foreground));">
                {provDef(confirmTarget()!.provider)?.name ?? confirmTarget()!.provider}
              </strong>
              . You can re-enable it at any time.
            </p>
            <Show when={impactTiers().length > 0}>
              <div style="margin-top: 12px; padding: 12px; background: hsl(var(--muted) / 0.45); border-radius: var(--radius); font-size: var(--font-size-sm);">
                <p style="margin: 0 0 8px; font-weight: 600; color: hsl(var(--foreground));">
                  The following routing assignments will be removed:
                </p>
                <For each={impactTiers()}>
                  {(item) => (
                    <div style="display: flex; justify-content: space-between; padding: 4px 0; color: hsl(var(--muted-foreground));">
                      <span>
                        {item.tier} — {item.position}
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
                disabled={busy() === confirmTarget()!.userProviderId}
                onClick={() => doDisable(confirmTarget()!.userProviderId)}
              >
                Disable
              </button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default AgentProviders;
