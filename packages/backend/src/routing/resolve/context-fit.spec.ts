/**
 * The whole purpose of this helper is to keep the filter-and-escalate
 * rules out of ResolveService so they can be exhaustively tested as pure
 * logic. Each test here maps to a real failure mode from #1617 / #1612.
 */
import {
  findFittingCandidate,
  DEFAULT_RESERVED_OUTPUT_TOKENS,
  type FitCandidate,
} from './context-fit';

function c(model: string, contextWindow: number): FitCandidate {
  return { model, contextWindow };
}

describe('findFittingCandidate', () => {
  it('returns the first candidate when it fits', () => {
    // Preserves cost preference: primary model wins if it can handle the
    // request, same as today. No regression for the common-size case.
    const result = findFittingCandidate(
      [c('gpt-4o-mini', 128_000), c('claude-opus-4-6', 200_000)],
      50_000,
    );
    expect(result?.model).toBe('gpt-4o-mini');
  });

  it('skips too-small candidates and picks the next one that fits', () => {
    // The bug class fuzhyperblue reported: primary is 128K, request is
    // 150K, fallback is 200K. We must pick the fallback, not the primary.
    const result = findFittingCandidate(
      [c('gpt-4o-mini', 128_000), c('claude-opus-4-6', 200_000)],
      150_000,
    );
    expect(result?.model).toBe('claude-opus-4-6');
  });

  it('returns null when nothing fits — caller will escalate or 413', () => {
    // Nothing can accept a 500K request with a 128K-reserved budget.
    const result = findFittingCandidate([c('gpt-4o-mini', 128_000)], 500_000);
    expect(result).toBeNull();
  });

  it('subtracts the output reserve from each candidate', () => {
    // 120K estimated + 4K reserved = 124K. A 128K model fits with 4K to
    // spare; drop the reserve to 10K and it no longer fits.
    const candidates = [c('gpt-4o-mini', 128_000)];
    expect(findFittingCandidate(candidates, 120_000, 4_096)?.model).toBe('gpt-4o-mini');
    expect(findFittingCandidate(candidates, 120_000, 10_000)).toBeNull();
  });

  it('uses a default output reserve when none is supplied', () => {
    // Callers outside the proxy (tests, future REPL tooling) get a safe
    // default instead of zero, so 0-arity calls never accidentally pass
    // oversized payloads through.
    expect(DEFAULT_RESERVED_OUTPUT_TOKENS).toBeGreaterThan(0);
    const result = findFittingCandidate([c('gpt-4o-mini', 128_000)], 128_000);
    // 128000 + 4096 > 128000, so we should not fit.
    expect(result).toBeNull();
  });

  it('returns null for an empty candidate list', () => {
    // Agent with no routable models — upstream code must handle this, but
    // the helper should never crash on the empty case.
    expect(findFittingCandidate([], 10_000)).toBeNull();
  });

  it('respects caller cost order when multiple candidates fit — both 128K and 200K can handle a 50K request, pick the cheaper one (#1617)', () => {
    // Invariant anchor: users expect Manifest to pick the cheapest model that
    // fits, not the largest. If the helper ever starts sorting by context
    // window (largest-first) this breaks the cost guarantee in the router's
    // pitch ("cheapest model that can handle it"). Request fits both, the
    // 128K primary wins because it appears first in the cost-ordered list.
    const result = findFittingCandidate(
      [c('gpt-4o-mini', 128_000), c('claude-opus-4-6', 200_000)],
      50_000,
    );
    expect(result?.model).toBe('gpt-4o-mini');
    expect(result?.contextWindow).toBe(128_000);
  });
});
