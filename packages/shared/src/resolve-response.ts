import type { Tier } from './tiers';
import type { AuthType } from './auth-types';
import type { SpecificityCategory } from './specificity';

export interface ResolveResponse {
  tier: Tier;
  model: string | null;
  provider: string | null;
  confidence: number;
  score: number;
  reason: string;
  auth_type?: AuthType;
  specificity_category?: SpecificityCategory;
}
