/**
 * Pure helper functions for classifying and formatting transport-level
 * errors that occur when forwarding requests to upstream LLM providers.
 *
 * These cover network failures, DNS resolution errors, timeouts, and
 * similar non-HTTP errors that the `fetch()` call can throw.
 */

export const PROVIDER_TRANSPORT_ERROR_STATUS = 503;
export const PROVIDER_TIMEOUT_STATUS = 504;

const GENERIC_FETCH_ERROR_MESSAGE = 'fetch failed';

const TRANSPORT_PATTERN =
  /(fetch failed|failed to parse url|network|timeout|econnrefused|econnreset|enotfound|ehostunreach|etimedout|und_err_)/i;

// Narrow subset of transport failures that are SAFE to retry once on a fresh
// connection: a reused keep-alive socket the peer had already closed, so the
// request never reached the upstream (no response byte was produced) and a
// retry cannot double-submit. Deliberately excludes timeouts (upstream was
// reached, may be mid-process), connection-refused / DNS failures (provider
// down — let the fallback chain handle it), and the generic "fetch failed"
// wrapper (root cause unknown).
const RETRIABLE_CONNECTION_PATTERN =
  /(econnreset|und_err_socket|socket hang up|other side closed|connection reset)/i;

// ---------------------------------------------------------------------------
// Error property accessors
// ---------------------------------------------------------------------------

export function getErrorName(error: unknown): string | undefined {
  if (!(error instanceof Error)) return undefined;
  return error.name;
}

export function getErrorMessage(error: unknown): string | undefined {
  if (error instanceof Error) return error.message;
  if (!error || typeof error !== 'object') return undefined;
  const message = (error as { message?: unknown }).message;
  return typeof message === 'string' ? message : undefined;
}

export function getErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

export function getErrorCause(error: unknown): unknown {
  if (!(error instanceof Error)) return undefined;
  return error.cause;
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

export function isTransportError(error: unknown): boolean {
  const name = getErrorName(error);
  if (name === 'AbortError' || name === 'TimeoutError') return true;

  const detail = [
    getErrorMessage(error),
    getErrorMessage(getErrorCause(error)),
    getErrorCode(error),
    getErrorCode(getErrorCause(error)),
  ]
    .filter((value): value is string => Boolean(value))
    .join(' ');

  return TRANSPORT_PATTERN.test(detail);
}

export function isTimeoutError(error: unknown): boolean {
  return getErrorName(error) === 'TimeoutError';
}

/**
 * True for connection-level failures that are safe to retry once on a fresh
 * socket (the dead reused keep-alive socket case). Returns false for timeouts
 * and any non-connection transport error. Always a strict subset of
 * {@link isTransportError}.
 */
export function isRetriableConnectionError(error: unknown): boolean {
  if (isTimeoutError(error)) return false;
  const detail = [
    getErrorMessage(error),
    getErrorMessage(getErrorCause(error)),
    getErrorCode(error),
    getErrorCode(getErrorCause(error)),
  ]
    .filter((value): value is string => Boolean(value))
    .join(' ');
  return RETRIABLE_CONNECTION_PATTERN.test(detail);
}

// ---------------------------------------------------------------------------
// Detail extraction & sanitization
// ---------------------------------------------------------------------------

export function sanitizeTransportErrorDetail(detail: string): string {
  return detail.replace(/key=[^&\s]+/gi, 'key=***').slice(0, 500);
}

export function selectTransportErrorDetail(error: unknown): string | undefined {
  const message = getErrorMessage(error);
  const code = getErrorCode(error);

  if (message && message.toLowerCase() !== GENERIC_FETCH_ERROR_MESSAGE) {
    return sanitizeTransportErrorDetail(message);
  }
  if (code) return code;
  return undefined;
}

// ---------------------------------------------------------------------------
// Response builders
// ---------------------------------------------------------------------------

export function describeTransportError(error: unknown): string {
  if (isTimeoutError(error)) {
    return 'Upstream provider request timed out';
  }

  const detail =
    selectTransportErrorDetail(error) ?? selectTransportErrorDetail(getErrorCause(error));

  if (!detail) return 'Failed to reach upstream provider';
  return `Failed to reach upstream provider: ${detail}`;
}

export function buildTransportErrorResponse(error: unknown): Response {
  const status = isTimeoutError(error) ? PROVIDER_TIMEOUT_STATUS : PROVIDER_TRANSPORT_ERROR_STATUS;
  const message = describeTransportError(error);

  return new Response(JSON.stringify({ error: { message } }), {
    status,
    statusText: status === PROVIDER_TIMEOUT_STATUS ? 'Gateway Timeout' : 'Service Unavailable',
    headers: { 'content-type': 'application/json' },
  });
}
