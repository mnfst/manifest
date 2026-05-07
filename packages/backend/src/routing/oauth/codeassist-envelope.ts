/**
 * Pure helpers for the CodeAssist (cloudcode-pa.googleapis.com) request /
 * response envelope. Kept as plain functions (not methods on
 * CodeAssistClientService) so the proxy hot path imports them without
 * pulling NestJS DI plumbing into the request lifecycle.
 *
 * Wrap shape:  `{ model, project, request: <standard-Gemini-payload> }`
 * Unwrap:      `{ response: <standard-Gemini-payload>, traceId? }` → inner
 */

/** Unwrap a non-streaming CodeAssist response. Falls through to the body
 *  unchanged if the wrapper is missing — defensive against upstream
 *  changes that could otherwise hard-fail every request. */
export function unwrapCodeAssistResponse(body: Record<string, unknown>): Record<string, unknown> {
  const inner = body.response;
  return inner && typeof inner === 'object' ? (inner as Record<string, unknown>) : body;
}

/** Unwrap one SSE chunk. Each `data: {...}` line is rewritten so the
 *  inner Gemini-shape JSON sits directly under `data:`, matching what
 *  `convertGoogleStreamChunk` expects. Non-`data:` lines pass through
 *  unchanged. */
export function unwrapCodeAssistStreamChunk(chunk: string): string {
  return chunk
    .split('\n')
    .map((line) => {
      if (!line.startsWith('data:')) return line;
      const payload = line.slice('data:'.length).trimStart();
      if (!payload || payload === '[DONE]') return line;
      try {
        const parsed = JSON.parse(payload) as Record<string, unknown>;
        const inner = parsed.response;
        if (inner && typeof inner === 'object') {
          return `data: ${JSON.stringify(inner)}`;
        }
        return line;
      } catch {
        return line;
      }
    })
    .join('\n');
}
