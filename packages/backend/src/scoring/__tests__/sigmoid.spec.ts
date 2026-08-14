import { computeConfidence, scoreToTier } from '../sigmoid';

const boundaries = { simpleMax: -0.1, standardMax: 0.1, complexMax: 0.35 };

describe('computeConfidence', () => {
  it('returns ~0.50 at a boundary', () => {
    const conf = computeConfidence(-0.1, boundaries);
    expect(conf).toBeGreaterThan(0.45);
    expect(conf).toBeLessThan(0.55);
  });

  it('returns high confidence far from boundaries', () => {
    expect(computeConfidence(0.6, boundaries)).toBeGreaterThan(0.85);
  });

  it('returns high confidence far below boundaries', () => {
    expect(computeConfidence(-0.5, boundaries)).toBeGreaterThan(0.85);
  });

  it('returns moderate confidence 0.10 from boundary', () => {
    const conf = computeConfidence(0.0, boundaries);
    expect(conf).toBeGreaterThan(0.6);
    expect(conf).toBeLessThan(0.85);
  });

  it('respects custom k parameter', () => {
    const lowK = computeConfidence(0.2, boundaries, 2);
    const highK = computeConfidence(0.2, boundaries, 20);
    expect(highK).toBeGreaterThan(lowK);
  });

  it('always returns >= 0.5 (sigmoid lower bound for non-negative distance)', () => {
    expect(computeConfidence(-0.1, boundaries)).toBeGreaterThanOrEqual(0.5);
    expect(computeConfidence(0.1, boundaries)).toBeGreaterThanOrEqual(0.5);
    expect(computeConfidence(0.35, boundaries)).toBeGreaterThanOrEqual(0.5);
  });

  it('returns exactly 0.5 at the nearest boundary (zero distance)', () => {
    // Distance is Math.abs(score - boundary); at the boundary distance == 0 and sigmoid(0) == 0.5
    expect(computeConfidence(-0.1, boundaries)).toBe(0.5);
    expect(computeConfidence(0.1, boundaries)).toBe(0.5);
    expect(computeConfidence(0.35, boundaries)).toBe(0.5);
  });

  it('returns 0.5 when k=0 regardless of distance (sigmoid degenerates)', () => {
    // With k=0, the exponent is 0 → 1 / (1 + 1) === 0.5 for any score.
    expect(computeConfidence(-10, boundaries, 0)).toBe(0.5);
    expect(computeConfidence(0, boundaries, 0)).toBe(0.5);
    expect(computeConfidence(10, boundaries, 0)).toBe(0.5);
  });

  it('with k=0.1 produces a shallow curve far from boundaries', () => {
    // Shallow k → confidence rises slowly with distance.
    // Distance from 10 to nearest boundary (0.35) is ~9.65; 1 / (1 + e^(-0.1 * 9.65)) ≈ 0.724.
    const conf = computeConfidence(10, boundaries, 0.1);
    expect(conf).toBeGreaterThan(0.7);
    expect(conf).toBeLessThan(0.75);
  });

  it('with k=100 produces a steep curve far from boundaries', () => {
    // Steep k → confidence saturates near 1 very quickly.
    // Even at distance 0.5 (score=0.85, nearest=0.35): 1 / (1 + e^(-50)) is indistinguishable from 1.
    const conf = computeConfidence(0.85, boundaries, 100);
    expect(conf).toBeGreaterThan(0.999);
    expect(conf).toBeLessThanOrEqual(1);
  });

  it('with k=0.1 vs k=100 at the same score: steep curve > shallow curve far from boundary', () => {
    const score = 1.0;
    const shallow = computeConfidence(score, boundaries, 0.1);
    const steep = computeConfidence(score, boundaries, 100);
    expect(steep).toBeGreaterThan(shallow);
  });

  it('approaches 1 as distance grows large (positive direction)', () => {
    // 1 / (1 + e^(-k * d)) → 1 as d → +∞.
    const conf = computeConfidence(1e6, boundaries);
    expect(conf).toBeGreaterThan(0.9999);
    expect(conf).toBeLessThanOrEqual(1);
  });

  it('approaches 1 as score goes to very large negative (Math.abs makes distance large)', () => {
    // minDistance uses Math.abs, so score = -1e6 yields huge distance and confidence → 1.
    const conf = computeConfidence(-1e6, boundaries);
    expect(conf).toBeGreaterThan(0.9999);
    expect(conf).toBeLessThanOrEqual(1);
  });

  it('remains numerically stable (no NaN/Infinity) at extreme positive distance', () => {
    // Math.exp(-k * d) underflows to 0 for very large k*d; result must clamp at 1, not blow up.
    const conf = computeConfidence(1e9, boundaries, 100);
    expect(Number.isFinite(conf)).toBe(true);
    expect(Number.isNaN(conf)).toBe(false);
    expect(conf).toBeLessThanOrEqual(1);
    expect(conf).toBeGreaterThan(0.999);
  });

  it('remains numerically stable at extreme negative score with extreme k', () => {
    const conf = computeConfidence(-1e9, boundaries, 100);
    expect(Number.isFinite(conf)).toBe(true);
    expect(Number.isNaN(conf)).toBe(false);
    expect(conf).toBeLessThanOrEqual(1);
    expect(conf).toBeGreaterThan(0.999);
  });

  it('uses the closest boundary (not the first) to compute distance', () => {
    // score=0.34 is 0.44 from simpleMax(-0.1), 0.24 from standardMax(0.1), 0.01 from complexMax(0.35).
    // The minimum distance is 0.01, so confidence should be very close to 0.5.
    const conf = computeConfidence(0.34, boundaries);
    const expected = 1 / (1 + Math.exp(-8 * 0.01));
    expect(conf).toBeCloseTo(expected, 10);
  });

  it('produces deterministic numeric output for the default k=8 formula', () => {
    // Pin the exact computation so refactors that change the formula are caught.
    // score=0.5, nearest boundary complexMax=0.35, distance=0.15, k=8 → sigmoid(1.2).
    const conf = computeConfidence(0.5, boundaries);
    const expected = 1 / (1 + Math.exp(-8 * 0.15));
    expect(conf).toBeCloseTo(expected, 12);
  });

  it('is symmetric around each boundary (|score - b| drives the result)', () => {
    // Equal distances on either side of the same boundary yield the same confidence.
    // Distance 0.05 below simpleMax(-0.1) → score=-0.15; distance 0.05 above → score=-0.05.
    const below = computeConfidence(-0.15, boundaries);
    const above = computeConfidence(-0.05, boundaries);
    expect(below).toBeCloseTo(above, 12);
  });
});

describe('scoreToTier', () => {
  it('maps score below simpleMax to simple', () => {
    expect(scoreToTier(-0.2, boundaries)).toBe('simple');
  });

  it('maps score between simpleMax and standardMax to standard', () => {
    expect(scoreToTier(0.0, boundaries)).toBe('standard');
  });

  it('maps score between standardMax and complexMax to complex', () => {
    expect(scoreToTier(0.2, boundaries)).toBe('complex');
  });

  it('maps score above complexMax to reasoning', () => {
    expect(scoreToTier(0.5, boundaries)).toBe('reasoning');
  });

  it('maps exact boundary values correctly', () => {
    expect(scoreToTier(-0.1, boundaries)).toBe('standard');
    expect(scoreToTier(0.1, boundaries)).toBe('complex');
    expect(scoreToTier(0.35, boundaries)).toBe('reasoning');
  });
});
