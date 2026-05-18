import type {
  AuthType,
  PlaygroundHistoryRunDetail,
  PlaygroundHistoryRunSummary,
  PlaygroundRunResult,
  PlaygroundStreamEvent,
} from 'manifest-shared';
import { BASE_URL, fetchJson, parseErrorMessage } from './core.js';

export type {
  PlaygroundHistoryColumn,
  PlaygroundHistoryRunDetail,
  PlaygroundHistoryRunSummary,
  PlaygroundMetrics,
  PlaygroundRunResult,
} from 'manifest-shared';

/** Resolved value of a completed stream (the terminal `done` event). */
export interface PlaygroundStreamResult {
  columnId: string | null;
  content: string;
  metrics: PlaygroundRunResult['metrics'];
  headers: Record<string, string>;
}

export interface RunPlaygroundRequest {
  agentName: string;
  model: string;
  provider: string;
  authType?: AuthType;
  /** Standard chat-completions shape. Today this is always set. */
  messages?: { role: 'system' | 'user' | 'assistant'; content: string }[];
  /**
   * Verbatim recorded request body, replayed as-is. Reserved for the future
   * "replay a recorded query" flow; today the page never sets this.
   */
  rawRequestBody?: Record<string, unknown>;
  runId?: string;
  position?: number;
  requestHeaders?: Record<string, string>;
}

/**
 * Runs one model and streams its response. `onDelta` fires with each text
 * fragment as it arrives; the promise resolves with the final result once the
 * server emits the terminal `done` event.
 *
 * Failures before the stream opens come back as a normal JSON HTTP error
 * (thrown here); failures mid-stream arrive as an `error` event (also thrown).
 */
export async function streamPlayground(
  req: RunPlaygroundRequest,
  init: { signal?: AbortSignal; onDelta: (text: string) => void },
): Promise<PlaygroundStreamResult> {
  const res = await fetch(`${BASE_URL}/playground/run`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
    signal: init.signal,
  });

  const contentType = res.headers.get('content-type') ?? '';
  if (!res.ok || !contentType.includes('text/event-stream') || !res.body) {
    throw new Error(await parseErrorMessage(res));
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result: PlaygroundStreamResult | null = null;
  let streamError: string | null = null;

  const handleEvent = (block: string): void => {
    let data = '';
    for (const line of block.split('\n')) {
      if (line.startsWith('data:')) data += line.slice(5).trim();
    }
    if (!data) return;
    let payload: PlaygroundStreamEvent;
    try {
      payload = JSON.parse(data) as PlaygroundStreamEvent;
    } catch {
      return;
    }
    if (payload.type === 'delta') {
      init.onDelta(payload.text);
    } else if (payload.type === 'done') {
      result = {
        columnId: payload.columnId,
        content: payload.content,
        metrics: payload.metrics,
        headers: payload.headers,
      };
    } else {
      streamError = payload.message;
    }
  };

  for (;;) {
    const { value, done } = await reader.read();
    if (value) {
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        handleEvent(buffer.slice(0, idx));
        buffer = buffer.slice(idx + 2);
      }
    }
    if (done) break;
  }
  if (buffer.trim()) handleEvent(buffer);

  if (streamError !== null) throw new Error(streamError);
  if (result === null) throw new Error('Stream ended without a result');
  return result;
}

export async function setPlaygroundRunBest(
  runId: string,
  columnId: string | null,
): Promise<string | null> {
  const res = await fetch(`/api/v1/playground/runs/${encodeURIComponent(runId)}/best`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ columnId }),
  });
  if (!res.ok) throw new Error('Failed to set best answer');
  const data = (await res.json()) as { bestColumnId: string | null };
  return data.bestColumnId;
}

export function listPlaygroundRuns(agentName: string): Promise<PlaygroundHistoryRunSummary[]> {
  return fetchJson<PlaygroundHistoryRunSummary[]>('/playground/runs', { agentName });
}

export function getPlaygroundRun(
  runId: string,
  agentName: string,
): Promise<PlaygroundHistoryRunDetail> {
  return fetchJson<PlaygroundHistoryRunDetail>(`/playground/runs/${encodeURIComponent(runId)}`, {
    agentName,
  });
}

export async function togglePlaygroundRunStar(runId: string): Promise<boolean> {
  const res = await fetch(`/api/v1/playground/runs/${encodeURIComponent(runId)}/star`, {
    method: 'PATCH',
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to toggle star');
  const data = (await res.json()) as { starred: boolean };
  return data.starred;
}
