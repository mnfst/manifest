import type { ProxyApiMode } from '../proxy/proxy-types';

/**
 * Wire contract for the Phoenix healing service (mnfst/phoenix). Mirrors
 * Phoenix's `phoenix-openapi.yaml` (the source of truth): POST /api/heal returns
 * a discriminated heal decision, and PATCH /api/heal-attempts/{healAttemptId}
 * reports the post-retry outcome. Keep these shapes in lockstep with Phoenix —
 * the HttpHealingClient maps 1:1.
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

/**
 * Heal decision from `POST /api/heal`. Both `patched` (the issue is already
 * verified) and `unverified` (a freshly served patch, not yet confirmed) carry a
 * `healedBody` + `healAttemptId` to resend — the client keys off their presence,
 * not an allow-list, so a future patch-bearing status still applies. `resolving`
 * means Phoenix is still authoring a fix (nothing to resend); `no_patch` is terminal.
 */
export type PhoenixHealStatus = 'patched' | 'unverified' | 'resolving' | 'no_patch';

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
  | 'unverified'
  | 'verified'
  | 'ineffective'
  | 'no_fix_found';

/** PATCH /api/heal-attempts/{healAttemptId} response body. */
export interface ConfirmResponse {
  healAttemptId: string;
  /** `expired` when the attempt was swept (no outcome reported in time) before this call. */
  status: 'succeeded' | 'failed' | 'expired';
  issueStatus: PhoenixIssueStatus;
}
