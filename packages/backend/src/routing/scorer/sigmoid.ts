import { Tier, TierBoundaries } from './types';

export function scoreToTier(
  score: number,
  boundaries: TierBoundaries,
): Tier {
  if (score < boundaries.simpleMax) return 'simple';
  if (score < boundaries.standardMax) return 'standard';
  if (score < boundaries.complexMax) return 'complex';
  return 'reasoning';
}

export function computeConfidence(
  score: number,
  boundaries: TierBoundaries,
  k = 8,
): number {
  const boundaryValues = [
    boundaries.simpleMax,
    boundaries.standardMax,
    boundaries.complexMax,
  ];

  let minDistance = Infinity;
  for (const b of boundaryValues) {
    const dist = Math.abs(score - b);
    if (dist < minDistance) minDistance = dist;
  }

  return 1 / (1 + Math.exp(-k * minDistance));
}
