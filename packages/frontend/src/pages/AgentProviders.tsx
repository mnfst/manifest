import { useParams } from '@solidjs/router';
import { createResource, createSignal, For, Show, type Component } from 'solid-js';
import { fetchJson, fetchMutate } from '../services/api/core.js';
import { PROVIDERS } from '../services/providers.js';
import { providerIcon } from '../components/ProviderIcon.jsx';

interface Connection {
  id: string;
  label: string;
  cached_model_count: number;
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
        };
        return new Set(res.enabled);
      } catch {
        return new Set<string>();
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
    const set = access();
    if (!set || set.size === 0) return true; // default: all enabled when no entries
    return set.has(id);
  };

  const [busy, setBusy] = createSignal<string | null>(null);

  const toggle = async (userProviderId: string, currentlyEnabled: boolean) => {
    setBusy(userProviderId);
    try {
      const url = `/agents/${encodeURIComponent(agentName())}/provider-access/${userProviderId}`;
      if (currentlyEnabled) {
        await fetchMutate(url, { method: 'DELETE' });
      } else {
        await fetchMutate(url, { method: 'PUT' });
      }
      refetchAccess();
    } catch {
      // toast from fetchMutate
    } finally {
      setBusy(null);
    }
  };

  const provDef = (id: string) => PROVIDERS.find((p) => p.id === id);

  return (
    <div>
      <p style="color: hsl(var(--muted-foreground)); font-size: var(--font-size-sm); margin-bottom: 16px;">
        All connected providers are enabled by default. Disable a provider to prevent this agent
        from routing to it.
      </p>

      <Show
        when={allConnections().length > 0}
        fallback={
          <div class="section-empty">
            <p style="font-size: var(--font-size-base); font-weight: 600; color: hsl(var(--foreground));">
              No providers connected
            </p>
            <p style="font-size: var(--font-size-sm); color: hsl(var(--muted-foreground));">
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
                          <span style="display: flex; align-items: center; width: 20px; height: 20px;">
                            {providerIcon(conn.provider, 20)}
                          </span>
                          <span style="font-weight: 500;">{prov?.name ?? conn.provider}</span>
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
                        <label class="toggle" style="cursor: pointer;">
                          <input
                            type="checkbox"
                            checked={enabled()}
                            disabled={busy() === conn.userProviderId}
                            onChange={() => toggle(conn.userProviderId, enabled())}
                          />
                          <span class="toggle__slider" />
                        </label>
                      </td>
                    </tr>
                  );
                }}
              </For>
            </tbody>
          </table>
        </div>
      </Show>
    </div>
  );
};

export default AgentProviders;
