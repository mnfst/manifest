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
import { formatDateTime, formatNumber, t } from '../i18n/index.js';

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
  const digits = price < 0.01 ? 4 : price < 1 ? 3 : 2;
  return formatNumber(price, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
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
    if (!ts) return t('pages.modelPrices.never');
    return formatDateTime(new Date(ts), {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div class="container--full">
      <Title>{t('pages.modelPrices.metaTitle')}</Title>
      <Meta name="description" content={t('pages.modelPrices.metaDescription')} />
      <div class="page-header">
        <div>
          <h1>{t('pages.modelPrices.title')}</h1>
          <span class="breadcrumb">{t('pages.modelPrices.subtitle')}</span>
        </div>
        <Show when={data()?.lastSyncedAt}>
          <span style="font-size: var(--font-size-xs); color: hsl(var(--muted-foreground));">
            {t('pages.modelPrices.lastUpdated', { date: formatSyncTime(data()!.lastSyncedAt) })}
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
                  <th>{t('pages.modelPrices.model')}</th>
                  <th>{t('pages.modelPrices.modelId')}</th>
                  <th>{t('pages.modelPrices.provider')}</th>
                  <th>{t('pages.modelPrices.inputCost')}</th>
                  <th>{t('pages.modelPrices.outputCost')}</th>
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
                  <p class="model-filter__empty-title">{t('pages.modelPrices.emptyTitle')}</p>
                  <p class="model-filter__empty-hint">{t('pages.modelPrices.emptyHint')}</p>
                  <button class="btn btn--outline btn--sm" onClick={clearFilters} type="button">
                    {t('pages.modelPrices.clearFilters')}
                  </button>
                </div>
              }
            >
              <table class="data-table">
                <thead>
                  <tr>
                    <th class="data-table__sortable" onClick={() => handleSort('display_name')}>
                      {t('pages.modelPrices.model')}
                      {indicator('display_name')}
                    </th>
                    <th class="data-table__sortable" onClick={() => handleSort('model_name')}>
                      {t('pages.modelPrices.modelId')}
                      {indicator('model_name')}
                    </th>
                    <th class="data-table__sortable" onClick={() => handleSort('provider')}>
                      {t('pages.modelPrices.provider')}
                      {indicator('provider')}
                    </th>
                    <th
                      class="data-table__sortable"
                      onClick={() => handleSort('input_price_per_million')}
                    >
                      {t('pages.modelPrices.inputCost')}
                      {indicator('input_price_per_million')}
                      <InfoTooltip text={t('pages.modelPrices.inputCostHelp')} />
                    </th>
                    <th
                      class="data-table__sortable"
                      onClick={() => handleSort('output_price_per_million')}
                    >
                      {t('pages.modelPrices.outputCost')}
                      {indicator('output_price_per_million')}
                      <InfoTooltip text={t('pages.modelPrices.outputCostHelp')} />
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
                              <span class="free-tag">{t('pages.modelPrices.free')}</span>
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
