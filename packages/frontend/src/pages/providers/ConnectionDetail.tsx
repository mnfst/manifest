import { Title } from '@solidjs/meta';
import { A, useParams } from '@solidjs/router';
import { createResource, Show, type Component } from 'solid-js';
import { fetchJson } from '../../services/api/core.js';
import { PROVIDERS } from '../../services/providers.js';
import { providerIcon } from '../../components/ProviderIcon.jsx';
import { formatNumber } from '../../services/formatters.js';

interface ConnectionData {
  id: string;
  provider: string;
  auth_type: string;
  label: string;
  key_prefix: string | null;
  priority: number;
  connected_at: string;
  models_fetched_at: string | null;
  cached_model_count: number;
  consumption_tokens: number;
  consumption_messages: number;
}

interface ProvidersResponse {
  providers: Array<{
    provider: string;
    auth_type: string;
    connections: Array<{
      id: string;
      label: string;
      key_prefix: string | null;
      priority: number;
      connected_at: string;
      models_fetched_at: string | null;
      cached_model_count: number;
    }>;
    consumption_tokens: number;
    consumption_messages: number;
  }>;
}

const AUTH_TYPE_LABELS: Record<string, string> = {
  subscription: 'Subscription',
  api_key: 'API Key',
  local: 'Local',
};

const BACK_LINKS: Record<string, string> = {
  subscription: '/providers/subscriptions',
  api_key: '/providers/byok',
  local: '/providers/local',
};

const ConnectionDetail: Component = () => {
  const params = useParams<{ connectionId: string }>();

  const [data] = createResource(
    () => params.connectionId,
    async (connId) => {
      try {
        const res = (await fetchJson('/providers')) as ProvidersResponse;
        for (const p of res.providers) {
          for (const c of p.connections) {
            if (c.id === connId) {
              return {
                id: c.id,
                provider: p.provider,
                auth_type: p.auth_type,
                label: c.label,
                key_prefix: c.key_prefix,
                priority: c.priority,
                connected_at: c.connected_at,
                models_fetched_at: c.models_fetched_at,
                cached_model_count: c.cached_model_count,
                consumption_tokens: p.consumption_tokens,
                consumption_messages: p.consumption_messages,
              } as ConnectionData;
            }
          }
        }
        return null;
      } catch {
        return null;
      }
    },
  );

  const provDef = () => PROVIDERS.find((p) => p.id === data()?.provider);
  const backLink = () =>
    BACK_LINKS[data()?.auth_type ?? 'subscription'] ?? '/providers/subscriptions';

  return (
    <div class="container--sm">
      <Show
        when={data() !== undefined && data() !== null}
        fallback={
          <div style="padding: 48px 0; text-align: center; color: hsl(var(--muted-foreground));">
            Connection not found.
          </div>
        }
      >
        {(() => {
          const d = data()!;
          const prov = provDef();
          return (
            <>
              <Title>
                {prov?.name ?? d.provider} — {d.label} | Manifest
              </Title>
              <div style="margin-bottom: 24px;">
                <A
                  href={backLink()}
                  style="color: hsl(var(--muted-foreground)); font-size: var(--font-size-sm); text-decoration: none;"
                >
                  ← Back to {AUTH_TYPE_LABELS[d.auth_type] ?? 'Providers'}
                </A>
              </div>

              <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 32px;">
                <span style="display: flex; align-items: center; width: 32px; height: 32px;">
                  {providerIcon(d.provider, 32)}
                </span>
                <div>
                  <h1 class="page-header__title" style="margin: 0;">
                    {prov?.name ?? d.provider}
                  </h1>
                  <span style="color: hsl(var(--muted-foreground)); font-size: var(--font-size-sm);">
                    {d.label}
                  </span>
                </div>
              </div>

              <div class="panel" style="padding: 20px;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tbody>
                    <tr>
                      <td style="padding: 8px 0; color: hsl(var(--muted-foreground)); font-size: var(--font-size-sm); width: 160px;">
                        Type
                      </td>
                      <td style="padding: 8px 0; font-size: var(--font-size-sm);">
                        {AUTH_TYPE_LABELS[d.auth_type] ?? d.auth_type}
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: hsl(var(--muted-foreground)); font-size: var(--font-size-sm);">
                        Label
                      </td>
                      <td style="padding: 8px 0; font-size: var(--font-size-sm);">{d.label}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: hsl(var(--muted-foreground)); font-size: var(--font-size-sm);">
                        Models
                      </td>
                      <td style="padding: 8px 0; font-size: var(--font-size-sm);">
                        {d.cached_model_count || '—'}
                      </td>
                    </tr>
                    <Show when={d.key_prefix}>
                      <tr>
                        <td style="padding: 8px 0; color: hsl(var(--muted-foreground)); font-size: var(--font-size-sm);">
                          Key prefix
                        </td>
                        <td style="padding: 8px 0; font-size: var(--font-size-sm); font-family: monospace;">
                          {d.key_prefix}••••••••
                        </td>
                      </tr>
                    </Show>
                    <tr>
                      <td style="padding: 8px 0; color: hsl(var(--muted-foreground)); font-size: var(--font-size-sm);">
                        Usage (30d)
                      </td>
                      <td style="padding: 8px 0; font-size: var(--font-size-sm);">
                        {formatNumber(d.consumption_tokens)} tokens ·{' '}
                        {formatNumber(d.consumption_messages)} messages
                      </td>
                    </tr>
                    <Show when={d.connected_at}>
                      <tr>
                        <td style="padding: 8px 0; color: hsl(var(--muted-foreground)); font-size: var(--font-size-sm);">
                          Connected
                        </td>
                        <td style="padding: 8px 0; font-size: var(--font-size-sm);">
                          {new Date(d.connected_at).toLocaleDateString()}
                        </td>
                      </tr>
                    </Show>
                  </tbody>
                </table>
              </div>
            </>
          );
        })()}
      </Show>
    </div>
  );
};

export default ConnectionDetail;
