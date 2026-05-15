import {
  createEffect,
  createResource,
  createSignal,
  For,
  on,
  onCleanup,
  Show,
  type Component,
} from 'solid-js';
import { useParams, useSearchParams } from '@solidjs/router';
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
  getOrCreateBenchmarkStore,
  MAX_COLUMNS,
  type BenchmarkColumn as ColumnData,
} from '../services/benchmark-store.js';
import { toast } from '../services/toast-store.js';
import BenchmarkColumn from '../components/benchmark/BenchmarkColumn.jsx';
import BenchmarkPrompt from '../components/benchmark/BenchmarkPrompt.jsx';
import BenchmarkSummaryTable from '../components/benchmark/BenchmarkSummaryTable.jsx';
import BenchmarkModelPicker from '../components/benchmark/BenchmarkModelPicker.jsx';
import BenchmarkEmptyState from '../components/benchmark/BenchmarkEmptyState.jsx';
import BenchmarkRecentSidebar from '../components/benchmark/BenchmarkHistoryDrawer.jsx';
import RequestHeadersPopover, {
  blankEntry,
  isBlockedHeaderKey,
  toHeaderRecord,
  type HeaderEntry,
} from '../components/benchmark/RequestHeadersPopover.jsx';
import { CodeIcon } from '../components/benchmark/icons.jsx';
import { useRightSidebar } from '../services/right-sidebar.jsx';
import ProviderSelectModal from '../components/ProviderSelectModal.jsx';

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

function findWinners(columns: readonly ColumnData[]): {
  cheapestCost?: number;
  fastestDuration?: number;
} {
  const success = columns.filter((c) => c.status === 'success' && c.metrics);
  if (success.length < 2) return {};

  let cheapestCost = Number.POSITIVE_INFINITY;
  for (const c of success) {
    const cost = c.metrics?.cost;
    if (cost != null && cost < cheapestCost) cheapestCost = cost;
  }

  let fastestDuration = Number.POSITIVE_INFINITY;
  for (const c of success) {
    const dur = c.metrics?.durationMs ?? Number.POSITIVE_INFINITY;
    if (dur < fastestDuration) fastestDuration = dur;
  }

  return {
    cheapestCost: cheapestCost < Number.POSITIVE_INFINITY ? cheapestCost : undefined,
    fastestDuration: fastestDuration < Number.POSITIVE_INFINITY ? fastestDuration : undefined,
  };
}

const Benchmark: Component = () => {
  const params = useParams<{ agentName: string }>();
  const [searchParams, setSearchParams] = useSearchParams<{ run?: string }>();
  const agentName = () => decodeURIComponent(params.agentName);

  const [available, { refetch: refetchAvailable }] = createResource(agentName, getAvailableModels);
  const [providers, { refetch: refetchProviders }] = createResource(agentName, getProviders);
  const [customProviders, { refetch: refetchCustomProviders }] = createResource(
    agentName,
    getCustomProviders,
  );

  const store = getOrCreateBenchmarkStore(agentName());
  const [pickerForColumn, setPickerForColumn] = createSignal<string | null>(null);
  const [showAddPicker, setShowAddPicker] = createSignal(false);
  const [announcement, setAnnouncement] = createSignal('');
  const [historyOpen, setHistoryOpen] = createSignal(
    localStorage.getItem('manifest.benchmark.recentOpen') !== 'false',
  );
  const toggleRecent = () => {
    const next = !historyOpen();
    setHistoryOpen(next);
    localStorage.setItem('manifest.benchmark.recentOpen', String(next));
  };
  const [historyRuns, setHistoryRuns] = createSignal<BenchmarkHistoryRunSummary[]>([]);
  const [historyLoading, setHistoryLoading] = createSignal(false);
  const [activeRunId, setActiveRunId] = createSignal<string | null>(null);
  const [liveRunId, setLiveRunId] = createSignal<string | null>(null);
  const [viewingHistory, setViewingHistory] = createSignal<
    import('../services/benchmark-store.js').BenchmarkColumn[] | null
  >(null);
  const [completedResults, setCompletedResults] = createSignal<
    import('../services/benchmark-store.js').BenchmarkColumn[] | null
  >(null);
  const [headerEntries, setHeaderEntries] = createSignal<HeaderEntry[]>(loadStoredHeaders());
  const [headersOpen, setHeadersOpen] = createSignal(false);
  const [showProviderModal, setShowProviderModal] = createSignal(false);

  const refetchAllProviders = () => {
    void refetchProviders();
    void refetchAvailable();
    void refetchCustomProviders();
  };

  const { setContent: setRightSidebar } = useRightSidebar();

  const handleNewBenchmark = () => {
    store.reset();
    setViewingHistory(null);
    setCompletedResults(null);
    setActiveRunId(null);
    setLiveRunId(null);
    setSearchParams({ run: undefined });
    sessionStorage.removeItem('manifest.benchmark.lastRun');
    // pickDefaults will fire via the existing createEffect since columns are now empty
  };

  // Cmd+K (Mac) / Ctrl+K (Windows) opens the model picker
  // Shift+Cmd+O (Mac) / Ctrl+Shift+O (Windows) starts a new benchmark
  createEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (!store.isAnyRunning() && store.columns.length < MAX_COLUMNS && !viewingHistory()) {
          setShowAddPicker(true);
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        handleNewBenchmark();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    onCleanup(() => window.removeEventListener('keydown', onKeyDown));
  });

  // Restore the last viewed run on page load, but only if the store
  // doesn't already have columns (i.e. the user navigated away and back
  // while a benchmark was running -- the cached store still has state).
  createEffect(() => {
    // If store already has completed columns, snapshot them for the summary table
    if (store.columns.length > 0 && !store.isAnyRunning() && !completedResults()) {
      setCompletedResults([...store.columns]);
    }
    if (store.columns.length > 0) return;
    const runId = searchParams.run || sessionStorage.getItem('manifest.benchmark.lastRun');
    if (runId && !activeRunId()) {
      getBenchmarkRun(runId, params.agentName)
        .then((detail) => {
          store.loadHistoryRun(detail);
          setCompletedResults([...store.columns]);
          setActiveRunId(runId);
          setSearchParams({ run: runId });
        })
        .catch(() => {
          setSearchParams({ run: undefined });
          sessionStorage.removeItem('manifest.benchmark.lastRun');
        });
    }
  });

  const updateHeaders = (entries: HeaderEntry[]) => {
    setHeaderEntries(entries);
    persistHeaders(entries);
  };

  const openHeaders = () => {
    if (headerEntries().length === 0) setHeaderEntries([blankEntry()]);
    setHeadersOpen(true);
  };

  const handleSubmit = () => {
    const promptText = store.prompt().trim();
    const models = store.columns.map((c) => c.displayName ?? c.model);
    setCompletedResults(null);
    const runId = store.runAll({ requestHeaders: toHeaderRecord(headerEntries()) });
    if (!runId) return;

    // Add to history immediately so user sees the running benchmark
    setHistoryRuns((prev) => [
      {
        id: runId,
        prompt: promptText,
        createdAt: new Date().toISOString(),
        modelCount: models.length,
        models,
        starred: false,
      },
      ...prev.filter((r) => r.id !== runId),
    ]);
    setActiveRunId(runId);
    setLiveRunId(runId);
    setViewingHistory(null);
    setSearchParams({ run: runId });
    sessionStorage.setItem('manifest.benchmark.lastRun', runId);
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
        if (prev === true && running === false) {
          setLiveRunId(null);
          // Snapshot completed results so the summary table survives column removals
          setCompletedResults([...store.columns]);
          void refreshHistory().then(() => {
            // If user isn't viewing a past run, auto-select the latest
            if (!viewingHistory()) {
              const runs = historyRuns();
              if (runs.length > 0) {
                setActiveRunId(runs[0].id);
                setSearchParams({ run: runs[0].id });
              }
            }
          });
        }
      },
      { defer: true },
    ),
  );

  createEffect(() => {
    const a = available();
    const p = providers();
    if (!a || !p) return;
    // Don't overwrite existing columns (e.g. after navigating away and back)
    if (store.columns.length > 0) return;
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
    // If clicking on the live (currently running) run, just show live columns
    if (runId === liveRunId()) {
      setViewingHistory(null);
      setCompletedResults(null);
      setActiveRunId(runId);
      setSearchParams({ run: runId });
      return;
    }
    try {
      const detail = await getBenchmarkRun(runId, params.agentName);
      const toReadOnlyCols = (): import('../services/benchmark-store.js').BenchmarkColumn[] =>
        detail.columns.map((c, i) => ({
          id: `hist-${i}`,
          model: c.model,
          provider: c.provider,
          authType: (c.authType ?? 'api_key') as AuthType,
          displayName: c.displayName ?? c.model,
          status: c.status === 'success' ? ('success' as const) : ('error' as const),
          response: c.content ?? undefined,
          metrics: c.metrics ?? undefined,
          headers: c.headers ?? undefined,
          error: c.errorMessage ?? undefined,
        }));

      if (store.isAnyRunning() || !hasConnectedProviders()) {
        // Don't touch the store -- show history as a read-only overlay
        const cols = toReadOnlyCols();
        setViewingHistory(cols);
        setCompletedResults(cols);
      } else {
        // No run in progress and providers available, safe to replace the store
        store.loadHistoryRun(detail);
        setViewingHistory(null);
        setCompletedResults([...store.columns]);
      }
      setActiveRunId(runId);
      setSearchParams({ run: runId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load benchmark');
    }
  };

  const handleStarToggle = (runId: string, starred: boolean) => {
    setHistoryRuns((prev) => prev.map((r) => (r.id === runId ? { ...r, starred } : r)));
  };

  createEffect(() => {
    setRightSidebar(
      <BenchmarkRecentSidebar
        open={historyOpen()}
        loading={historyLoading()}
        runs={historyRuns()}
        activeRunId={activeRunId()}
        onToggle={toggleRecent}
        onSelect={handlePickHistory}
        onStarToggle={handleStarToggle}
        onNewBenchmark={handleNewBenchmark}
      />,
    );
  });
  onCleanup(() => setRightSidebar(null));

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
          class="btn btn--primary btn--sm"
          onClick={() => setShowProviderModal(true)}
        >
          Connect providers
        </button>
      </header>

      <Show
        when={(available() && providers() && hasConnectedProviders()) || viewingHistory()}
        fallback={
          <Show when={available() && providers()}>
            <BenchmarkEmptyState onConnect={() => setShowProviderModal(true)} />
          </Show>
        }
      >
        <div class="benchmark__columns" aria-label="Model comparison columns">
          <For each={viewingHistory() ?? store.columns}>
            {(col) => (
              <BenchmarkColumn
                column={col}
                isCheapest={
                  col.metrics?.cost != null && col.metrics.cost === winners().cheapestCost
                }
                isFastest={
                  col.metrics?.durationMs != null &&
                  col.metrics.durationMs === winners().fastestDuration
                }
                readOnly={!!viewingHistory() || !hasConnectedProviders()}
                onRemove={viewingHistory() ? () => {} : store.removeColumn}
                onChangeModel={viewingHistory() ? () => {} : setPickerForColumn}
                onRetry={handleRetry}
              />
            )}
          </For>
          <Show when={!viewingHistory() && store.columns.length < MAX_COLUMNS}>
            <button
              type="button"
              class="benchmark__add"
              onClick={() => setShowAddPicker(true)}
              aria-label="Add model column"
              disabled={store.isAnyRunning()}
            >
              <span class="benchmark__add-plus">+</span>
              <span>Add model</span>
              <kbd class="benchmark__add-shortcut">
                <span>{navigator.platform?.includes('Mac') ? '⌘' : 'Ctrl'}</span>
                <span class="benchmark__add-shortcut-plus">+</span>
                <span>K</span>
              </kbd>
            </button>
          </Show>
        </div>

        <BenchmarkSummaryTable columns={viewingHistory() ?? completedResults() ?? store.columns} />

        <Show
          when={hasConnectedProviders()}
          fallback={
            <div class="benchmark-prompt-wrapper">
              <div class="benchmark-prompt benchmark-prompt--info">
                <span class="benchmark-prompt__info-text">
                  Connect a provider to start benchmarking
                </span>
                <button
                  type="button"
                  class="btn btn--primary btn--sm"
                  onClick={() => setShowProviderModal(true)}
                >
                  Connect provider
                </button>
              </div>
            </div>
          }
        >
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

      <Show when={showProviderModal()}>
        <ProviderSelectModal
          agentName={agentName()}
          providers={providers() ?? []}
          customProviders={customProviders() ?? []}
          onClose={() => {
            setShowProviderModal(false);
            refetchAllProviders();
          }}
          onUpdate={refetchAllProviders}
        />
      </Show>
    </div>
  );
};

export default Benchmark;
