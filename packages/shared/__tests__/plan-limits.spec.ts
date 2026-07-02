import { PLANS, PLAN_LIMITS, UNLIMITED_PLAN_LIMITS } from '../src/plan-limits';

describe('plan-limits', () => {
  it('defines limits for every plan', () => {
    for (const plan of PLANS) {
      expect(PLAN_LIMITS[plan]).toBeDefined();
    }
  });

  it('pins the launch values', () => {
    expect(PLAN_LIMITS.free).toEqual({ agents: 1, requestsPerMonth: 10_000 });
    expect(PLAN_LIMITS.pro).toEqual({ agents: 10, requestsPerMonth: 500_000 });
    expect(UNLIMITED_PLAN_LIMITS).toEqual({ agents: null, requestsPerMonth: null });
  });
});
