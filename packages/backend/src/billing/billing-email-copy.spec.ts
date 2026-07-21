import { planUsagePercentage } from './billing-email-copy';

describe('planUsagePercentage', () => {
  it.each([
    [995, 1000],
    [9999, 10000],
    [999.99, 1000],
  ])('keeps near-limit usage below 100%% until the limit is reached', (used, limit) => {
    expect(planUsagePercentage(used, limit)).toBe(99);
  });

  it.each([
    [1000, 1000],
    [1001, 1000],
  ])('reports 100%% once the limit is reached or exceeded', (used, limit) => {
    expect(planUsagePercentage(used, limit)).toBe(100);
  });

  it('rounds ordinary percentages to the nearest whole number', () => {
    expect(planUsagePercentage(8549, 10000)).toBe(85);
    expect(planUsagePercentage(8550, 10000)).toBe(86);
  });

  it.each([
    [Number.NaN, 1000],
    [100, Number.POSITIVE_INFINITY],
    [100, 0],
    [100, -1],
    [-1, 100],
  ])('returns zero for invalid or negative-domain usage (%p, %p)', (used, limit) => {
    expect(planUsagePercentage(used, limit)).toBe(0);
  });
});
