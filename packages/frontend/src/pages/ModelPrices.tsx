import {
  createSignal,
  createResource,
  createEffect,
  on,
  Show,
  For,
  createMemo,
  type Component,
} from 'solid-js';
import { Title, Meta } from '@solidjs/meta';
import ErrorState from '../components/ErrorState.jsx';
import InfoTooltip from '../components/InfoTooltip.jsx';
import ModelPricesFilterBar from '../components/ModelPricesFilterBar.jsx';
import Pagination from '../components/Pagination.jsx';
import { providerIcon } from '../components/ProviderIcon.jsx';
import { getModelPrices } from '../services/api.js';
import { getModelDisplayName, preloadModelDisplayNames } from '../services/model-display.js';
import { createClientPagination } from '../services/pagination.js';
import { resolveProviderId } from '../services/routing-utils.js';

interface ModelPrice {
  model_name: string;
  provider: string;
  display_name: string | null;
  input_price_per_million: number | null;
  output_price_per_million: number | null;
}

interface ModelPricesData {
  models: ModelPrice[];
  lastSyncedAt: string | null;
}

type SortKey =
  | 'display_name'
  | 'model_name'
  | 'provider'
  | 'input_price_per_million'
  | 'output_price_per_million';
type SortDir = 'asc' | 'desc';

function formatPrice(price: number | null): string {
  if (price == null) return '\u2014';
  if (price < 0.01) return `$${price.toFixed(4)}`;
  if (price < 1) return `$${price.toFixed(3)}`;
  return `$${price.toFixed(2)}`;
}

const ModelPrices: Component = () => {
  preloadModelDisplayNames();
  const [data, { refetch }] = createResource(() => getModelPrices() as Promise<ModelPricesData>);
  const [sortKey, setSortKey] = createSignal<SortKey>('provider');
  const [sortDir, setSortDir] = createSignal<SortDir>('asc');
  const [selectedModels, setSelectedModels] = createSignal<Set<string>>(new Set());
  const [selectedProviders, setSelectedProviders] = createSignal<Set<string>>(new Set());

  const handleSort = (key: SortKey) => {
    if (sortKey() === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const allProviders = createMemo(() => {
    const models = data()?.models;
    if (!models) return [];
    const unique = [...new Set(models.map((m) => m.provider))];
    return unique.sort((a, b) => a.localeCompare(b));
  });

  const allModelNames = createMemo(() => {
    const models = data()?.models;
    if (!models) return [];
    const unique = [...new Set(models.map((m) => m.model_name))];
    return unique.sort((a, b) => a.localeCompare(b));
  });

  const filteredModels = createMemo(() => {
    const models = data()?.models;
    if (!models) return [];
    const selModels = selectedModels();
    const selProviders = selectedProviders();

    return models.filter((m) => {
      if (selModels.size > 0 && !selModels.has(m.model_name)) return false;
      if (selProviders.size > 0 && !selProviders.has(m.provider)) return false;
      return true;
    });
  });

  const resolveDisplayName = (m: ModelPrice) =>
    (m.display_name || getModelDisplayName(m.model_name)).replace(/\s*\(free\)/i, '');

  const sortedModels = createMemo(() => {
    const models = filteredModels();
    if (!models.length) return [];
    const key = sortKey();
    const dir = sortDir();
    return [...models].sort((a, b) => {
      if (key === 'display_name') {
        const av = resolveDisplayName(a);
        const bv = resolveDisplayName(b);
        return dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      const av = a[key];
      const bv = b[key];
      if (typeof av === 'string' && typeof bv === 'string') {
        return dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      // Sort nulls to the bottom regardless of sort direction
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return dir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
  });

  const pager = createClientPagination(sortedModels, 25);

  createEffect(
    on([selectedModels, selectedProviders, sortKey, sortDir], () => pager.resetPage(), {
      defer: true,
    }),
  );

  const indicator = (key: SortKey) => {
    if (sortKey() !== key) return '';
    return sortDir() === 'asc' ? ' \u25B2' : ' \u25BC';
  };

  const addModel = (model: string) => {
    setSelectedModels((prev) => {
      const next = new Set(prev);
      next.add(model);
      return next;
    });
  };

  const removeModel = (model: string) => {
    setSelectedModels((prev) => {
      const next = new Set(prev);
      next.delete(model);
      return next;
    });
  };

  const addProvider = (provider: string) => {
    setSelectedProviders((prev) => {
      const next = new Set(prev);
      next.add(provider);
      return next;
    });
  };

  const removeProvider = (provider: string) => {
    setSelectedProviders((prev) => {
      const next = new Set(prev);
      next.delete(provider);
      return next;
    });
  };

  const clearFilters = () => {
    setSelectedModels(new Set<string>());
    setSelectedProviders(new Set<string>());
  };

  const formatSyncTime = (ts: string | null) => {
    if (!ts) return 'Never';
    const d = new Date(ts);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div class="container--full">
      <Title>Model Prices - Manifest</Title>
      <Meta
        name="description"
        content="Compare per-token pricing across all major LLM providers."
      />
      <div class="page-header">
        <div>
          <h1>Model Prices</h1>
          <span class="breadcrumb">
            Compare per-token pricing across all supported LLM providers and models
          </span>
        </div>
        <Show when={data()?.lastSyncedAt}>
          <span style="font-size: var(--font-size-xs); color: hsl(var(--muted-foreground));">
            Last updated: {formatSyncTime(data()!.lastSyncedAt)}
          </span>
        </Show>
      </div>

      <Show
        when={!data.loading}
        fallback={
          <div class="panel" style="min-height: 600px;">
            <div class="model-filter">
              <div class="model-filter__row">
                <div
                  class="skeleton skeleton--text"
                  style="width: 280px; height: 36px; border-radius: var(--radius);"
                />
                <div class="model-filter__summary">
                  <div class="skeleton skeleton--text" style="width: 80px;" />
                </div>
              </div>
            </div>
            <table class="data-table" style="width: 100%;">
              <thead>
                <tr>
                  <th>Model</th>
                  <th>Model ID</th>
                  <th>Provider</th>
                  <th>Cost to send / 1M tokens</th>
                  <th>Cost to receive / 1M tokens</th>
                </tr>
              </thead>
              <tbody>
                <For each={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}>
                  {() => (
                    <tr>
                      <td>
                        <div class="skeleton skeleton--text" style="width: 70%;" />
                      </td>
                      <td>
                        <div class="skeleton skeleton--text" style="width: 60%;" />
                      </td>
                      <td>
                        <div class="skeleton skeleton--text" style="width: 60%;" />
                      </td>
                      <td>
                        <div class="skeleton skeleton--text" style="width: 50%;" />
                      </td>
                      <td>
                        <div class="skeleton skeleton--text" style="width: 50%;" />
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        }
      >
        <Show when={!data.error} fallback={<ErrorState error={data.error} onRetry={refetch} />}>
          <div class="panel">
            <ModelPricesFilterBar
              allModels={allModelNames()}
              allProviders={allProviders()}
              selectedModels={selectedModels()}
              selectedProviders={selectedProviders()}
              onAddModel={addModel}
              onRemoveModel={removeModel}
              onAddProvider={addProvider}
              onRemoveProvider={removeProvider}
              onClearFilters={clearFilters}
              totalCount={data()?.models?.length ?? 0}
              filteredCount={filteredModels().length}
            />
            <Show
              when={pager.totalItems() > 0}
              fallback={
                <div class="model-filter__empty">
                  <p class="model-filter__empty-title">No models match your filters</p>
                  <p class="model-filter__empty-hint">
                    Try selecting a different provider or model, or clear all filters to see every
                    model.
                  </p>
                  <button class="btn btn--outline btn--sm" onClick={clearFilters} type="button">
                    Clear filters
                  </button>
                </div>
              }
            >
              <table class="data-table">
                <thead>
                  <tr>
                    <th class="data-table__sortable" onClick={() => handleSort('display_name')}>
                      Model{indicator('display_name')}
                    </th>
                    <th class="data-table__sortable" onClick={() => handleSort('model_name')}>
                      Model ID{indicator('model_name')}
                    </th>
                    <th class="data-table__sortable" onClick={() => handleSort('provider')}>
                      Provider{indicator('provider')}
                    </th>
                    <th
                      class="data-table__sortable"
                      onClick={() => handleSort('input_price_per_million')}
                    >
                      Cost to send / 1M tokens{indicator('input_price_per_million')}
                      <InfoTooltip text="Tokens are small chunks of text. Send cost is what you pay for the input you give the model." />
                    </th>
                    <th
                      class="data-table__sortable"
                      onClick={() => handleSort('output_price_per_million')}
                    >
                      Cost to receive / 1M tokens{indicator('output_price_per_million')}
                      <InfoTooltip text="Tokens are small chunks of text. Receive cost is what you pay for the output the model returns." />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <For each={pager.pageItems()}>
                    {(model) => {
                      const rawName = () =>
                        model.display_name || getModelDisplayName(model.model_name);
                      const isFree = () => /\(free\)/i.test(rawName());
                      const displayName = () => rawName().replace(/\s*\(free\)/i, '');
                      const pid = () => resolveProviderId(model.provider);
                      return (
                        <tr>
                          <td style="font-size: var(--font-size-sm);">
                            {displayName()}
                            <Show when={isFree()}>
                              {' '}
                              <span class="free-tag">Free</span>
                            </Show>
                          </td>
                          <td style="font-family: var(--font-mono); font-size: var(--font-size-xs); color: hsl(var(--muted-foreground));">
                            {model.model_name}
                          </td>
                          <td>
                            <span style="display: inline-flex; align-items: center; gap: 6px;">
                              <Show when={pid()}>
                                <span style="display: inline-flex; flex-shrink: 0;">
                                  {providerIcon(pid()!, 16)}
                                </span>
                              </Show>
                              {model.provider}
                            </span>
                          </td>
                          <td style="font-family: var(--font-mono);">
                            {formatPrice(model.input_price_per_million)}
                          </td>
                          <td style="font-family: var(--font-mono);">
                            {formatPrice(model.output_price_per_million)}
                          </td>
                        </tr>
                      );
                    }}
                  </For>
                </tbody>
              </table>
              <Pagination
                currentPage={pager.currentPage}
                totalItems={pager.totalItems}
                pageSize={pager.pageSize}
                hasNextPage={pager.hasNextPage}
                onPrevious={pager.previousPage}
                onNext={pager.nextPage}
              />
            </Show>
          </div>
        </Show>
      </Show>
    </div>
  );
};

export default ModelPrices;
