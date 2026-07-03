import type { ProxyApiMode } from '../proxy/proxy-types';

/**
 * Wire contract for the Phoenix healing service (mnfst/phoenix). Mirrors the
 * MVP OpenAPI draft: POST /api/heal returns a discriminated heal decision, and
 * PATCH /api/heal-attempts/{healAttemptId} reports the post-retry outcome.
 * Keep these shapes in lockstep with Phoenix — the HttpHealingClient maps 1:1.
 */

/** Normalised provider error — the four fields Phoenix fingerprints on. */
export interface PhoenixProviderError {
  message: string;
  type?: string | null;
  param?: string | null;
  code?: string | null;
}

export interface PhoenixProviderResponse {
  statusCode: number;
  error: PhoenixProviderError;
}

/** POST /api/heal request body. `provider` + `api` are the fingerprint dims. */
export interface HealRequest {
  /**
   * Correlates every heal within one logical request's retry chain — Phoenix's
   * `traceId` (Manifest reuses the message-link group id). REQUIRED: Phoenix
   * rejects a heal request without it (`400`).
   */
  traceId: string;
  provider: string;
  api: ProxyApiMode;
  url?: string;
  request: Record<string, unknown>;
  response: PhoenixProviderResponse;
  responseTimeMs?: number;
  responseSizeBytes?: number;
}

export type PhoenixHealStatus = 'patched' | 'pending_confirmation' | 'resolving' | 'no_patch';

/** One deterministic edit from the Phoenix catalog (MVP #1: rename_param). */
export interface PhoenixOperation {
  type: string;
  from?: string;
  to?: string;
}

/** POST /api/heal response — discriminated on `status`. */
export interface HealResponse {
  status: PhoenixHealStatus;
  issueId: string;
  patchId?: string | null;
  /** Present when a patch was handed out; report its outcome via PATCH /api/heal-attempts/{healAttemptId}. */
  healAttemptId?: string | null;
  operations?: PhoenixOperation[] | null;
  healedBody?: Record<string, unknown> | null;
  retryAfterMs?: number | null;
}

/**
 * PATCH /api/heal-attempts/{healAttemptId} request body — what happened after we
 * applied the patch and retried. Phoenix (not us) decides succeeded/failed from
 * this. `error` is REQUIRED when `retryStatusCode >= 400`, omitted on 2xx.
 */
export interface HealOutcome {
  retryStatusCode: number;
  error?: PhoenixProviderError;
}

export type PhoenixIssueStatus =
  | 'resolving'
  | 'pending_confirmation'
  | 'confirmed'
  | 'rejected'
  | 'not_found';

/** PATCH /api/heal-attempts/{healAttemptId} response body. */
export interface ConfirmResponse {
  healAttemptId: string;
  status: 'succeeded' | 'failed';
  issueStatus: PhoenixIssueStatus;
}
