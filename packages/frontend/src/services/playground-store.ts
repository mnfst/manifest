import { createRoot, createSignal } from 'solid-js';
import { createStore, produce } from 'solid-js/store';
import type { AuthType, AvailableModel, RoutingProvider } from './api.js';
import {
  streamPlayground,
  setPlaygroundRunBest,
  type PlaygroundHistoryRunDetail,
  type PlaygroundRunResult,
} from './api.js';
import { resolveProviderId, inferProviderFromModel } from './routing-utils.js';

export type ColumnStatus = 'idle' | 'loading' | 'success' | 'error';

export interface PlaygroundColumn {
  id: string;
  model: string;
  provider: string;
  authType: AuthType;
  displayName: string;
  status: ColumnStatus;
  response?: string;
  metrics?: PlaygroundRunResult['metrics'];
  headers?: Record<string, string>;
  error?: string;
  /**
   * Persisted playground_columns.id (set once the run finishes). Lets the user
   * mark this column the best answer without a history round-trip.
   */
  columnDbId?: string | null;
}

export interface PlaygroundStore {
  columns: readonly PlaygroundColumn[];
  prompt: () => string;
  setPrompt: (value: string) => void;
  addColumn: (model: string, provider: string, authType: AuthType, displayName: string) => void;
  removeColumn: (id: string) => void;
  replaceColumnModel: (
    id: string,
    model: string,
    provider: string,
    authType: AuthType,
    displayName: string,
  ) => void;
  runAll: (options?: RunOptions) => string | undefined;
  retryColumn: (id: string, options?: RunOptions) => Promise<void>;
  cancelColumn: (id: string) => void;
  cancelAll: () => void;
  recallPreviousPrompt: () => void;
  isAnyRunning: () => boolean;
  pickDefaults: (available: AvailableModel[], connected: RoutingProvider[]) => void;
  loadHistoryRun: (detail: PlaygroundHistoryRunDetail) => void;
  /** playground_columns.id the user marked best for the current run, or null. */
  bestColumnId: () => string | null;
  /** Toggle a column as the best answer (clicking the marked one clears it). */
  markBest: (column: PlaygroundColumn) => Promise<void>;
  reset: () => void;
}

export const MAX_COLUMNS = 6;

export interface RunOptions {
  requestHeaders?: Record<string, string>;
}

let columnCounter = 0;
const nextColumnId = (): string => `col-${++columnCounter}-${Date.now().toString(36)}`;

/** Browser-safe UUID v4. Prefers crypto.randomUUID when available. */
function newRunId(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (typeof g.crypto?.randomUUID === 'function') return g.crypto.randomUUID();
  // RFC4122-v4 fallback
  const hex = (n: number) => Math.floor(Math.random() * n).toString(16);
  const s = (len: number, radix = 16) => {
    let out = '';
    for (let i = 0; i < len; i++) out += hex(radix);
    return out;
  };
  return `${s(8)}-${s(4)}-4${s(3)}-${(8 + Math.floor(Math.random() * 4)).toString(16)}${s(3)}-${s(12)}`;
}

/** Resolve a display name for an AvailableModel (falls back to the model id). */
function displayNameFor(m: AvailableModel): string {
  return m.display_name ?? m.model_name;
}

/**
 * Deterministic-ish shuffle (Fisher-Yates). Kept local to avoid a new util file.
 * Callers pass in a fresh copy; this never mutates the input.
 */
function shuffled<T>(arr: readonly T[]): T[] {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = copy[i] as T;
    copy[i] = copy[j] as T;
    copy[j] = tmp;
  }
  return copy;
}

function isFree(m: AvailableModel): boolean {
  return (
    m.input_price_per_token != null &&
    m.output_price_per_token != null &&
    Number(m.input_price_per_token) === 0 &&
    Number(m.output_price_per_token) === 0
  );
}

/**
 * The provider a model name advertises. An explicit `vendor/` slug wins when
 * that vendor is a known provider — `inferProviderFromModel` otherwise buckets
 * every `foo/bar` slug as "openrouter", which would hide a slug-formatted
 * native ("openai/gpt-4o-mini" on the openai provider) behind a cross-vendor
 * proxy ("gemini-imposter" on openai) in the native-vs-proxy pick below.
 */
function modelBrandId(modelName: string): string | undefined {
  const slashIdx = modelName.indexOf('/');
  if (slashIdx > 0) {
    const fromSlug = resolveProviderId(modelName.slice(0, slashIdx));
    if (fromSlug) return fromSlug;
  }
  return inferProviderFromModel(modelName);
}

export function createPlaygroundStore(agentName: string): PlaygroundStore {
  const [columns, setColumns] = createStore<PlaygroundColumn[]>([]);
  const [prompt, setPrompt] = createSignal('');
  const [history, setHistory] = createSignal<string[]>([]);
  // The run currently shown (live submit or a loaded history run). The "best
  // answer" pick is per-run, so marking best PATCHes this run.
  const [bestColumnId, setBestColumnId] = createSignal<string | null>(null);
  let currentRunId: string | null = null;
  // Per-column AbortController. Set when a column starts loading, cleared
  // when it settles. Lives outside the store so it doesn't trigger reactivity.
  const inflight = new Map<string, AbortController>();

  const abortColumn = (id: string): void => {
    const ctrl = inflight.get(id);
    if (!ctrl) return;
    ctrl.abort();
    inflight.delete(id);
  };

  const addColumn: PlaygroundStore['addColumn'] = (model, provider, authType, displayName) => {
    if (columns.length >= MAX_COLUMNS) return;
    setColumns((prev) => [
      ...prev,
      {
        id: nextColumnId(),
        model,
        provider,
        authType,
        displayName,
        status: 'idle',
      },
    ]);
  };

  const removeColumn: PlaygroundStore['removeColumn'] = (id) => {
    abortColumn(id);
    setColumns((prev) => prev.filter((c) => c.id !== id));
  };

  const replaceColumnModel: PlaygroundStore['replaceColumnModel'] = (
    id,
    model,
    provider,
    authType,
    displayName,
  ) => {
    abortColumn(id);
    setColumns(
      produce((cols) => {
        const col = cols.find((c) => c.id === id);
        if (!col) return;
        col.model = model;
        col.provider = provider;
        col.authType = authType;
        col.displayName = displayName;
        col.status = 'idle';
        col.response = undefined;
        col.metrics = undefined;
        col.headers = undefined;
        col.error = undefined;
      }),
    );
  };

  const runSingle = async (
    colId: string,
    promptText: string,
    runId: string,
    position: number,
    requestHeaders: Record<string, string> | undefined,
  ): Promise<void> => {
    const col = columns.find((c) => c.id === colId);
    if (!col) return;
    abortColumn(colId);
    const ctrl = new AbortController();
    inflight.set(colId, ctrl);
    setColumns(
      (c) => c.id === colId,
      produce((c) => {
        c.status = 'loading';
        c.response = undefined;
        c.metrics = undefined;
        c.headers = undefined;
        c.error = undefined;
        c.columnDbId = undefined;
      }),
    );
    try {
      const result = await streamPlayground(
        {
          agentName,
          model: col.model,
          provider: col.provider,
          authType: col.authType,
          messages: [{ role: 'user', content: promptText }],
          runId,
          position,
          ...(requestHeaders && Object.keys(requestHeaders).length > 0 ? { requestHeaders } : {}),
        },
        {
          signal: ctrl.signal,
          onDelta: (text) => {
            // Drop late deltas if the column was removed/replaced mid-stream.
            if (inflight.get(colId) !== ctrl) return;
            setColumns(
              (c) => c.id === colId,
              produce((c) => {
                c.response = (c.response ?? '') + text;
              }),
            );
          },
        },
      );
      // The user may have removed/replaced the column while we were waiting;
      // drop the result silently rather than re-instate a column that's gone.
      if (inflight.get(colId) !== ctrl) return;
      setColumns(
        (c) => c.id === colId,
        produce((c) => {
          c.status = 'success';
          c.response = result.content;
          c.metrics = result.metrics;
          c.headers = result.headers;
          c.columnDbId = result.columnId;
        }),
      );
    } catch (err) {
      if (inflight.get(colId) !== ctrl) return;
      // AbortError is the user's intent (cancel/replace/remove) — don't paint
      // an error state, just leave the column where the abort path put it.
      if (err instanceof DOMException && err.name === 'AbortError') return;
      const message = err instanceof Error ? err.message : 'Request failed';
      setColumns(
        (c) => c.id === colId,
        produce((c) => {
          c.status = 'error';
          c.error = message;
        }),
      );
    } finally {
      if (inflight.get(colId) === ctrl) inflight.delete(colId);
    }
  };

  const runAll: PlaygroundStore['runAll'] = (options) => {
    const promptText = prompt().trim();
    if (!promptText || columns.length === 0) return undefined;
    setHistory((prev) => (prev[0] === promptText ? prev : [promptText, ...prev].slice(0, 20)));
    const runId = newRunId();
    // New submit = a fresh run with no best pick yet.
    currentRunId = runId;
    setBestColumnId(null);
    void Promise.allSettled(
      columns.map((c, i) => runSingle(c.id, promptText, runId, i, options?.requestHeaders)),
    );
    return runId;
  };

  const retryColumn: PlaygroundStore['retryColumn'] = async (id, options) => {
    const promptText = prompt().trim() || history()[0];
    if (!promptText) return;
    const position = columns.findIndex((c) => c.id === id);
    await runSingle(id, promptText, newRunId(), Math.max(position, 0), options?.requestHeaders);
  };

  const cancelColumn: PlaygroundStore['cancelColumn'] = (id) => {
    abortColumn(id);
    setColumns(
      (c) => c.id === id,
      produce((c) => {
        if (c.status === 'loading') c.status = 'idle';
      }),
    );
  };

  const cancelAll: PlaygroundStore['cancelAll'] = () => {
    for (const id of Array.from(inflight.keys())) cancelColumn(id);
  };

  const loadHistoryRun: PlaygroundStore['loadHistoryRun'] = (detail) => {
    // History replaces the entire column set; abort anything in flight first
    // so stale results don't paint over the loaded columns.
    cancelAll();
    const next: PlaygroundColumn[] = detail.columns.map((c) => ({
      id: nextColumnId(),
      model: c.model,
      provider: c.provider,
      authType: (c.authType ?? 'api_key') as AuthType,
      displayName: c.displayName ?? c.model,
      status: c.status,
      response: c.content ?? undefined,
      metrics: c.metrics ?? undefined,
      headers: c.headers ?? undefined,
      error: c.errorMessage ?? undefined,
      columnDbId: c.id,
    }));
    setColumns(next);
    currentRunId = detail.id;
    setBestColumnId(detail.bestColumnId ?? null);
    setPrompt(detail.prompt);
    setHistory((prev) =>
      prev[0] === detail.prompt ? prev : [detail.prompt, ...prev].slice(0, 20),
    );
  };

  const recallPreviousPrompt: PlaygroundStore['recallPreviousPrompt'] = () => {
    const last = history()[0];
    if (last) setPrompt(last);
  };

  const isAnyRunning: PlaygroundStore['isAnyRunning'] = () =>
    columns.some((c) => c.status === 'loading');

  const pickDefaults: PlaygroundStore['pickDefaults'] = (available, connected) => {
    if (columns.length > 0) return;

    const activeProviderIds = new Set<string>();
    for (const p of connected) {
      if (!p.is_active) continue;
      activeProviderIds.add(p.provider.toLowerCase());
      const resolved = resolveProviderId(p.provider);
      if (resolved) activeProviderIds.add(resolved);
    }
    if (activeProviderIds.size === 0) return;

    // Only keep models whose *backend* provider matches a connected one.
    // Ignore prefix inference here — aggregators (ollama-cloud / openrouter)
    // list brand-named models like gemini-3-flash-preview that rightfully
    // route through them, and the connected-provider match is the real test
    // of whether a call can succeed.
    const eligible = available.filter((m) => {
      if (!m.auth_type) return false;
      const dbId = resolveProviderId(m.provider) ?? m.provider.toLowerCase();
      return activeProviderIds.has(dbId) || activeProviderIds.has(m.provider.toLowerCase());
    });
    if (eligible.length === 0) return;

    const byProvider = new Map<string, AvailableModel[]>();
    for (const m of eligible) {
      // Bucket by backend-declared provider (not prefix-inferred) — so the
      // "cross-provider" picker across distinct buckets actually means
      // distinct connected providers, not distinct brand hints.
      const provId = resolveProviderId(m.provider) ?? m.provider.toLowerCase();
      const bucket = byProvider.get(provId) ?? [];
      bucket.push(m);
      byProvider.set(provId, bucket);
    }

    // Prefer models whose name-inferred brand matches their backend provider
    // (a "native" match) over aggregator proxies that borrow another vendor's
    // brand — gemini-3-flash-preview served via ollama-cloud, etc.
    const pickOne = (bucket: AvailableModel[], provId: string): AvailableModel | undefined => {
      const paid = bucket.filter((m) => !isFree(m));
      const pool = paid.length > 0 ? paid : bucket;
      const natives = pool.filter((m) => {
        const prefixId = modelBrandId(m.model_name);
        return !prefixId || prefixId === provId;
      });
      return shuffled(natives.length > 0 ? natives : pool)[0];
    };

    const providerIds = shuffled([...byProvider.keys()]);
    const picks: AvailableModel[] = [];

    if (providerIds.length >= 2) {
      for (const provId of providerIds) {
        const bucket = byProvider.get(provId);
        if (!bucket || bucket.length === 0) continue;
        const pick = pickOne(bucket, provId);
        if (!pick) continue;
        picks.push(pick);
        if (picks.length === 2) break;
      }
    } else {
      const provId = providerIds[0] ?? '';
      const soloBucket = byProvider.get(provId) ?? [];
      const natives = soloBucket.filter((m) => {
        const prefixId = modelBrandId(m.model_name);
        return !prefixId || prefixId === provId;
      });
      // Take 2 from natives first; if we don't have enough, backfill with
      // proxy-branded models so the user still sees two defaults.
      const orderedPool = [
        ...shuffled(natives),
        ...shuffled(soloBucket.filter((m) => !natives.includes(m))),
      ];
      picks.push(...orderedPool.slice(0, 2));
    }

    if (picks.length === 0) return;

    setColumns(
      picks.map((m) => ({
        id: nextColumnId(),
        model: m.model_name,
        provider: m.provider,
        authType: (m.auth_type ?? 'api_key') as AuthType,
        displayName: displayNameFor(m),
        status: 'idle',
      })),
    );
  };

  const markBest: PlaygroundStore['markBest'] = async (column) => {
    const target = column.columnDbId;
    // Only persisted columns of a known run can be judged.
    if (!target || !currentRunId) return;
    const previous = bestColumnId();
    // Toggle: clicking the current pick clears it.
    const next = previous === target ? null : target;
    setBestColumnId(next); // optimistic
    try {
      await setPlaygroundRunBest(currentRunId, next);
    } catch (err) {
      // Only roll back if no newer pick superseded this optimistic update —
      // otherwise a stale failure would clobber the user's latest choice.
      if (bestColumnId() === next) setBestColumnId(previous);
      throw err;
    }
  };

  const reset: PlaygroundStore['reset'] = () => {
    cancelAll();
    setColumns([]);
    setPrompt('');
    currentRunId = null;
    setBestColumnId(null);
  };

  return {
    get columns() {
      return columns;
    },
    prompt,
    setPrompt,
    addColumn,
    removeColumn,
    replaceColumnModel,
    runAll,
    retryColumn,
    cancelColumn,
    cancelAll,
    recallPreviousPrompt,
    isAnyRunning,
    pickDefaults,
    loadHistoryRun,
    bestColumnId,
    markBest,
    reset,
  };
}

/**
 * Cache stores by agent name so they survive navigation.
 * Signals are kept alive via createRoot (no owner disposal on unmount).
 */
const storeCache = new Map<string, PlaygroundStore>();

export function getOrCreatePlaygroundStore(agentName: string): PlaygroundStore {
  let store = storeCache.get(agentName);
  if (!store) {
    createRoot(() => {
      store = createPlaygroundStore(agentName);
      storeCache.set(agentName, store!);
    });
  }
  return store!;
}
