import { ScorerTool } from '../types';

const LENGTH_SIGNALS = [
  'comprehensive',
  'detailed',
  'thorough',
  'exhaustive',
  'in-depth',
  'full report',
  'complete guide',
  'write a full',
  'cover all',
];

export function scoreExpectedOutputLength(
  text: string,
  maxTokens?: number,
): number {
  const lower = text.toLowerCase();
  let signalCount = 0;

  for (const signal of LENGTH_SIGNALS) {
    if (lower.includes(signal)) signalCount++;
  }

  let score = 0;
  if (signalCount === 1) score = 0.3;
  else if (signalCount >= 2) score = 0.6;

  if (maxTokens !== undefined) {
    if (maxTokens > 8000) score += 0.3;
    else if (maxTokens > 4000) score += 0.2;
  }

  return Math.min(0.9, score);
}

const REPETITION_PATTERN =
  /(\d+)\s*(variations?|options?|alternatives?|versions?|examples?|ways?\s+to|times)/i;

export function scoreRepetitionRequests(text: string): number {
  const match = text.match(REPETITION_PATTERN);
  if (!match) return 0;

  const n = parseInt(match[1], 10);
  if (n <= 1) return 0;
  if (n <= 3) return 0.3;
  if (n <= 9) return 0.6;
  return 0.9;
}

export function scoreToolCount(
  tools?: ScorerTool[],
  toolChoice?: unknown,
): number {
  if (toolChoice === 'none') return 0;

  const count = tools?.length ?? 0;
  if (count === 0) return 0;

  let score: number;
  if (count <= 2) score = 0.1;
  else if (count <= 5) score = 0.3;
  else if (count <= 10) score = 0.6;
  else score = 0.9;

  const isSpecificChoice =
    (toolChoice !== null &&
      toolChoice !== undefined &&
      typeof toolChoice === 'object') ||
    toolChoice === 'any' ||
    toolChoice === 'required';

  if (isSpecificChoice) score += 0.2;

  return Math.min(0.9, score);
}

export function scoreConversationDepth(messageCount: number): number {
  if (messageCount <= 2) return 0;
  if (messageCount <= 5) return 0.1;
  if (messageCount <= 10) return 0.3;
  if (messageCount <= 20) return 0.5;
  return 0.7;
}
