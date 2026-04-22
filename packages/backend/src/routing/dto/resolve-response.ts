import { Tier, ScoringReason } from '../../scoring';
import type { AuthType, SpecificityCategory } from 'manifest-shared';

export type { AuthType } from 'manifest-shared';

/**
 * Reason literals produced by the size-awareness layer (Phase 2). Kept
 * distinct from `ScoringReason` because these are *routing* outcomes — the
 * scorer itself never produces them. Any new size-related reason added by
 * Phase 3+ should live here rather than polluting the scoring vocabulary.
 */
export const REASON_SIZE_ESCALATED = 'size_escalated';
export const REASON_CONTEXT_WINDOW_EXCEEDED = 'context_window_exceeded';

export type SizeAwareReason = typeof REASON_SIZE_ESCALATED | typeof REASON_CONTEXT_WINDOW_EXCEEDED;

/** Superset of reasons the resolver can surface — scoring + size-awareness. */
export type ResolveReason = ScoringReason | SizeAwareReason;

export interface ResolveResponse {
  tier: Tier;
  model: string | null;
  provider: string | null;
  confidence: number;
  score: number;
  reason: ResolveReason;
  auth_type?: AuthType;
  specificity_category?: SpecificityCategory;
  fallback_models?: string[] | null;
  /** Estimated token count of the incoming request (undefined when size-unaware). */
  estimated_tokens?: number;
  /**
   * Output budget reserved when computing the fit: `body.max_tokens` or
   * the default output reserve. Populated on size-aware resolutions so the
   * proxy can produce an honest error message when the blocker is the
   * `max_tokens` parameter rather than the input size.
   */
  reserved_output_tokens?: number;
  /** Context window of the chosen model. Populated for size-aware resolutions. */
  used_context_window?: number;
  /**
   * Present when the size check escalated the request out of its
   * scored tier (e.g. `complex → reasoning`). Lets the proxy surface this
   * to clients via a response header and log it for later analysis.
   */
  size_escalated_from?: Tier;
  /**
   * Largest context window available on any candidate we could have
   * routed to. Populated only for `REASON_CONTEXT_WINDOW_EXCEEDED` so the
   * error body can tell the user by how much they overshot.
   */
  largest_available_context?: number;
}
