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
  getMessageDetails,
  getMessages,
  getProviders,
  listBenchmarkRuns,
} from '../services/api.js';
import { extractRecordedAssistantText } from '../services/recording-extract.js';
import { inferProviderFromModel } from '../services/routing-utils.js';
import { createBenchmarkStore, MAX_COLUMNS } from '../services/benchmark-store.js';
import { toast } from '../services/toast-store.js';
import BenchmarkColumn from '../components/benchmark/BenchmarkColumn.jsx';
import BenchmarkPrompt from '../components/benchmark/BenchmarkPrompt.jsx';
import BenchmarkSummaryTable from '../components/benchmark/BenchmarkSummaryTable.jsx';
import BenchmarkModelPicker from '../components/benchmark/BenchmarkModelPicker.jsx';
import BenchmarkEmptyState from '../components/benchmark/BenchmarkEmptyState.jsx';
import BenchmarkHistoryDrawer from '../components/benchmark/BenchmarkHistoryDrawer.jsx';
import RequestHeadersPopover, {
  blankEntry,
  toHeaderRecord,
  type HeaderEntry,
} from '../components/benchmark/RequestHeadersPopover.jsx';
import ReplayPickerDrawer from '../components/benchmark/ReplayPickerDrawer.jsx';
import { CodeIcon, HistoryIcon, ReplayIcon } from '../components/benchmark/icons.jsx';
import {
  activeHeaderCount,
  findDisplayName,
  findWinners,
  loadStoredHeaders,
  persistHeaders,
} from '../services/benchmark-helpers.js';

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
  const [replayPickerOpen, setReplayPickerOpen] = createSignal(false);

  // Cold-start probe: does this agent have any recorded messages at all?
  // Drives the enabled/disabled state of the replay button.
  const [recordingsProbe] = createResource(agentName, async (name) => {
    try {
      const data = (await getMessages({ recorded: 'true', agent_name: name, limit: '1' })) as {
        items?: unknown[];
      };
      return (data.items ?? []).length > 0;
    } catch {
      return false;
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
    try {
      const detail = await getBenchmarkRun(runId);
      store.loadHistoryRun(detail);
      setActiveRunId(runId);
      setHistoryOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load benchmark');
    }
  };

  const handlePickRecording = async (messageId: string) => {
    try {
      const detail = await getMessageDetails(messageId);
      if (!detail.recording?.request_body) {
        toast.error('Selected message has no recorded request body.');
        return;
      }
      const recReq = detail.recording.request_body as Record<string, unknown>;
      const messagesArr = Array.isArray(recReq['messages'])
        ? (recReq['messages'] as Array<{ role?: unknown; content?: unknown }>)
        : [];
      const lastUser = [...messagesArr].reverse().find((m) => m && m.role === 'user');
      const promptText =
        typeof lastUser?.content === 'string'
          ? lastUser.content
          : JSON.stringify(lastUser?.content ?? '').slice(0, 500);
      const modelName =
        detail.message.model ??
        (typeof recReq['model'] === 'string' ? (recReq['model'] as string) : 'unknown');
      const displayName = findDisplayName(available() ?? [], modelName);
      const providerGuess = inferProviderFromModel(modelName) ?? 'unknown';
      store.loadRecording(
        {
          messageId,
          prompt: promptText,
          recordedAt: detail.message.timestamp,
          requestBody: recReq,
        },
        {
          id: `orig-${messageId}`,
          model: modelName,
          provider: providerGuess,
          authType: (detail.message.auth_type as AuthType) ?? 'api_key',
          displayName,
          status: 'success',
          response: extractRecordedAssistantText(detail.recording.response_body),
          metrics: {
            cost: detail.message.cost_usd,
            inputTokens: detail.message.input_tokens,
            outputTokens: detail.message.output_tokens,
            durationMs: detail.message.duration_ms ?? 0,
          },
          headers: detail.recording.response_headers ?? undefined,
        },
      );
      setReplayPickerOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load recording');
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
            <>
              <button
                type="button"
                class="benchmark-prompt__headers"
                aria-label={
                  recordingsProbe() ? 'Re-run a recorded query' : 'No recorded messages yet'
                }
                aria-disabled={!recordingsProbe()}
                disabled={!recordingsProbe()}
                title={
                  recordingsProbe()
                    ? 'Re-run a recorded query'
                    : 'No recorded messages yet. Enable recording in Settings to replay past queries.'
                }
                onClick={() => setReplayPickerOpen(true)}
              >
                <ReplayIcon size={16} />
                <Show when={store.replaySource() != null}>
                  <span class="benchmark-prompt__headers-dot" aria-hidden="true" />
                </Show>
              </button>
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
            </>
          }
          replayBanner={
            store.replaySource()
              ? {
                  prompt: store.replaySource()!.prompt,
                  recordedAt: store.replaySource()!.recordedAt,
                  onExit: () => store.exitRecordingMode(),
                }
              : undefined
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

      <ReplayPickerDrawer
        open={replayPickerOpen()}
        agentName={agentName()}
        onClose={() => setReplayPickerOpen(false)}
        onSelect={handlePickRecording}
      />
    </div>
  );
};

export default Benchmark;
