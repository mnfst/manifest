import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock `fetchJson` at the module boundary so the test pins exactly the path
// `billing.ts` asks for, without re-exercising the SWR cache + fetch plumbing
// already covered by core.test.ts. The factory is hoisted, so the spy has to
// be created via `vi.hoisted` to be referenceable inside it.
const { fetchJsonMock, fetchMutateMock } = vi.hoisted(() => ({
  fetchJsonMock: vi.fn(),
  fetchMutateMock: vi.fn(),
}));

vi.mock('../../../src/services/api/core.js', () => ({
  fetchJson: fetchJsonMock,
  fetchMutate: fetchMutateMock,
}));

import { getBillingStatus, updateBillingEmailPreferences } from '../../../src/services/api/billing';
import { fetchJson, fetchMutate } from '../../../src/services/api/core';
import type { BillingStatus } from 'manifest-shared';

describe('billing API client', () => {
  beforeEach(() => {
    fetchJsonMock.mockReset();
    fetchMutateMock.mockReset();
  });

  it('getBillingStatus GETs /billing/status and returns the parsed status', async () => {
    const status: BillingStatus = {
      enabled: true,
      plan: 'pro',
      priceMonthlyUsd: 20,
      emailPreferences: { usageAlerts: true },
      requests: { used: 1_000, limit: 500_000, periodEnd: '2026-08-01T00:00:00.000Z' },
    };
    fetchJsonMock.mockResolvedValue(status);

    const result = await getBillingStatus();

    expect(fetchJson).toHaveBeenCalledWith('/billing/status');
    expect(result).toEqual(status);
  });

  it('getBillingStatus returns a disabled free-plan status unchanged', async () => {
    const status: BillingStatus = {
      enabled: false,
      plan: 'free',
      priceMonthlyUsd: null,
      emailPreferences: { usageAlerts: true },
      requests: { used: null, limit: 10_000, periodEnd: null },
    };
    fetchJsonMock.mockResolvedValue(status);

    const result = await getBillingStatus();

    expect(fetchJson).toHaveBeenCalledWith('/billing/status');
    expect(result).toBe(status);
  });

  it('passes through fetch options for fresh billing reads', async () => {
    const status: BillingStatus = {
      enabled: true,
      plan: 'free',
      priceMonthlyUsd: 20,
      emailPreferences: { usageAlerts: true },
      requests: { used: 500, limit: 10_000, periodEnd: null },
    };
    fetchJsonMock.mockResolvedValue(status);

    const result = await getBillingStatus({ cache: false });

    expect(fetchJson).toHaveBeenCalledWith('/billing/status', undefined, { cache: false });
    expect(result).toBe(status);
  });

  it('updateBillingEmailPreferences PATCHes the preference payload', async () => {
    const saved = { usageAlerts: false };
    fetchMutateMock.mockResolvedValue(saved);

    const result = await updateBillingEmailPreferences({ usageAlerts: false });

    expect(fetchMutate).toHaveBeenCalledWith('/billing/email-preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usageAlerts: false }),
    });
    expect(result).toBe(saved);
  });
});
