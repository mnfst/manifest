import { scrubSecrets } from '../../common/utils/secret-scrub';
import type { ProxyApiMode } from '../proxy/proxy-types';
import { normalizeProviderError } from './provider-error-normalizer';
import type { HealRequest } from './phoenix.types';

/**
 * 4xx codes that are never a defect in the request body: the caller is
 * unauthenticated, out of credit, forbidden, or throttled. Rewriting the request
 * cannot fix any of them, so reporting them to Phoenix would only pad its issue
 * base with noise. Mirrors the exclusion list Peacock's historical scrape uses
 * (`phoenix-ingestion-sql.ts`), so the live feed and the scrape agree on scope.
 */
const NON_REQUEST_SIDE = new Set([401, 402, 403, 429]);

/**
 * Cap on the serialized observation body. Phoenix stores request bodies
 * uncapped, and a single agent can forward a multi-megabyte prompt; an
 * observation is diagnostic evidence, not an archive, so oversized ones are
 * dropped rather than truncated (a half-body would fingerprint the same but
 * heal wrong).
 */
export const MAX_BODY_BYTES = 256 * 1024;

/** Whether a failed forward is a request-side 4xx worth reporting. */
export function isReportableStatus(status: number): boolean {
  return status >= 400 && status < 500 && !NON_REQUEST_SIDE.has(status);
}

/**
 * Keys whose value is a credential whatever its shape. {@link scrubSecrets} only
 * matches text, so a non-string value (a number, an object) under one of these
 * would survive it.
 */
const CREDENTIAL_KEYS = new Set([
  'x-api-key',
  'authorization',
  'api-key',
  'apikey',
  'refresh_token',
  'client_secret',
  'access_token',
  'device_code',
]);

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Recursively scrub credentials out of a body.
 *
 * Walk the values rather than the serialized JSON. Scrubbing the serialized form
 * would miss a secret nested inside message content — `{"authorization":"Basic …"}`
 * quoted inside a prompt serializes to `{\"authorization\":\"Basic …\"}`, whose
 * escaped quotes defeat the header pattern — and a replacement landing outside a
 * string literal would leave invalid JSON. Walking sidesteps both: every string
 * reaches {@link scrubSecrets} unescaped, and the structure is never touched.
 */
function scrubValue(value: unknown): unknown {
  if (typeof value === 'string') return scrubSecrets(value);
  if (Array.isArray(value)) return value.map(scrubValue);
  if (!isPlainRecord(value)) return value;
  const out: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    out[key] = CREDENTIAL_KEYS.has(key.toLowerCase()) ? '[REDACTED]' : scrubValue(nested);
  }
  return out;
}

/**
 * Strip credentials from a request body before it leaves this process, or return
 * null when the body is too large to ship. The body is the caller's, not ours,
 * and it can carry a key a user pasted into a prompt or a tool definition.
 */
export function scrubBody(body: Record<string, unknown>): Record<string, unknown> | null {
  if (Buffer.byteLength(JSON.stringify(body), 'utf8') > MAX_BODY_BYTES) return null;
  return scrubValue(body) as Record<string, unknown>;
}

export interface ObservationInput {
  /**
   * The `traceparent` trace id when the caller sent one. Phoenix keys its ledger
   * on `(issue, traceId)`, and Peacock's scrape reports the same
   * `agent_messages.trace_id`, so passing it through is what lets a live
   * observation and a later scrape of the same failure collapse into one row.
   */
  traceId: string;
  tenantId: string;
  provider: string;
  apiMode: ProxyApiMode;
  /**
   * The forwarded body, with inline base64 images already redacted
   * (`routingBody`). The heal path reports the raw body instead, because a patch
   * has to be applied to what the provider actually received; an observation is
   * only evidence, and no operation Phoenix can resolve looks at image bytes —
   * so the smaller, less sensitive body is the right one to ship.
   */
  requestBody: Record<string, unknown>;
  /**
   * The concrete provider model the request routed to. The body may name a
   * routing alias (`auto`) that Phoenix's model-keyed catalog can't resolve, so
   * the reported body carries the resolved id instead — same substitution the
   * heal path makes.
   */
  resolvedModel?: string;
  status: number;
  /** Raw text of the provider's error response. */
  errorBody: string;
  responseTimeMs?: number;
}

/**
 * Build the `/api/heal/observe` payload for one failed forward, or null when the
 * failure isn't request-side or the body can't be safely shipped.
 */
export function toObservation(input: ObservationInput): HealRequest | null {
  if (!isReportableStatus(input.status)) return null;
  const scrubbed = scrubBody(input.requestBody);
  if (!scrubbed) return null;

  const request =
    input.resolvedModel && input.resolvedModel !== scrubbed.model
      ? { ...scrubbed, model: input.resolvedModel }
      : scrubbed;

  return {
    traceId: input.traceId,
    tenantId: input.tenantId,
    provider: input.provider,
    api: input.apiMode,
    request,
    response: { statusCode: input.status, error: normalizeProviderError(input.errorBody) },
    ...(input.responseTimeMs != null ? { responseTimeMs: input.responseTimeMs } : {}),
  };
}
