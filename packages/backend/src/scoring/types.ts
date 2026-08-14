// ── Input types ──

export interface ScorerMessage {
  role: string;
  content?: unknown;
  [key: string]: unknown;
}

export interface ScorerTool {
  [key: string]: unknown;
}

/**
 * Extract a tool's name across the two shapes agents send: a top-level `name`
 * (Anthropic-style) or a nested `function.name` (OpenAI-style). Returns null
 * when neither is present.
 */
export function extractToolName(tool: ScorerTool): string | null {
  if (typeof tool.name === 'string') return tool.name;
  const fn = tool.function as { name?: string } | undefined;
  if (fn && typeof fn.name === 'string') return fn.name;
  return null;
}

export interface ScorerInput {
  messages: ScorerMessage[];
  tools?: ScorerTool[];
  tool_choice?: unknown;
  max_tokens?: number;
}

// ── Output types ──

import type { Tier as _Tier } from 'manifest-shared';
export { TIERS } from 'manifest-shared';
export type { Tier } from 'manifest-shared';
type Tier = _Tier;

export type ScoringReason =
  | 'scored'
  | 'formal_logic_override'
  | 'tool_detected'
  | 'large_context'
  | 'short_message'
  | 'momentum'
  | 'ambiguous'
  | 'heartbeat'
  | 'specificity'
  | 'default'
  | 'header-match';

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
