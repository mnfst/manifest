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
