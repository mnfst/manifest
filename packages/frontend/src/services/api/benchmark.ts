import type {
  AuthType,
  BenchmarkHistoryRunDetail,
  BenchmarkHistoryRunSummary,
  BenchmarkRunResult,
} from 'manifest-shared';
import { BASE_URL, fetchJson, parseErrorMessage } from './core.js';

export type {
  BenchmarkHistoryColumn,
  BenchmarkHistoryRunDetail,
  BenchmarkHistoryRunSummary,
  BenchmarkRunResult,
} from 'manifest-shared';

export interface RunBenchmarkRequest {
  agentName: string;
  model: string;
  provider: string;
  authType?: AuthType;
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  runId?: string;
  position?: number;
  requestHeaders?: Record<string, string>;
  rawRequestBody?: Record<string, unknown>;
}

export async function runBenchmark(
  req: RunBenchmarkRequest,
  signal?: AbortSignal,
): Promise<BenchmarkRunResult> {
  const res = await fetch(`${BASE_URL}/benchmark/run`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
    signal,
  });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res));
  }
  return (await res.json()) as BenchmarkRunResult;
}

export function listBenchmarkRuns(agentName: string): Promise<BenchmarkHistoryRunSummary[]> {
  return fetchJson<BenchmarkHistoryRunSummary[]>('/benchmark/runs', { agentName });
}

export function getBenchmarkRun(runId: string): Promise<BenchmarkHistoryRunDetail> {
  return fetchJson<BenchmarkHistoryRunDetail>(`/benchmark/runs/${encodeURIComponent(runId)}`);
}
