import type { AuthType } from './auth-types';

export interface PlaygroundMetrics {
  cost: number | null;
  inputTokens: number;
  outputTokens: number;
  /** Total wall time from request start to the last streamed token. */
  durationMs: number;
  /** Time to first token (ms). Null when the provider streamed no usable delta. */
  ttftMs?: number | null;
  /** Output tokens per second over the generation window. Null when underivable. */
  tokensPerSec?: number | null;
}

export interface PlaygroundRunResult {
  content: string;
  metrics: PlaygroundMetrics;
  headers: Record<string, string>;
}

/**
 * Wire contract for the streamed `POST /api/v1/playground/run` SSE response.
 * `delta` repeats with incremental text; exactly one terminal `done` or
 * `error` ends the stream. `columnId` is the persisted playground_columns row
 * so the client can mark it the best answer without a history round-trip.
 */
export type PlaygroundStreamEvent =
  | { type: 'delta'; text: string }
  | {
      type: 'done';
      columnId: string | null;
      content: string;
      metrics: PlaygroundMetrics;
      headers: Record<string, string>;
    }
  | { type: 'error'; message: string };

export interface PlaygroundHistoryColumn {
  id: string;
  model: string;
  provider: string;
  authType: AuthType | null;
  displayName: string | null;
  status: 'success' | 'error';
  content: string | null;
  headers: Record<string, string> | null;
  errorMessage: string | null;
  metrics: PlaygroundMetrics | null;
  position: number;
}

export interface PlaygroundHistoryRunSummary {
  id: string;
  prompt: string;
  createdAt: string;
  modelCount: number;
  models: string[];
  starred: boolean;
  /** playground_columns.id the user marked as the best answer, or null. */
  bestColumnId: string | null;
}

export interface PlaygroundHistoryRunDetail extends PlaygroundHistoryRunSummary {
  columns: PlaygroundHistoryColumn[];
}
