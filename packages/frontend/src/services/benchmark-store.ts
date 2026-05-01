import { createSignal } from 'solid-js';
import { createStore, produce } from 'solid-js/store';
import type { AuthType, AvailableModel, RoutingProvider } from './api.js';
import { runBenchmark, type BenchmarkHistoryRunDetail, type BenchmarkRunResult } from './api.js';
import { resolveProviderId, inferProviderFromModel } from './routing-utils.js';

export type ColumnStatus = 'idle' | 'loading' | 'success' | 'error';

export interface BenchmarkColumn {
  id: string;
  model: string;
  provider: string;
  authType: AuthType;
  displayName: string;
  status: ColumnStatus;
  response?: string;
  metrics?: BenchmarkRunResult['metrics'];
  headers?: Record<string, string>;
  error?: string;
}

export interface BenchmarkStore {
  columns: readonly BenchmarkColumn[];
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
  runAll: (options?: RunOptions) => Promise<void>;
  retryColumn: (id: string, options?: RunOptions) => Promise<void>;
  recallPreviousPrompt: () => void;
  isAnyRunning: () => boolean;
  pickDefaults: (available: AvailableModel[], connected: RoutingProvider[]) => void;
  loadHistoryRun: (detail: BenchmarkHistoryRunDetail) => void;
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

function providerIdForModel(m: AvailableModel): string {
  const dbId = resolveProviderId(m.provider);
  const prefixId = inferProviderFromModel(m.model_name);
  if (dbId === 'ollama' || dbId === 'ollama-cloud') return dbId;
  return prefixId ?? dbId ?? m.provider;
}

export function createBenchmarkStore(agentName: string): BenchmarkStore {
  const [columns, setColumns] = createStore<BenchmarkColumn[]>([]);
  const [prompt, setPrompt] = createSignal('');
  const [history, setHistory] = createSignal<string[]>([]);

  const addColumn: BenchmarkStore['addColumn'] = (model, provider, authType, displayName) => {
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

  const removeColumn: BenchmarkStore['removeColumn'] = (id) => {
    setColumns((prev) => prev.filter((c) => c.id !== id));
  };

  const replaceColumnModel: BenchmarkStore['replaceColumnModel'] = (
    id,
    model,
    provider,
    authType,
    displayName,
  ) => {
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
    setColumns(
      (c) => c.id === colId,
      produce((c) => {
        c.status = 'loading';
        c.response = undefined;
        c.metrics = undefined;
        c.headers = undefined;
        c.error = undefined;
      }),
    );
    try {
      const result = await runBenchmark({
        agentName,
        model: col.model,
        provider: col.provider,
        authType: col.authType,
        messages: [{ role: 'user', content: promptText }],
        runId,
        position,
        ...(requestHeaders && Object.keys(requestHeaders).length > 0 ? { requestHeaders } : {}),
      });
      setColumns(
        (c) => c.id === colId,
        produce((c) => {
          c.status = 'success';
          c.response = result.content;
          c.metrics = result.metrics;
          c.headers = result.headers;
        }),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Request failed';
      setColumns(
        (c) => c.id === colId,
        produce((c) => {
          c.status = 'error';
          c.error = message;
        }),
      );
    }
  };

  const runAll: BenchmarkStore['runAll'] = async (options) => {
    const promptText = prompt().trim();
    if (!promptText || columns.length === 0) return;
    setHistory((prev) => (prev[0] === promptText ? prev : [promptText, ...prev].slice(0, 20)));
    const runId = newRunId();
    await Promise.allSettled(
      columns.map((c, i) => runSingle(c.id, promptText, runId, i, options?.requestHeaders)),
    );
  };

  const retryColumn: BenchmarkStore['retryColumn'] = async (id, options) => {
    const promptText = prompt().trim() || history()[0];
    if (!promptText) return;
    const position = columns.findIndex((c) => c.id === id);
    await runSingle(id, promptText, newRunId(), Math.max(position, 0), options?.requestHeaders);
  };

  const loadHistoryRun: BenchmarkStore['loadHistoryRun'] = (detail) => {
    const next: BenchmarkColumn[] = detail.columns.map((c) => ({
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
    }));
    setColumns(next);
    setPrompt(detail.prompt);
    setHistory((prev) =>
      prev[0] === detail.prompt ? prev : [detail.prompt, ...prev].slice(0, 20),
    );
  };

  const recallPreviousPrompt: BenchmarkStore['recallPreviousPrompt'] = () => {
    const last = history()[0];
    if (last) setPrompt(last);
  };

  const isAnyRunning: BenchmarkStore['isAnyRunning'] = () =>
    columns.some((c) => c.status === 'loading');

  const pickDefaults: BenchmarkStore['pickDefaults'] = (available, connected) => {
    if (columns.length > 0) return;

    const activeProviderIds = new Set<string>();
    for (const p of connected) {
      if (!p.is_active) continue;
      activeProviderIds.add(p.provider.toLowerCase());
      const resolved = resolveProviderId(p.provider);
      if (resolved) activeProviderIds.add(resolved);
    }
    if (activeProviderIds.size === 0) return;

    const eligible = available.filter((m) => {
      if (!m.auth_type) return false;
      const provId = providerIdForModel(m);
      return activeProviderIds.has(provId) || activeProviderIds.has(m.provider.toLowerCase());
    });
    if (eligible.length === 0) return;

    const byProvider = new Map<string, AvailableModel[]>();
    for (const m of eligible) {
      const provId = providerIdForModel(m);
      const bucket = byProvider.get(provId) ?? [];
      bucket.push(m);
      byProvider.set(provId, bucket);
    }

    const providerIds = shuffled([...byProvider.keys()]);
    const picks: AvailableModel[] = [];

    if (providerIds.length >= 2) {
      for (const provId of providerIds) {
        const bucket = byProvider.get(provId);
        if (!bucket || bucket.length === 0) continue;
        const paid = bucket.filter((m) => !isFree(m));
        const pick = shuffled(paid.length > 0 ? paid : bucket)[0];
        if (!pick) continue;
        picks.push(pick);
        if (picks.length === 2) break;
      }
    } else {
      const soloBucket = byProvider.get(providerIds[0] ?? '') ?? [];
      picks.push(...shuffled(soloBucket).slice(0, 2));
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
    recallPreviousPrompt,
    isAnyRunning,
    pickDefaults,
    loadHistoryRun,
  };
}
