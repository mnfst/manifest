import type { Tier } from './tiers';
import type { ModelRoute } from './model-route';
import type { ResponseMode } from './response-mode';
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
  /** Effective transport policy configured on the resolved routing chain. */
  response_mode?: ResponseMode;
  specificity_category?: SpecificityCategory;
}
