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
 * Strip credentials from a request body before it leaves this process.
 *
 * The body is the caller's, not ours, and it can carry a key a user pasted into
 * a prompt or a tool definition. {@link scrubSecrets} works on text, so the body
 * is scrubbed as serialized JSON and re-parsed. Every replacement it makes stays
 * inside a JSON string literal, so the result is still valid JSON — but if a
 * future pattern ever breaks that invariant, we drop the observation rather than
 * ship an unscrubbed body.
 */
export function scrubBody(body: Record<string, unknown>): Record<string, unknown> | null {
  const serialized = JSON.stringify(body);
  if (Buffer.byteLength(serialized, 'utf8') > MAX_BODY_BYTES) return null;
  try {
    return JSON.parse(scrubSecrets(serialized)) as Record<string, unknown>;
  } catch {
    return null;
  }
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
