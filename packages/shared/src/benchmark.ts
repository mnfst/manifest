export interface BenchmarkMetrics {
  cost: number | null;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
}

export interface BenchmarkRunResult {
  content: string;
  metrics: BenchmarkMetrics;
  headers: Record<string, string>;
}

export interface BenchmarkHistoryColumn {
  id: string;
  model: string;
  provider: string;
  authType: 'api_key' | 'subscription' | null;
  displayName: string | null;
  status: 'success' | 'error';
  content: string | null;
  headers: Record<string, string> | null;
  errorMessage: string | null;
  metrics: BenchmarkMetrics | null;
  position: number;
}

export interface BenchmarkHistoryRunSummary {
  id: string;
  prompt: string;
  createdAt: string;
  modelCount: number;
  models: string[];
}

export interface BenchmarkHistoryRunDetail extends BenchmarkHistoryRunSummary {
  columns: BenchmarkHistoryColumn[];
}
