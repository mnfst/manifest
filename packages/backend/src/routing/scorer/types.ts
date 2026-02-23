// ── Input types ──

export interface ScorerMessage {
  role: string;
  content?: unknown;
  [key: string]: unknown;
}

export interface ScorerTool {
  [key: string]: unknown;
}

export interface ScorerInput {
  messages: ScorerMessage[];
  tools?: ScorerTool[];
  tool_choice?: unknown;
  max_tokens?: number;
}

// ── Output types ──

export type Tier = 'simple' | 'standard' | 'complex' | 'reasoning';

export type ScoringReason =
  | 'scored'
  | 'formal_logic_override'
  | 'tool_detected'
  | 'large_context'
  | 'short_message'
  | 'momentum'
  | 'ambiguous';

export interface DimensionScore {
  name: string;
  rawScore: number;
  weight: number;
  weightedScore: number;
  matchedKeywords?: string[];
}

export interface MomentumInfo {
  historyLength: number;
  historyAvgScore: number;
  momentumWeight: number;
  applied: boolean;
}

export interface ScoringResult {
  tier: Tier;
  score: number;
  confidence: number;
  reason: ScoringReason;
  dimensions: DimensionScore[];
  momentum: MomentumInfo | null;
}

// ── Configuration types ──

export interface TierBoundaries {
  simpleMax: number;
  standardMax: number;
  complexMax: number;
}

export interface DimensionConfig {
  name: string;
  weight: number;
  keywords?: string[];
  direction: 'up' | 'down';
}

export interface ScorerConfig {
  dimensions: DimensionConfig[];
  boundaries: TierBoundaries;
  confidenceK: number;
  confidenceMidpoint: number;
  confidenceThreshold: number;
}
