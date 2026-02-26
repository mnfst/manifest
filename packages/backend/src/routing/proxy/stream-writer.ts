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

export async function pipeStream(
  source: ReadableStream<Uint8Array>,
  dest: ExpressResponse,
): Promise<void> {
  const reader = source.getReader();
  const decoder = new TextDecoder();

  try {
    let done = false;
    while (!done) {
      const result = await reader.read();
      done = result.done;

      if (result.value) {
        const text = decoder.decode(result.value, { stream: !done });
        dest.write(text);
      }
    }
  } finally {
    reader.releaseLock();
    if (!dest.writableEnded) dest.end();
  }
}
