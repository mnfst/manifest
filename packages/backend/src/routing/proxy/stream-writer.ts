import { Response as ExpressResponse } from 'express';

export interface StreamUsage {
  prompt_tokens: number;
  completion_tokens: number;
  cache_read_tokens?: number;
  cache_creation_tokens?: number;
}

/** Extract usage data from an SSE-formatted text chunk (e.g. `data: {...}\n\n`). */
export function extractUsageFromSse(sseText: string): StreamUsage | null {
  for (const line of sseText.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) continue;
    const json = trimmed.slice(5).trim();
    if (json === '[DONE]') continue;
    try {
      const obj = JSON.parse(json);
      if (obj.usage && typeof obj.usage.prompt_tokens === 'number') {
        return {
          prompt_tokens: obj.usage.prompt_tokens,
          completion_tokens: obj.usage.completion_tokens ?? 0,
          cache_read_tokens: obj.usage.cache_read_tokens,
          cache_creation_tokens: obj.usage.cache_creation_tokens,
        };
      }
    } catch {
      /* ignore parse errors */
    }
  }
  return null;
}

export function initSseHeaders(
  res: ExpressResponse,
  extraHeaders: Record<string, string> = {},
): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  for (const [key, value] of Object.entries(extraHeaders)) {
    res.setHeader(key, value);
  }
  res.flushHeaders();
}

/**
 * Parses an SSE text stream into individual event payloads.
 * Handles `data: ` prefixes, multi-event chunks, and partial
 * chunks that split across TCP reads.
 */
export function parseSseEvents(buffer: string): { events: string[]; remaining: string } {
  const events: string[] = [];
  let remaining = buffer;

  // Split on double-newline (SSE event boundary)
  let idx: number;
  while ((idx = remaining.indexOf('\n\n')) !== -1) {
    const raw = remaining.slice(0, idx).trim();
    remaining = remaining.slice(idx + 2);

    if (!raw) continue;

    // Strip "data: " prefix from each line and join
    const payload = raw
      .split('\n')
      .map((line) => (line.startsWith('data: ') ? line.slice(6) : line))
      .join('\n')
      .trim();

    if (payload && payload !== '[DONE]') {
      events.push(payload);
    }
  }

  return { events, remaining };
}

const MAX_SSE_BUFFER_SIZE = 1_048_576;

export async function pipeStream(
  source: ReadableStream<Uint8Array>,
  dest: ExpressResponse,
  transform?: (chunk: string) => string | null,
): Promise<StreamUsage | null> {
  const reader = source.getReader();
  const decoder = new TextDecoder();
  let sseBuffer = '';
  let passthroughBuffer = '';
  let capturedUsage: StreamUsage | null = null;

  try {
    let done = false;
    while (!done) {
      if (dest.writableEnded) break;

      const result = await reader.read();
      done = result.done;

      if (result.value) {
        const text = decoder.decode(result.value, { stream: !done });

        if (transform) {
          sseBuffer += text;
          if (sseBuffer.length > MAX_SSE_BUFFER_SIZE) {
            throw new Error('SSE buffer overflow: provider sent data without event boundaries');
          }
          const { events, remaining } = parseSseEvents(sseBuffer);
          sseBuffer = remaining;

          for (const event of events) {
            const transformed = transform(event);
            if (transformed) {
              dest.write(transformed);
              const usage = extractUsageFromSse(transformed);
              if (usage) capturedUsage = usage;
            }
          }
        } else {
          dest.write(text);
          passthroughBuffer += text;
          if (passthroughBuffer.length > MAX_SSE_BUFFER_SIZE) {
            throw new Error('SSE buffer overflow: provider sent data without event boundaries');
          }
          const { events: ptEvents, remaining } = parseSseEvents(passthroughBuffer);
          passthroughBuffer = remaining;
          for (const ev of ptEvents) {
            try {
              const obj = JSON.parse(ev);
              if (obj.usage && typeof obj.usage.prompt_tokens === 'number') {
                capturedUsage = {
                  prompt_tokens: obj.usage.prompt_tokens,
                  completion_tokens: obj.usage.completion_tokens ?? 0,
                  cache_read_tokens: obj.usage.cache_read_tokens,
                  cache_creation_tokens: obj.usage.cache_creation_tokens,
                };
              }
            } catch {
              /* ignore non-JSON events */
            }
          }
        }
      }
    }

    // Flush any remaining buffer content through the transform
    if (transform && sseBuffer.trim()) {
      const payload = sseBuffer
        .split('\n')
        .map((line) => (line.startsWith('data: ') ? line.slice(6) : line))
        .join('\n')
        .trim();
      if (payload && payload !== '[DONE]') {
        const transformed = transform(payload);
        if (transformed) {
          dest.write(transformed);
          const usage = extractUsageFromSse(transformed);
          if (usage) capturedUsage = usage;
        }
      }
    }

    // Ensure the stream ends with [DONE] for OpenAI-compatible clients.
    // Non-transformed streams (OpenAI) already include it from the provider.
    // Transformed streams (Google) need it added explicitly.
    if (transform) {
      dest.write('data: [DONE]\n\n');
    }
  } finally {
    reader.releaseLock();
    if (!dest.writableEnded) dest.end();
  }

  return capturedUsage;
}
