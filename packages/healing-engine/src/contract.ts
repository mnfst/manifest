import type { Operation } from './operation';

/** Bump when the catalog changes. Surfaced on `/heal` responses for telemetry. */
export const CATALOG_VERSION = 1;

/** A message reduced to its shape: role + size. Never content. */
export interface StructuralMessage {
  role: string;
  bytes: number;
}

/** Normalised provider error extracted from a non-2xx provider response. */
export interface ProviderErrorShape {
  statusCode: number;
  type?: string | null;
  code?: string | null;
  param?: string | null;
  message: string;
}

/** Content-free view of the failed request sent to the Healing service. */
export interface StructuralRequest {
  provider: string;
  model: string;
  params: Record<string, unknown>;
  tools?: Array<Record<string, unknown>>;
  messages: StructuralMessage[];
}

/** Body of `POST /heal`. */
export interface HealRequest {
  requestId: string;
  tenantId: string;
  agentId?: string | null;
  request: StructuralRequest;
  error: ProviderErrorShape;
  maxWaitMs?: number;
}

/** Response from `POST /heal`. */
export type HealResponse =
  | {
      outcome: 'patch';
      catalogVersion: number;
      patchRef: string;
      issueRef: string;
      operations: Operation[];
      riskClass: 'auto_safe' | 'semantic';
      matchConditions?: Record<string, unknown>;
    }
  | { outcome: 'pending'; issueRef: string; retryAfterMs: number }
  | { outcome: 'unpatchable'; issueRef: string | null; reason: string };

/** Body of `POST /heal/outcome`. */
export interface HealOutcomeReport {
  requestId: string;
  patchRef: string;
  issueRef: string;
  tenantId: string;
  agentId?: string | null;
  outcome: 'healed' | 'failed';
  mode: 'post_error' | 'preflight';
  attempt?: number;
  latencyMs?: number;
}
