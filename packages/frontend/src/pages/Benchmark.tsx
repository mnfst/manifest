import {
  createEffect,
  createResource,
  createSignal,
  For,
  on,
  Show,
  type Component,
} from 'solid-js';
import { useParams } from '@solidjs/router';
import { Meta, Title } from '@solidjs/meta';
import type { AuthType, BenchmarkHistoryRunSummary } from '../services/api.js';
import {
  getAvailableModels,
  getBenchmarkRun,
  getCustomProviders,
  getProviders,
  listBenchmarkRuns,
} from '../services/api.js';
import {
  createBenchmarkStore,
  MAX_COLUMNS,
  type BenchmarkColumn as ColumnData,
} from '../services/benchmark-store.js';
import { toast } from '../services/toast-store.js';
import BenchmarkColumn from '../components/benchmark/BenchmarkColumn.jsx';
import BenchmarkPrompt from '../components/benchmark/BenchmarkPrompt.jsx';
import BenchmarkSummaryTable from '../components/benchmark/BenchmarkSummaryTable.jsx';
import BenchmarkModelPicker from '../components/benchmark/BenchmarkModelPicker.jsx';
import BenchmarkEmptyState from '../components/benchmark/BenchmarkEmptyState.jsx';
import BenchmarkHistoryDrawer from '../components/benchmark/BenchmarkHistoryDrawer.jsx';
import RequestHeadersPopover, {
  blankEntry,
  isBlockedHeaderKey,
  toHeaderRecord,
  type HeaderEntry,
} from '../components/benchmark/RequestHeadersPopover.jsx';
import { CodeIcon, HistoryIcon } from '../components/benchmark/icons.jsx';

const REQUEST_HEADERS_STORAGE_KEY = 'manifest.benchmark.requestHeaders';

function loadStoredHeaders(): HeaderEntry[] {
  try {
    const raw = localStorage.getItem(REQUEST_HEADERS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (e): e is HeaderEntry =>
          typeof e === 'object' &&
          e !== null &&
          typeof (e as HeaderEntry).id === 'string' &&
          typeof (e as HeaderEntry).key === 'string' &&
          typeof (e as HeaderEntry).value === 'string',
      )
      .slice(0, 20);
  } catch {
    return [];
  }
}

function persistHeaders(entries: HeaderEntry[]): void {
  try {
    localStorage.setItem(REQUEST_HEADERS_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    /* quota / private mode — silently ignore */
  }
}

function activeHeaderCount(entries: HeaderEntry[]): number {
  let n = 0;
  for (const e of entries) {
    const k = e.key.trim();
    if (!k || !e.value) continue;
    if (isBlockedHeaderKey(k)) continue;
    n++;
  }
  return n;
}

function findDisplayName(
  available: { model_name: string; display_name?: string }[],
  modelName: string,
): string {
  const match = available.find((m) => m.model_name === modelName);
  return match?.display_name ?? modelName;
}

function findWinners(columns: readonly ColumnData[]): { cheapestId?: string; fastestId?: string } {
  const success = columns.filter((c) => c.status === 'success' && c.metrics);
  if (success.length < 2) return {};

  let cheapestId: string | undefined;
  let cheapestCost = Number.POSITIVE_INFINITY;
  for (const c of success) {
    const cost = c.metrics?.cost;
    if (cost != null && cost < cheapestCost) {
      cheapestCost = cost;
      cheapestId = c.id;
    }
  }

  let fastestId: string | undefined;
  let fastestDuration = Number.POSITIVE_INFINITY;
  for (const c of success) {
    const dur = c.metrics?.durationMs ?? Number.POSITIVE_INFINITY;
    if (dur < fastestDuration) {
      fastestDuration = dur;
      fastestId = c.id;
    }
  }

  return { cheapestId, fastestId };
}

const Benchmark: Component = () => {
  const params = useParams<{ agentName: string }>();
  const agentName = () => decodeURIComponent(params.agentName);

  const [available] = createResource(agentName, getAvailableModels);
  const [providers] = createResource(agentName, getProviders);
  const [customProviders] = createResource(agentName, getCustomProviders);

  const store = createBenchmarkStore(agentName());
  const [pickerForColumn, setPickerForColumn] = createSignal<string | null>(null);
  const [showAddPicker, setShowAddPicker] = createSignal(false);
  const [announcement, setAnnouncement] = createSignal('');
  const [historyOpen, setHistoryOpen] = createSignal(false);
  const [historyRuns, setHistoryRuns] = createSignal<BenchmarkHistoryRunSummary[]>([]);
  const [historyLoading, setHistoryLoading] = createSignal(false);
  const [activeRunId, setActiveRunId] = createSignal<string | null>(null);
  const [headerEntries, setHeaderEntries] = createSignal<HeaderEntry[]>(loadStoredHeaders());
  const [headersOpen, setHeadersOpen] = createSignal(false);

  const updateHeaders = (entries: HeaderEntry[]) => {
    setHeaderEntries(entries);
    persistHeaders(entries);
  };

  const openHeaders = () => {
    if (headerEntries().length === 0) setHeaderEntries([blankEntry()]);
    setHeadersOpen(true);
  };

  const handleSubmit = () => {
    void store.runAll({ requestHeaders: toHeaderRecord(headerEntries()) });
  };

  const handleRetry = (id: string) => {
    void store.retryColumn(id, { requestHeaders: toHeaderRecord(headerEntries()) });
  };

  const refreshHistory = async () => {
    setHistoryLoading(true);
    try {
      setHistoryRuns(await listBenchmarkRuns(agentName()));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load history');
    } finally {
      setHistoryLoading(false);
    }
  };

  createEffect(() => {
    if (historyOpen()) void refreshHistory();
  });

  // Refresh history once per run, on the transition from running → idle.
  // Tracking historyRuns() here would cause an infinite loop because
  // refreshHistory() writes the signal it tracks.
  createEffect(
    on(
      () => store.isAnyRunning(),
      (running, prev) => {
        if (prev === true && running === false) void refreshHistory();
      },
      { defer: true },
    ),
  );

  createEffect(() => {
    const a = available();
    const p = providers();
    if (!a || !p) return;
    store.pickDefaults(a, p);
  });

  createEffect(() => {
    for (const col of store.columns) {
      if (col.status === 'success' && col.metrics) {
        setAnnouncement(`${col.displayName} responded in ${col.metrics.durationMs} milliseconds.`);
      }
    }
  });

  const handlePickModel = (
    columnId: string,
    model: string,
    provider: string,
    authType?: AuthType,
  ) => {
    const displayName = findDisplayName(available() ?? [], model);
    store.replaceColumnModel(columnId, model, provider, authType ?? 'api_key', displayName);
    setPickerForColumn(null);
  };

  const handleAddModel = (
    _columnId: string,
    model: string,
    provider: string,
    authType?: AuthType,
  ) => {
    const displayName = findDisplayName(available() ?? [], model);
    store.addColumn(model, provider, authType ?? 'api_key', displayName);
    setShowAddPicker(false);
  };

  const handlePickHistory = async (runId: string) => {
    if (
      store.isAnyRunning() &&
      !confirm('A benchmark is still running. Loading this history will cancel it. Continue?')
    ) {
      return;
    }
    try {
      const detail = await getBenchmarkRun(runId, params.agentName);
      store.loadHistoryRun(detail);
      setActiveRunId(runId);
      setHistoryOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load benchmark');
    }
  };

  const hasConnectedProviders = () => (providers() ?? []).some((p) => p.is_active);
  const winners = () => findWinners(store.columns);

  return (
    <div class="benchmark">
      <Title>Benchmark · Manifest</Title>
      <Meta
        name="description"
        content="Compare models side by side for cost, speed, and quality."
      />

      <header class="page-header">
        <div>
          <h1>Benchmark</h1>
          <p class="page-header__sub">
            Send one prompt to multiple models and compare cost, speed, and quality.
          </p>
        </div>
        <button
          type="button"
          class="benchmark__history-toggle"
          onClick={() => setHistoryOpen((v) => !v)}
          aria-expanded={historyOpen()}
          aria-controls="benchmark-history-drawer"
        >
          <HistoryIcon size={14} />
          History
        </button>
      </header>

      <Show
        when={available() && providers() && hasConnectedProviders()}
        fallback={
          <Show when={available() && providers()}>
            <BenchmarkEmptyState agentName={agentName()} />
          </Show>
        }
      >
        <div class="benchmark__columns" aria-label="Model comparison columns">
          <For each={store.columns}>
            {(col) => (
              <BenchmarkColumn
                column={col}
                isCheapest={winners().cheapestId === col.id}
                isFastest={winners().fastestId === col.id}
                onRemove={store.removeColumn}
                onChangeModel={setPickerForColumn}
                onRetry={handleRetry}
              />
            )}
          </For>
          <Show when={store.columns.length < MAX_COLUMNS}>
            <button
              type="button"
              class="benchmark__add"
              onClick={() => setShowAddPicker(true)}
              aria-label="Add model column"
            >
              <span class="benchmark__add-plus">+</span>
              <span>Add model</span>
            </button>
          </Show>
        </div>

        <BenchmarkSummaryTable columns={store.columns} />

        <BenchmarkPrompt
          value={store.prompt()}
          onChange={store.setPrompt}
          onSubmit={handleSubmit}
          onRecallPrevious={store.recallPreviousPrompt}
          disabled={store.isAnyRunning() || store.columns.length === 0}
          running={store.isAnyRunning()}
          headersSlot={
            <div class="benchmark-prompt__headers-slot">
              <button
                type="button"
                class="benchmark-prompt__headers"
                aria-label="Request headers"
                aria-expanded={headersOpen()}
                title="Custom request headers"
                onClick={() => (headersOpen() ? setHeadersOpen(false) : openHeaders())}
              >
                <CodeIcon size={16} />
                <Show when={activeHeaderCount(headerEntries()) > 0}>
                  <span class="benchmark-prompt__headers-badge">
                    {activeHeaderCount(headerEntries())}
                  </span>
                </Show>
              </button>
              <RequestHeadersPopover
                open={headersOpen()}
                entries={headerEntries()}
                onChange={updateHeaders}
                onClose={() => setHeadersOpen(false)}
              />
            </div>
          }
        />
      </Show>

      <div class="sr-only" role="status" aria-live="polite">
        {announcement()}
      </div>

      <Show when={pickerForColumn()}>
        {(columnId) => (
          <BenchmarkModelPicker
            columnId={columnId()}
            models={available() ?? []}
            customProviders={customProviders()}
            connectedProviders={providers()}
            onSelect={handlePickModel}
            onClose={() => setPickerForColumn(null)}
          />
        )}
      </Show>

      <Show when={showAddPicker()}>
        <BenchmarkModelPicker
          columnId="new"
          models={available() ?? []}
          customProviders={customProviders()}
          connectedProviders={providers()}
          onSelect={handleAddModel}
          onClose={() => setShowAddPicker(false)}
        />
      </Show>

      <div id="benchmark-history-drawer">
        <BenchmarkHistoryDrawer
          open={historyOpen()}
          loading={historyLoading()}
          runs={historyRuns()}
          activeRunId={activeRunId()}
          onClose={() => setHistoryOpen(false)}
          onSelect={handlePickHistory}
        />
      </div>
    </div>
  );
};

export default Benchmark;
