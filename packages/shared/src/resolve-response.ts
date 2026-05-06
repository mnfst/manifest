import type { Tier } from './tiers';
import type { ModelRoute } from './model-route';
import type { RequestParamDefaults } from './request-params';
import type { SpecificityCategory } from './specificity';

export interface ResolveResponse {
  tier: Tier;
  confidence: number;
  score: number;
  reason: string;
  /**
   * Resolved routing identity. Null when no model could be picked.
   * Read `route.model`, `route.provider`, `route.authType` for the resolved
   * model/provider/auth (the previous flat fields were dropped when the
   * dual-write soak ended).
   */
  route: ModelRoute | null;
  /** Ordered fallback routes for the resolved tier. */
  fallback_routes: ModelRoute[] | null;
  specificity_category?: SpecificityCategory;
  /**
   * Configured per-assignment request body defaults. Merged into the
   * outbound provider request before forwarding; client-supplied fields in
   * the request body take precedence by presence.
   */
  param_defaults?: RequestParamDefaults | null;
}
