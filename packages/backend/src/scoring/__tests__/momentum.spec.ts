import { applyMomentum } from '../momentum';
import { Tier } from '../types';

describe('applyMomentum', () => {
  it('returns unchanged score with no momentum input', () => {
    const { effectiveScore, info } = applyMomentum(0.2, 100, undefined);
    expect(effectiveScore).toBe(0.2);
    expect(info.applied).toBe(false);
    expect(info.historyLength).toBe(0);
  });

  it('returns unchanged score with empty recentTiers', () => {
    const { effectiveScore, info } = applyMomentum(0.2, 50, {
      recentTiers: [],
    });
    expect(effectiveScore).toBe(0.2);
    expect(info.applied).toBe(false);
  });

  it('does not apply momentum for long messages (>100 chars)', () => {
    const { effectiveScore, info } = applyMomentum(0.2, 150, {
      recentTiers: ['complex', 'complex', 'complex'],
    });
    expect(effectiveScore).toBe(0.2);
    expect(info.momentumWeight).toBe(0);
    expect(info.applied).toBe(false);
  });

  it('pushes score up for short message with complex history', () => {
    const rawScore = -0.2;
    const { effectiveScore } = applyMomentum(rawScore, 10, {
      recentTiers: ['complex', 'complex', 'complex'],
    });
    expect(effectiveScore).toBeGreaterThan(rawScore);
  });

  it('blends proportionally for medium message', () => {
    const rawScore = 0.0;
    const { effectiveScore, info } = applyMomentum(rawScore, 50, {
      recentTiers: ['complex', 'complex'],
    });
    expect(info.momentumWeight).toBeGreaterThan(0);
    expect(info.momentumWeight).toBeLessThan(0.3);
    expect(effectiveScore).toBeGreaterThan(rawScore);
  });

  it('sets applied=true when momentum changes the score', () => {
    const { info } = applyMomentum(-0.2, 10, {
      recentTiers: ['complex', 'complex'],
    });
    expect(info.applied).toBe(true);
  });

  it('sets applied=false when momentum does not change score', () => {
    const { info } = applyMomentum(0.2, 200, {
      recentTiers: ['complex', 'complex'],
    });
    expect(info.applied).toBe(false);
  });

  it('only uses last 5 history entries', () => {
    const { info } = applyMomentum(0.0, 20, {
      recentTiers: [
        'reasoning',
        'reasoning',
        'reasoning',
        'reasoning',
        'reasoning',
        'simple',
        'simple',
        'simple',
      ],
    });
    expect(info.historyLength).toBe(5);
    expect(info.historyAvgScore).toBeCloseTo(0.4);
  });

  it('gives maximum momentum weight (0.6) for zero-length message', () => {
    const { info } = applyMomentum(0.0, 0, {
      recentTiers: ['complex'],
    });
    expect(info.momentumWeight).toBeCloseTo(0.6);
  });

  it('gives exactly 0.3 momentum weight at message length 30', () => {
    const { info } = applyMomentum(0.0, 30, {
      recentTiers: ['complex'],
    });
    expect(info.momentumWeight).toBeCloseTo(0.3);
  });

  it('gives exactly 0 momentum weight at message length 100', () => {
    const { info } = applyMomentum(0.0, 100, {
      recentTiers: ['complex'],
    });
    expect(info.momentumWeight).toBeCloseTo(0.3 * (1 - 70 / 70));
  });

  it('handles null recentTiers gracefully', () => {
    const { effectiveScore, info } = applyMomentum(0.2, 50, {
      recentTiers: null as unknown as Tier[],
    });
    expect(effectiveScore).toBe(0.2);
    expect(info.applied).toBe(false);
  });

  it('treats unknown tier values as 0 score', () => {
    const { info } = applyMomentum(0.0, 10, {
      recentTiers: ['unknown' as unknown as Tier],
    });
    expect(info.historyAvgScore).toBe(0);
  });
});
