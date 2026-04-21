import { Tier, ScoringReason } from '../../scoring';
import type { AuthType, SpecificityCategory } from 'manifest-shared';

export type { AuthType } from 'manifest-shared';

export interface ResolveResponse {
  tier: Tier;
  model: string | null;
  provider: string | null;
  confidence: number;
  score: number;
  reason: ScoringReason;
  auth_type?: AuthType;
  specificity_category?: SpecificityCategory;
  fallback_models?: string[] | null;
  header_tier_id?: string;
  header_tier_name?: string;
  header_tier_color?: string;
}
