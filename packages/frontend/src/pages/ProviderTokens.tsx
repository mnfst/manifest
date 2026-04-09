import { createResource, createSignal, createMemo, For, Show, type Component } from 'solid-js';
import { Title } from '@solidjs/meta';
import { getProviderTokens } from '../services/api/public-stats.js';
import { formatNumber, formatCost } from '../services/formatters.js';
import ProviderTokensChart from '../components/ProviderTokensChart.jsx';
import type { ProviderTokensSeries } from '../components/ProviderTokensChart.jsx';
import ErrorState from '../components/ErrorState.jsx';

function formatAuthType(authType: string | null): string {
  if (authType === 'subscription') return 'Subscription';
  if (authType === 'api_key') return 'API Key';
  return '\u2013';
}

function formatModelCost(authType: string | null, cost: number | null): string {
  if (authType === 'subscription') return 'Subscription';
  if (cost == null) return '\u2013';
  return formatCost(cost) ?? '\u2013';
}

const ProviderTokens: Component = () => {
  const [data, { refetch }] = createResource(getProviderTokens);
  const [selectedProvider, setSelectedProvider] = createSignal<string | null>(null);

  const providers = createMemo(() => data()?.providers ?? []);

  const activeProvider = createMemo(() => {
    const sel = selectedProvider();
    const provs = providers();
    if (!provs.length) return null;
    return provs.find((p) => p.provider === sel) ?? provs[0] ?? null;
  });

  const providerSeries = createMemo((): ProviderTokensSeries[] => {
    const prov = activeProvider();
    if (!prov) return [];
    return prov.models.map((m) => ({
      label: m.auth_type ? `${m.model} (${formatAuthType(m.auth_type)})` : m.model,
      daily: m.daily,
    }));
  });

  return (
    <>
      <Title>Provider Tokens - Manifest</Title>
      <div class="page-header">
        <h2>Provider Tokens</h2>
        <p class="page-header__subtitle">
          Daily token consumption by provider and model (last 30 days)
        </p>
      </div>

      <Show when={data.error}>
        <ErrorState error={data.error} onRetry={refetch} />
      </Show>

      <Show when={!data.loading && !data.error && providers().length === 0}>
        <div class="empty-state">
          <p>No token data available yet.</p>
        </div>
      </Show>

      <Show when={providers().length > 0}>
        <div class="provider-tokens__tabs">
          <For each={providers()}>
            {(prov) => (
              <button
                class="provider-tokens__tab"
                classList={{ active: activeProvider()?.provider === prov.provider }}
                onClick={() => setSelectedProvider(prov.provider)}
              >
                {prov.provider}
                <span class="provider-tokens__tab-count">{formatNumber(prov.total_tokens)}</span>
              </button>
            )}
          </For>
        </div>

        <div class="chart-card">
          <div class="chart-card__header">
            <div class="chart-card__stat">
              <span class="chart-card__label">{activeProvider()?.provider}</span>
              <span class="chart-card__value">
                {formatNumber(activeProvider()?.total_tokens ?? 0)} tokens
              </span>
            </div>
          </div>
          <div class="chart-card__body">
            <ProviderTokensChart series={providerSeries()} />
          </div>
        </div>

        <Show when={activeProvider()}>
          <div class="provider-tokens__table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Model</th>
                  <th>Type</th>
                  <th style="text-align: right">Total Tokens</th>
                  <th style="text-align: right">Cost</th>
                </tr>
              </thead>
              <tbody>
                <For each={activeProvider()!.models}>
                  {(model) => (
                    <tr>
                      <td>{model.model}</td>
                      <td>{formatAuthType(model.auth_type)}</td>
                      <td style="text-align: right">{formatNumber(model.total_tokens)}</td>
                      <td style="text-align: right">
                        {formatModelCost(model.auth_type, model.total_cost)}
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </Show>
      </Show>
    </>
  );
};

export default ProviderTokens;
export { formatAuthType, formatModelCost };
