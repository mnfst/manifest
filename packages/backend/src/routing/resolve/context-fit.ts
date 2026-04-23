/**
 * Pure helpers for picking the first tier candidate whose context window
 * can fit the incoming request. Kept separate from ResolveService so the
 * filter-and-escalate algorithm is independently testable without having
 * to stub the entire resolution pipeline.
 */

export interface FitCandidate {
  model: string;
  contextWindow: number;
}

/**
 * Default output budget reserved from the context window when the caller
 * didn't specify `max_tokens`. Enough for the typical assistant reply,
 * small enough that long-history requests still fit common 128K models.
 */
export const DEFAULT_RESERVED_OUTPUT_TOKENS = 4096;

/**
 * Returns the first candidate whose `contextWindow` is at least
 * `estimatedTokens + reservedOutput`. Preserves input order so the
 * caller's cost preference (primary first, then fallbacks) is respected.
 *
 * Returns `null` when no candidate fits — caller should escalate to the
 * next tier or surface a structured "context_window_exceeded" error.
 */
export function findFittingCandidate(
  candidates: readonly FitCandidate[],
  estimatedTokens: number,
  reservedOutput: number = DEFAULT_RESERVED_OUTPUT_TOKENS,
): FitCandidate | null {
  const required = estimatedTokens + reservedOutput;
  for (const candidate of candidates) {
    if (candidate.contextWindow >= required) return candidate;
  }
  return null;
}
