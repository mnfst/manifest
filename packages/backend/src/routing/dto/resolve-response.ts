import { ScoringReason } from '../scorer';
import type { AuthType } from 'manifest-shared';
import type { Tier } from 'manifest-shared';

export type { AuthType } from 'manifest-shared';

export interface ResolveResponse {
  tier: Tier;
  model: string | null;
  provider: string | null;
  confidence: number;
  score: number;
  reason: ScoringReason;
  auth_type?: AuthType;
}
