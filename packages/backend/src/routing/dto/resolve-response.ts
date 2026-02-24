import { Tier, ScoringReason } from '../scorer';

export interface ResolveResponse {
  tier: Tier;
  model: string | null;
  provider: string | null;
  confidence: number;
  score: number;
  reason: ScoringReason;
}
