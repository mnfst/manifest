import {
  createEffect,
  createResource,
  createSignal,
  For,
  on,
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
  getMessageDetails,
  getProviders,
  listBenchmarkRuns,
} from '../services/api.js';
import { extractRecordedAssistantText } from '../services/recording-extract.js';
import { inferProviderFromModel } from '../services/routing-utils.js';
import { agentPath } from '../services/routing.js';
import { coerceContentToText } from '../components/recorded-message-helpers.js';
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
  isBlockedHeaderKey,
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
  const [searchParams, setSearchParams] = useSearchParams<{ optimize?: string }>();
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

  // Replay button is always enabled: the picker drawer handles the empty
  // state ("No recorded messages yet") with its own copy. Gating on a
  // cold-start probe meant a transient network blip silently locked the
  // button out for the rest of the session.
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
    // Confirm before wiping a non-empty board: replay enters recording mode,
    // which replaces every existing column with a single Original. Without
    // this, a user with a half-completed run loses it on a misclick.
    const nonOriginal = store.columns.filter((c) => !c.isOriginal);
    if (nonOriginal.length > 0 && !store.replaySource()) {
      const confirmed =
        typeof window !== 'undefined' && typeof window.confirm === 'function'
          ? window.confirm(
              `Loading this recording will replace your ${nonOriginal.length} current column${nonOriginal.length === 1 ? '' : 's'}. Continue?`,
            )
          : true;
      if (!confirmed) return;
    }
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
      // OpenClaw-style traffic sends content as an array of {type,text} parts.
      // Flatten it so the replay banner shows a readable prompt, not the raw JSON.
      const promptText = coerceContentToText(lastUser?.content).slice(0, 500);
      const modelName =
        detail.message.model ??
        (typeof recReq['model'] === 'string' ? (recReq['model'] as string) : 'unknown');
      const displayName = findDisplayName(available() ?? [], modelName);
      // Trust the recorded backend provider first — aggregators (ollama-cloud,
      // openrouter) serve brand-named models (glm-*, qwen-*) that would
      // otherwise infer the wrong logo + comparison label. Fall back to
      // name-based inference only when the recording has no provider column.
      const providerGuess =
        detail.message.provider && detail.message.provider.trim() !== ''
          ? detail.message.provider
          : (inferProviderFromModel(modelName) ?? 'unknown');
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
            cost: detail.message.cost_usd ?? 0,
            inputTokens: detail.message.input_tokens,
            outputTokens: detail.message.output_tokens,
            durationMs: detail.message.duration_ms ?? 0,
          },
          headers: detail.recording.response_headers ?? undefined,
        },
      );
      // Pre-fill the benchmark's Request-headers popover with the original
      // request headers so each replay call carries the same client context
      // (user-agent, x-request-id, app hints) as the recording. Manifest-
      // managed headers (auth, content-type, x-manifest-*) are dropped — the
      // popover rejects them anyway and each provider gets its own auth.
      const recHeaders = detail.message.request_headers ?? {};
      const preloaded: HeaderEntry[] = Object.entries(recHeaders)
        .filter(([k, v]) => k && v && !isBlockedHeaderKey(k))
        .slice(0, 20)
        .map(([key, value]) => ({ ...blankEntry(), key, value: String(value) }));
      if (preloaded.length > 0) {
        updateHeaders(preloaded);
      }
      setReplayPickerOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load recording');
    }
  };

  // Deep-link: the "Optimize" button on a recorded message opens Benchmark with
  // ?optimize=<messageId>. Auto-pin the recording and clear the query param so
  // refreshing the page doesn't re-trigger it.
  const [optimizeHandled, setOptimizeHandled] = createSignal(false);
  createEffect(() => {
    const id = searchParams.optimize;
    if (!id || optimizeHandled()) return;
    setOptimizeHandled(true);
    void handlePickRecording(id);
    setSearchParams({ optimize: undefined }, { replace: true });
  });

  const hasConnectedProviders = () => (providers() ?? []).some((p) => p.is_active);
  /**
   * Cross-provider comparison is the value prop. When only one provider is
   * connected, the auto-picked defaults will be two columns from the same
   * vendor — surfacing this hint nudges users to wire up another so the
   * Benchmark page actually answers "is there a cheaper/faster option?".
   */
  const onlyOneProvider = () =>
    new Set((providers() ?? []).filter((p) => p.is_active).map((p) => p.provider.toLowerCase()))
      .size <= 1;
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
        <Show when={onlyOneProvider()}>
          <div class="benchmark__cross-provider-hint" role="note">
            <span>Add a second provider to compare across vendors.</span>
            <a href={agentPath(agentName(), '/routing')} class="benchmark__cross-provider-link">
              Open Routing
            </a>
          </div>
        </Show>
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
                onCancel={store.cancelColumn}
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
                aria-label="Re-run a recorded query"
                title="Re-run a recorded query"
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
