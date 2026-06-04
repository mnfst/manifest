import type { Request, Response } from 'express';
import compression from 'compression';

/**
 * Returns the raw `Content-Type` header as a lowercased string, or `''` when
 * the header is unset. `res.getHeader` can return `string | number | string[]`;
 * we normalise so the SSE check below is a simple prefix test.
 */
function contentTypeOf(res: Response): string {
  const raw = res.getHeader('Content-Type');
  if (Array.isArray(raw)) return (raw[0] ?? '').toLowerCase();
  return String(raw ?? '').toLowerCase();
}

/**
 * Decide whether a response should be compressed.
 *
 * Server-Sent Events (`text/event-stream`) must NEVER be gzip-buffered: the
 * compressor holds bytes until its buffer fills, which delays every token and
 * destroys time-to-first-token for streaming LLM responses. `initSseHeaders`
 * in `stream-writer.ts` sets `Content-Type: text/event-stream` (and flushes
 * headers) before the first body write, so this filter reliably sees it at the
 * moment `compression` consults the filter on the first `res.write`.
 *
 * Everything else falls through to the package default
 * (`compression.filter`), which uses the `compressible` module to decide based
 * on the content type.
 *
 * The default filter is injected (defaulting to `compression.filter`) purely so
 * unit tests can assert delegation without standing up the whole middleware.
 */
export function shouldCompress(
  req: Request,
  res: Response,
  defaultFilter: (req: Request, res: Response) => boolean = compression.filter,
): boolean {
  if (contentTypeOf(res).startsWith('text/event-stream')) {
    return false;
  }
  return defaultFilter(req, res);
}
