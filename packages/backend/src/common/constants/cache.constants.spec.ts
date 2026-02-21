import { DASHBOARD_CACHE_TTL_MS, MODEL_PRICES_CACHE_TTL_MS } from './cache.constants';

describe('Cache constants', () => {
  it('DASHBOARD_CACHE_TTL_MS is 5 seconds', () => {
    expect(DASHBOARD_CACHE_TTL_MS).toBe(5_000);
  });

  it('MODEL_PRICES_CACHE_TTL_MS is 5 minutes', () => {
    expect(MODEL_PRICES_CACHE_TTL_MS).toBe(300_000);
  });
});
