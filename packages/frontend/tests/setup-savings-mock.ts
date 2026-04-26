import { vi } from 'vitest';

// Global mock for savings API functions to prevent unhandled fetch errors
// in tests that render Overview but don't explicitly mock these.
// Individual test files can override with their own vi.mock calls.
vi.mock('../src/services/api/analytics.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    getSavings: vi.fn(() =>
      Promise.resolve({
        total_saved: 0,
        savings_pct: 0,
        actual_cost: 0,
        baseline_cost: 0,
        baseline_model: null,
        baseline_override_stale: false,
        request_count: 0,
        trend_pct: 0,
        savings_by_auth_type: { api_key: 0, subscription: 0, local: 0 },
      }),
    ),
    getBaselineCandidates: vi.fn(() => Promise.resolve([])),
    updateBaseline: vi.fn(() => Promise.resolve({})),
  };
});
