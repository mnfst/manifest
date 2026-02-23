import {
  ScorerInput,
  ScoringResult,
  ScorerConfig,
  DimensionScore,
  DimensionConfig,
  Tier,
  ScoringReason,
} from './types';
import { DEFAULT_CONFIG } from './config';
import { KeywordTrie, TrieMatch } from './keyword-trie';
import {
  extractUserTexts,
  countConversationMessages,
  combinedText,
  ExtractedText,
} from './text-extractor';
import {
  scoreKeywordDimension,
  scoreTokenCount,
  scoreNestedListDepth,
  scoreConditionalLogic,
  scoreCodeToProse,
  scoreConstraintDensity,
  scoreExpectedOutputLength,
  scoreRepetitionRequests,
  scoreToolCount,
  scoreConversationDepth,
} from './dimensions';
import { applyMomentum, MomentumInput } from './momentum';
import { computeConfidence, scoreToTier } from './sigmoid';

export type {
  ScorerInput,
  ScoringResult,
  ScorerConfig,
  DimensionScore,
  Tier,
  ScoringReason,
} from './types';
export type { MomentumInput } from './momentum';

let defaultTrie: KeywordTrie | null = null;

function getDefaultTrie(): KeywordTrie {
  if (!defaultTrie) {
    defaultTrie = buildTrie(DEFAULT_CONFIG);
  }
  return defaultTrie;
}

function buildTrie(config: ScorerConfig): KeywordTrie {
  const dims = config.dimensions
    .filter((d) => d.keywords && d.keywords.length > 0)
    .map((d) => ({ name: d.name, keywords: d.keywords! }));
  return new KeywordTrie(dims);
}

function mergeConfig(partial?: Partial<ScorerConfig>): ScorerConfig {
  if (!partial) return DEFAULT_CONFIG;
  return { ...DEFAULT_CONFIG, ...partial };
}

const TIER_ORDER: Record<Tier, number> = {
  simple: 0,
  standard: 1,
  complex: 2,
  reasoning: 3,
};

function maxTier(a: Tier, b: Tier): Tier {
  return TIER_ORDER[a] >= TIER_ORDER[b] ? a : b;
}

function estimateTotalTokens(messages: ScorerInput['messages']): number {
  let chars = 0;
  for (const msg of messages) {
    if (msg.content === null || msg.content === undefined) continue;
    if (typeof msg.content === 'string') {
      chars += msg.content.length;
    } else if (Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (
          block &&
          typeof block === 'object' &&
          'text' in block &&
          typeof (block as Record<string, unknown>).text === 'string'
        ) {
          chars += ((block as Record<string, unknown>).text as string).length;
        }
      }
    } else {
      chars += String(msg.content).length;
    }
  }
  return chars / 4;
}

function emptyDimensions(config: ScorerConfig): DimensionScore[] {
  return config.dimensions.map((d) => ({
    name: d.name,
    rawScore: 0,
    weight: d.weight,
    weightedScore: 0,
    ...(d.keywords ? { matchedKeywords: [] } : {}),
  }));
}

function checkFormalLogicOverride(
  config: ScorerConfig,
  lastUserText: string,
): boolean {
  const formalDim = config.dimensions.find(
    (d) => d.name === 'formalLogic',
  );
  if (!formalDim?.keywords || lastUserText.length === 0) return false;

  const lastTextLower = lastUserText.toLowerCase();
  let formalCount = 0;
  for (const kw of formalDim.keywords) {
    if (lastTextLower.includes(kw.toLowerCase())) formalCount++;
  }
  return formalCount >= 2;
}

interface StructuralDimContext {
  combined: string;
  maxTokens?: number;
  tools?: ScorerInput['tools'];
  toolChoice?: unknown;
  conversationCount: number;
}

function scoreStructuralDimension(
  dim: DimensionConfig,
  ctx: StructuralDimContext,
): number {
  switch (dim.name) {
    case 'tokenCount':
      return scoreTokenCount(ctx.combined);
    case 'nestedListDepth':
      return scoreNestedListDepth(ctx.combined);
    case 'conditionalLogic':
      return scoreConditionalLogic(ctx.combined);
    case 'codeToProse':
      return scoreCodeToProse(ctx.combined);
    case 'constraintDensity':
      return scoreConstraintDensity(ctx.combined);
    case 'expectedOutputLength':
      return scoreExpectedOutputLength(ctx.combined, ctx.maxTokens);
    case 'repetitionRequests':
      return scoreRepetitionRequests(ctx.combined);
    case 'toolCount':
      return scoreToolCount(ctx.tools, ctx.toolChoice);
    case 'conversationDepth':
      return scoreConversationDepth(ctx.conversationCount);
    default:
      return 0;
  }
}

function scoreDimensions(
  config: ScorerConfig,
  allMatches: TrieMatch[],
  extracted: ExtractedText[],
  ctx: StructuralDimContext,
): { dimensions: DimensionScore[]; rawScore: number } {
  const dimensions: DimensionScore[] = [];
  let rawScore = 0;

  for (const dim of config.dimensions) {
    let dimRawScore: number;
    let matchedKeywords: string[] | undefined;

    if (dim.keywords && dim.keywords.length > 0) {
      const result = scoreKeywordDimension(
        dim.name, allMatches, extracted, dim.direction,
      );
      dimRawScore = result.rawScore;
      matchedKeywords = result.matchedKeywords;
    } else {
      dimRawScore = scoreStructuralDimension(dim, ctx);
    }

    const weightedScore = dimRawScore * dim.weight;
    rawScore += weightedScore;

    const entry: DimensionScore = {
      name: dim.name,
      rawScore: dimRawScore,
      weight: dim.weight,
      weightedScore,
    };
    if (matchedKeywords !== undefined) {
      entry.matchedKeywords = matchedKeywords;
    }
    dimensions.push(entry);
  }

  return { dimensions, rawScore };
}

export function scoreRequest(
  input: ScorerInput,
  configOverride?: Partial<ScorerConfig>,
  momentum?: MomentumInput,
): ScoringResult {
  const config = mergeConfig(configOverride);
  const { messages, tools, tool_choice, max_tokens } = input;

  if (!messages || messages.length === 0) {
    return {
      tier: 'standard', score: 0, confidence: 0.4,
      reason: 'ambiguous', dimensions: emptyDimensions(config), momentum: null,
    };
  }

  const extracted = extractUserTexts(messages);
  const combined = combinedText(extracted);
  const lastUserText = extracted.length > 0
    ? extracted[extracted.length - 1].text
    : '';

  const trie = configOverride ? buildTrie(config) : getDefaultTrie();

  if (checkFormalLogicOverride(config, lastUserText)) {
    return {
      tier: 'reasoning', score: 0.5, confidence: 0.95,
      reason: 'formal_logic_override', dimensions: emptyDimensions(config), momentum: null,
    };
  }

  const hasTools = tools && tools.length > 0;
  const hasMomentum = momentum?.recentTiers && momentum.recentTiers.length > 0;
  if (lastUserText.length > 0 && lastUserText.length < 30 && !hasTools && !hasMomentum) {
    return {
      tier: 'simple', score: -0.3, confidence: 0.9,
      reason: 'short_message', dimensions: emptyDimensions(config), momentum: null,
    };
  }

  const allMatches = combined.length > 0 ? trie.scan(combined) : [];
  const conversationCount = countConversationMessages(messages);
  const ctx: StructuralDimContext = {
    combined, maxTokens: max_tokens, tools, toolChoice: tool_choice, conversationCount,
  };
  const { dimensions, rawScore } = scoreDimensions(config, allMatches, extracted, ctx);

  const momentumResult = applyMomentum(rawScore, lastUserText.length, momentum);
  let { tier, reason } = applyTierFloors(
    momentumResult.effectiveScore, config, hasTools, tool_choice, messages, momentumResult.info.applied,
  );

  const confidence = computeConfidence(momentumResult.effectiveScore, config.boundaries, config.confidenceK);
  if (confidence < config.confidenceThreshold && reason === 'scored') {
    tier = 'standard';
    reason = 'ambiguous';
  }

  return {
    tier, score: momentumResult.effectiveScore, confidence, reason, dimensions,
    momentum: momentum ? momentumResult.info : null,
  };
}

function applyTierFloors(
  effectiveScore: number,
  config: ScorerConfig,
  hasTools: boolean | undefined,
  toolChoice: unknown,
  messages: ScorerInput['messages'],
  momentumApplied: boolean,
): { tier: Tier; reason: ScoringReason } {
  let tier = scoreToTier(effectiveScore, config.boundaries);
  let reason: ScoringReason = 'scored';

  if (hasTools && toolChoice !== 'none') {
    const floored = maxTier(tier, 'standard');
    if (floored !== tier) { tier = floored; reason = 'tool_detected'; }
  }

  if (estimateTotalTokens(messages) > 50_000) {
    const floored = maxTier(tier, 'complex');
    if (floored !== tier) { tier = floored; reason = 'large_context'; }
  }

  if (momentumApplied) reason = 'momentum';
  return { tier, reason };
}

export function getDefaultConfig(): ScorerConfig {
  return { ...DEFAULT_CONFIG };
}
