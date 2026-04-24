import type { AvailableModel } from './api.js';
import type { BenchmarkColumn } from './benchmark-store.js';
import {
  isBlockedHeaderKey,
  type HeaderEntry,
} from '../components/benchmark/RequestHeadersPopover.jsx';

export const REQUEST_HEADERS_STORAGE_KEY = 'manifest.benchmark.requestHeaders';

/** Parse and type-guard localStorage-persisted header entries. */
export function loadStoredHeaders(): HeaderEntry[] {
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

/** Best-effort persist — private browsing / quota errors are silently swallowed. */
export function persistHeaders(entries: HeaderEntry[]): void {
  try {
    localStorage.setItem(REQUEST_HEADERS_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    /* quota / private mode — silently ignore */
  }
}

/** Count entries that will actually be forwarded — key + value filled and not blocked. */
export function activeHeaderCount(entries: HeaderEntry[]): number {
  let n = 0;
  for (const e of entries) {
    const k = e.key.trim();
    if (!k || !e.value) continue;
    if (isBlockedHeaderKey(k)) continue;
    n++;
  }
  return n;
}

/** Resolve the display name for a model from the available-models list. */
export function findDisplayName(
  available: Array<Pick<AvailableModel, 'model_name' | 'display_name'>>,
  modelName: string,
): string {
  const match = available.find((m) => m.model_name === modelName);
  return match?.display_name ?? modelName;
}

export interface Winners {
  cheapestId?: string;
  fastestId?: string;
}

/**
 * Cheapest cost + fastest duration across columns that completed successfully
 * in this session. The pinned "Original" column (isOriginal=true) is a
 * historical recording and is excluded — comparing it head-to-head with
 * fresh calls would mislead (its latency came from a different day).
 */
export function findWinners(columns: readonly BenchmarkColumn[]): Winners {
  const success = columns.filter((c) => !c.isOriginal && c.status === 'success' && c.metrics);
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
