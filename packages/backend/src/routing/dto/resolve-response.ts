import { Tier, ScoringReason } from '../../scoring';

export type AuthType = 'api_key' | 'subscription';

export interface ResolveResponse {
  tier: Tier;
  model: string | null;
  provider: string | null;
  confidence: number;
  score: number;
  reason: ScoringReason;
  auth_type?: AuthType;
}
