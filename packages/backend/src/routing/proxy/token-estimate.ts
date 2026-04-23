/**
 * Token estimation for routing decisions.
 *
 * Used by the pre-call size check in ResolveService to skip tier models
 * whose context window can't fit the incoming request. Accuracy matters
 * less than direction: under-counting means overflow, over-counting means
 * an unnecessary escalation to a larger model. We bias toward the latter
 * via a safety multiplier because a few cents > a failed request.
 *
 * We use js-tiktoken's `cl100k_base` encoder as a universal estimator.
 * It isn't perfect for Claude/Gemini/Qwen (each provider has its own BPE)
 * but it's consistently better than char-based heuristics on code- and
 * JSON-heavy payloads, which is where OpenClaw / Hermes / tool-use
 * requests live. Per-model tokenizers are a future upgrade if we see
 * wrong routing decisions in the field.
 */

import { getEncoding, type Tiktoken } from 'js-tiktoken';

/**
 * Safety margin on the estimate. A 1.2× multiplier means we treat a
 * 100K-estimated request as 120K when deciding fit. Picked deliberately:
 * - cl100k_base under-counts Chinese / Japanese by ~15% in published
 *   benchmarks — anything below 1.15 would let those requests slip past
 *   the fit check and overflow the routed model.
 * - JSON-heavy tool definitions vary ±10% between encoders.
 * Rounded up to 1.2 so a single buffer covers both the CJK worst-case
 * and a little headroom for provider-specific tokenizer differences.
 * The cost of an unnecessary escalation is a few cents; the cost of an
 * overflow is a failed request.
 */
export const TOKEN_ESTIMATE_SAFETY_MULTIPLIER = 1.2;

let encoderSingleton: Tiktoken | null = null;

function getEncoder(): Tiktoken {
  if (!encoderSingleton) {
    encoderSingleton = getEncoding('cl100k_base');
  }
  return encoderSingleton;
}

/**
 * Estimate the token count of a chat-completions request payload.
 *
 * The estimator is intentionally simple: we serialize both messages and
 * tool definitions to JSON and tokenize the concatenation. This slightly
 * over-counts (JSON quotes/braces add tokens that don't exist in the
 * provider's internal representation) which is fine — see the safety
 * multiplier above.
 *
 * Empty input returns 0, not `NaN` or a minimum floor — callers rely on
 * this to skip the size check for heartbeats.
 */
export function estimateTokens(messages: unknown, tools?: unknown): number {
  const messagesPart = messages ? JSON.stringify(messages) : '';
  const toolsPart = tools ? JSON.stringify(tools) : '';
  if (!messagesPart && !toolsPart) return 0;

  const encoder = getEncoder();
  const raw = encoder.encode(messagesPart + toolsPart).length;
  return Math.ceil(raw * TOKEN_ESTIMATE_SAFETY_MULTIPLIER);
}
