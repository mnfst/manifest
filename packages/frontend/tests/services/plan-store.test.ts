import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadPlan, isFreePlan, planStatus, resetPlanStore } from '../../src/services/plan-store.js';

const mockGetBillingPlan = vi.fn();
vi.mock('../../src/services/api/billing.js', () => ({
  getBillingPlan: (...args: unknown[]) => mockGetBillingPlan(...args),
}));

describe('plan store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPlanStore();
  });

  it('resolves and caches the plan on first load', async () => {
    mockGetBillingPlan.mockResolvedValue({ enabled: true, plan: 'pro' });
    await expect(loadPlan()).resolves.toEqual({ enabled: true, plan: 'pro' });
    await expect(loadPlan()).resolves.toEqual({ enabled: true, plan: 'pro' });
    expect(mockGetBillingPlan).toHaveBeenCalledTimes(1);
    expect(planStatus()).toEqual({ enabled: true, plan: 'pro' });
  });

  it('dedupes concurrent loads onto one request', async () => {
    let resolve!: (v: { enabled: boolean; plan: string }) => void;
    mockGetBillingPlan.mockReturnValue(new Promise((r) => (resolve = r)));
    const [a, b] = [loadPlan(), loadPlan()];
    resolve({ enabled: true, plan: 'free' });
    await expect(a).resolves.toEqual({ enabled: true, plan: 'free' });
    await expect(b).resolves.toEqual({ enabled: true, plan: 'free' });
    expect(mockGetBillingPlan).toHaveBeenCalledTimes(1);
  });

  it('fails open (billing disabled) when the lookup errors, without caching failure', async () => {
    mockGetBillingPlan.mockRejectedValueOnce(new Error('boom'));
    await expect(loadPlan()).resolves.toEqual({ enabled: false, plan: 'free' });
    expect(isFreePlan()).toBe(false);
    // A later boot (store reset) retries instead of serving the failed value.
    resetPlanStore();
    mockGetBillingPlan.mockResolvedValue({ enabled: true, plan: 'free' });
    await expect(loadPlan()).resolves.toEqual({ enabled: true, plan: 'free' });
  });

  it('derives isFreePlan only for an enabled free plan', () => {
    expect(isFreePlan()).toBe(false); // unresolved
    resetPlanStore({ enabled: false, plan: 'free' });
    expect(isFreePlan()).toBe(false); // billing off (self-hosted)
    resetPlanStore({ enabled: true, plan: 'pro' });
    expect(isFreePlan()).toBe(false);
    resetPlanStore({ enabled: true, plan: 'free' });
    expect(isFreePlan()).toBe(true);
  });
});
