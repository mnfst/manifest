import { Response as ExpressResponse } from 'express';

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
export function parseSseEvents(
  buffer: string,
): { events: string[]; remaining: string } {
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

export async function pipeStream(
  source: ReadableStream<Uint8Array>,
  dest: ExpressResponse,
  transform?: (chunk: string) => string | null,
): Promise<void> {
  const reader = source.getReader();
  const decoder = new TextDecoder();
  let sseBuffer = '';

  try {
    let done = false;
    while (!done) {
      const result = await reader.read();
      done = result.done;

      if (result.value) {
        const text = decoder.decode(result.value, { stream: !done });

        if (transform) {
          sseBuffer += text;
          const { events, remaining } = parseSseEvents(sseBuffer);
          sseBuffer = remaining;

          for (const event of events) {
            const transformed = transform(event);
            if (transformed) dest.write(transformed);
          }
        } else {
          dest.write(text);
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
        if (transformed) dest.write(transformed);
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
}
