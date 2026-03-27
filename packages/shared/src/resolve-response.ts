import type { Tier } from './tiers.js';
import type { AuthType } from './auth-types.js';

export interface ResolveResponse {
  tier: Tier;
  model: string | null;
  provider: string | null;
  confidence: number;
  score: number;
  reason: string;
  auth_type?: AuthType;
}
