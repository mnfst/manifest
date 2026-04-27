import { ScoringReason } from '../../scoring';
import type { AuthType, SpecificityCategory, TierSlot } from 'manifest-shared';

export type { AuthType } from 'manifest-shared';

export interface ResolveResponse {
  tier: TierSlot;
  model: string | null;
  provider: string | null;
  confidence: number;
  score: number;
  reason: ScoringReason;
  auth_type?: AuthType;
  /**
   * Optional label of a specific provider key to use when more than one key
   * is configured for (provider, auth_type). Mirrors `override_provider` in
   * being a loose string reference — if the labeled key is gone, the proxy
   * falls back to the priority-0 (primary) key.
   */
  provider_key_label?: string;
  specificity_category?: SpecificityCategory;
  fallback_models?: string[] | null;
  header_tier_id?: string;
  header_tier_name?: string;
  header_tier_color?: string;
}
