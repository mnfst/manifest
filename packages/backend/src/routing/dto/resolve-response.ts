import { ScoringReason } from '../../scoring';
import type { ModelRoute, SpecificityCategory, TierSlot } from 'manifest-shared';

export type { AuthType } from 'manifest-shared';

export interface ResolveResponse {
  tier: TierSlot;
  confidence: number;
  score: number;
  reason: ScoringReason;
  /**
   * Resolved routing identity. Null when no model could be picked (no
   * provider connected, override invalidated, etc.). Replaces the legacy
   * flat `model` / `provider` / `auth_type` fields removed in this release;
   * read `route.model`, `route.provider`, `route.authType` instead.
   *
   * `route.keyLabel` carries the resolved provider-key label when the user
   * has configured multiple keys for the same (provider, authType). Null
   * when the priority-0 (primary) key is used.
   */
  route: ModelRoute | null;
  /**
   * Ordered fallback routes for the resolved tier. Null when none configured.
   * Replaces the legacy `fallback_models: string[]` field. Each entry's
   * `keyLabel` carries the pinned provider-key label, if any.
   */
  fallback_routes: ModelRoute[] | null;
  specificity_category?: SpecificityCategory;
  header_tier_id?: string;
  header_tier_name?: string;
  header_tier_color?: string;
}
