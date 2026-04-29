import { createMemo, For, type Component } from 'solid-js';
import { authBadgeFor, authLabel } from './AuthBadge.js';
import { providerIcon, customProviderLogo } from './ProviderIcon.jsx';
import { customProviderColor, formatCost, formatNumber } from '../services/formatters.js';
import { getModelDisplayName } from '../services/model-display.js';
import {
  inferProviderFromModel,
  inferProviderName,
  resolveProviderId,
  stripCustomPrefix,
} from '../services/routing-utils.js';
import { PROVIDERS } from '../services/providers.js';

interface CostByModelRow {
  model: string;
  display_name?: string;
  tokens: number;
  share_pct: number;
  estimated_cost: number;
  auth_type: string | null;
  provider?: string | null;
}

interface CostByModelTableProps {
  rows: CostByModelRow[];
  customProviderName: (model: string) => string | undefined;
}

function resolveRowProvider(row: CostByModelRow): string | undefined {
  if (row.provider) {
    const resolved = resolveProviderId(row.provider);
    if (resolved) return resolved;
  }
  if (row.model) return inferProviderFromModel(row.model);
  return undefined;
}

function resolveRowProviderName(row: CostByModelRow): string | undefined {
  const id = resolveRowProvider(row);
  if (!id) return undefined;
  return (
    PROVIDERS.find((p) => p.id === id)?.name ?? (row.model ? inferProviderName(row.model) : id)
  );
}

const CostByModelTable: Component<CostByModelTableProps> = (props) => {
  const sortedRows = createMemo(() =>
    [...props.rows].sort((a, b) => b.estimated_cost - a.estimated_cost),
  );

  return (
    <div class="panel" style="margin-top: var(--gap-lg);">
      <div class="panel__title">Cost by Model</div>
      <p style="font-size: var(--font-size-xs); color: hsl(var(--muted-foreground)); margin: -8px 0 12px;">
        How much each model costs you
      </p>
      <table class="data-table">
        <thead>
          <tr>
            <th>Model</th>
            <th>Tokens</th>
            <th>% of total</th>
            <th>Cost</th>
          </tr>
        </thead>
        <tbody>
          <For each={sortedRows()}>
            {(row) => (
              <tr>
                <td style="font-family: var(--font-mono); font-size: var(--font-size-sm);">
                  <span style="display: inline-flex; align-items: center; gap: 4px;">
                    {(() => {
                      const provId = resolveRowProvider(row);
                      const isCustom =
                        provId === 'custom' || provId?.startsWith('custom:') === true;
                      if (row.model && isCustom) {
                        const provName = props.customProviderName(row.model);
                        const logo = customProviderLogo(
                          provName ?? '',
                          16,
                          undefined,
                          row.model ?? undefined,
                        );
                        if (logo) return logo;
                        const letter = (provName ?? stripCustomPrefix(row.model))
                          .charAt(0)
                          .toUpperCase();
                        return (
                          <span
                            class="provider-card__logo-letter"
                            title={provName}
                            style={{
                              background: customProviderColor(provName ?? ''),
                              width: '16px',
                              height: '16px',
                              'font-size': '9px',
                              'flex-shrink': '0',
                              'border-radius': '50%',
                            }}
                          >
                            {letter}
                          </span>
                        );
                      }
                      if (provId) {
                        const provName = resolveRowProviderName(row);
                        return (
                          <span
                            title={`${provName ?? provId} (${authLabel(row.auth_type)})`}
                            style="display: inline-flex; flex-shrink: 0; position: relative;"
                          >
                            {providerIcon(provId, 14)}
                            {authBadgeFor(row.auth_type, 8)}
                          </span>
                        );
                      }
                      return null;
                    })()}
                    {row.model
                      ? row.model.startsWith('custom:')
                        ? `custom:${props.customProviderName(row.model) ?? 'Custom'}/${stripCustomPrefix(row.model)}`
                        : row.display_name || getModelDisplayName(row.model)
                      : row.model}
                  </span>
                </td>
                <td>{formatNumber(row.tokens)}</td>
                <td>
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <div style="width: 40px; height: 4px; border-radius: 2px; background: hsl(var(--muted)); overflow: hidden;">
                      <div
                        style={`width: ${row.share_pct}%; height: 100%; background: hsl(var(--chart-1)); border-radius: 2px;`}
                      />
                    </div>
                    <span style="font-size: var(--font-size-xs); color: hsl(var(--muted-foreground));">
                      {Math.round(row.share_pct)}%
                    </span>
                  </div>
                </td>
                <td
                  style="font-weight: 600;"
                  title={
                    row.estimated_cost > 0 && row.estimated_cost < 0.01
                      ? `$${row.estimated_cost.toFixed(6)}`
                      : undefined
                  }
                >
                  {formatCost(row.estimated_cost) ?? '\u2014'}
                </td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </div>
  );
};

export default CostByModelTable;
