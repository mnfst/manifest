/**
 * Error taxonomy for `agent_messages`.
 *
 * Historically a single `status` column answered three unrelated questions at
 * once (was it a success? who failed? was it a superseded attempt?), so a
 * missing-API-key config error and a provider 500 landed in the same `error`
 * bucket, and a recovered fallback attempt (`fallback_error`) looked like an
 * outcome. This module splits those into orthogonal axes:
 *
 *  - `error_origin` — WHO caused the failure (provider / transport / config /
 *    policy / internal).
 *  - `error_class`  — WHAT kind of failure it was. A rate limit is a *class* of
 *    error here, not a top-level status.
 *  - `superseded`   — whether this row is a retried / fell-back-away-from attempt
 *    rather than the request's terminal outcome (the old `fallback_error`).
 *
 * `classifyMessageError` is the single source of truth: the proxy ingestion path
 * calls it for every recorded row, and the backfill migration's SQL `CASE`
 * mirrors it exactly. Keep the two in lock-step when editing.
 */

/**
 * Synthetic HTTP codes the proxy stamps on non-HTTP transport failures
 * (see packages/backend/src/routing/proxy/proxy-transport.ts). A provider that
 * genuinely returns 503/504 is bucketed as `transport` too — an unreachable or
 * timed-out upstream is a transport-level condition regardless of who emitted
 * the code.
 */
export const TRANSPORT_NETWORK_HTTP_STATUS = 503;
export const TRANSPORT_TIMEOUT_HTTP_STATUS = 504;

/** Non-ok terminal/attempt statuses the proxy writes to `agent_messages.status`. */
export const OK_STATUS = 'ok';
export const RATE_LIMITED_STATUS = 'rate_limited';
/** A row that failed but was recovered by a later attempt (retry / fallback). */
export const SUPERSEDED_STATUS = 'fallback_error';
/** The failed original of a healed Auto-fix flow — recovered by the retry row. */
export const AUTOFIX_ORIGINAL_STATUS = 'auto_fixed';
/** Every status whose row is a recovered (superseded) attempt, not a terminal failure. */
export const SUPERSEDED_STATUSES: readonly string[] = [SUPERSEDED_STATUS, AUTOFIX_ORIGINAL_STATUS];

export const ERROR_ORIGINS = ['provider', 'transport', 'config', 'policy', 'internal'] as const;
export type ErrorOrigin = (typeof ERROR_ORIGINS)[number];

/**
 * Origins that are NOT a provider round-trip: Manifest rejected or
 * short-circuited the request before (or without) reaching a provider. These
 * are returned to the caller as HTTP 200 friendly stubs, so they must never
 * count as a "message" nor as a provider-reliability event.
 */
export const MANIFEST_ERROR_ORIGINS = ['config', 'policy', 'internal'] as const;
export type ManifestErrorOrigin = (typeof MANIFEST_ERROR_ORIGINS)[number];

export const ERROR_CLASSES = [
  // provider (HTTP-derived)
  'rate_limit',
  'auth',
  'invalid_request',
  'not_found',
  'payload_too_large',
  'server_error',
  'client_error',
  // transport
  'timeout',
  'network',
  // manifest (config / policy / internal)
  'no_provider',
  'no_provider_key',
  'limit_exceeded',
  'internal',
] as const;
export type ErrorClass = (typeof ERROR_CLASSES)[number];

/**
 * Canned `routing_reason` values the proxy writes for Manifest-originated stubs
 * (see proxy-message-recorder.ts). Their presence is the definitive signal that
 * a row is Manifest's own error, not a provider's.
 */
const MANIFEST_REASON_TO_CLASSIFICATION: Record<
  string,
  { origin: ManifestErrorOrigin; errorClass: ErrorClass }
> = {
  no_provider: { origin: 'config', errorClass: 'no_provider' },
  no_provider_key: { origin: 'config', errorClass: 'no_provider_key' },
  limit_exceeded: { origin: 'policy', errorClass: 'limit_exceeded' },
  manifest_rate_limited: { origin: 'policy', errorClass: 'rate_limit' },
  friendly_error: { origin: 'internal', errorClass: 'internal' },
};

/** Map a provider's HTTP status code to a normalized error class. */
export function classifyHttpErrorClass(httpStatus: number): ErrorClass {
  if (httpStatus === 429) return 'rate_limit';
  if (httpStatus === 401 || httpStatus === 403) return 'auth';
  if (httpStatus === 404) return 'not_found';
  if (httpStatus === 413) return 'payload_too_large';
  if (httpStatus === 400 || httpStatus === 422) return 'invalid_request';
  if (httpStatus >= 500) return 'server_error';
  if (httpStatus >= 400) return 'client_error';
  // A sub-400 code recorded on an error row (e.g. a 200 body that carried an
  // error envelope) is a provider anomaly — never treat it as success.
  return 'server_error';
}

export interface MessageErrorSignals {
  /** `agent_messages.status`. */
  status: string;
  /** `agent_messages.error_http_status` (numeric provider/synthetic code, or null). */
  errorHttpStatus?: number | null;
  /** `agent_messages.routing_reason` — carries the canned Manifest reason for stubs. */
  routingReason?: string | null;
}

export interface MessageErrorClassification {
  error_origin: ErrorOrigin | null;
  error_class: ErrorClass | null;
  superseded: boolean;
}

/**
 * Derive the `{ error_origin, error_class, superseded }` triple for a message
 * row from the signals available both at ingestion time and in the backfill.
 *
 * Precedence: ok short-circuits → Manifest canned reason → 429 (provider rate
 * limit even when the numeric code was dropped) → synthetic transport codes →
 * any other numeric provider code → an errored row with no captured HTTP
 * response (the fetch failed before the provider replied ⇒ transport/network).
 */
export function classifyMessageError(signals: MessageErrorSignals): MessageErrorClassification {
  if (signals.status === OK_STATUS) {
    return { error_origin: null, error_class: null, superseded: false };
  }

  // `auto_fixed` (the failed original of a healed request) is a recovered attempt
  // just like `fallback_error`, so it's superseded too — otherwise it would count
  // as a live fault against the provider.
  const superseded = SUPERSEDED_STATUSES.includes(signals.status);

  const manifest = signals.routingReason
    ? MANIFEST_REASON_TO_CLASSIFICATION[signals.routingReason]
    : undefined;
  if (manifest) {
    return { error_origin: manifest.origin, error_class: manifest.errorClass, superseded };
  }

  if (signals.status === RATE_LIMITED_STATUS) {
    return { error_origin: 'provider', error_class: 'rate_limit', superseded };
  }

  const http = signals.errorHttpStatus ?? null;
  if (http === TRANSPORT_TIMEOUT_HTTP_STATUS) {
    return { error_origin: 'transport', error_class: 'timeout', superseded };
  }
  if (http === TRANSPORT_NETWORK_HTTP_STATUS) {
    return { error_origin: 'transport', error_class: 'network', superseded };
  }
  if (http != null) {
    return { error_origin: 'provider', error_class: classifyHttpErrorClass(http), superseded };
  }

  return { error_origin: 'transport', error_class: 'network', superseded };
}

/** True when an origin is Manifest's own (config/policy/internal), not a provider round-trip. */
export function isManifestErrorOrigin(
  origin: string | null | undefined,
): origin is ManifestErrorOrigin {
  return origin != null && (MANIFEST_ERROR_ORIGINS as readonly string[]).includes(origin);
}
