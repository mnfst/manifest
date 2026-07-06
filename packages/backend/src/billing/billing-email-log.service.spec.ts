import { DataSource } from 'typeorm';
import { BillingEmailLogService } from './billing-email-log.service';

describe('BillingEmailLogService', () => {
  it('returns true when a dedupe key is inserted', async () => {
    const query = jest.fn().mockResolvedValue([{ id: 'log-1' }]);
    const service = new BillingEmailLogService({ query } as unknown as DataSource);

    await expect(
      service.tryInsert({
        dedupeKey: 'billing-usage:t1:2026-07:requests_warning',
        kind: 'requests_warning',
        tenantId: 't1',
        userId: 'u1',
        periodStart: '2026-07-01T00:00:00.000Z',
        periodEnd: '2026-08-01T00:00:00.000Z',
        metadata: { used: 8000, limit: 10000 },
      }),
    ).resolves.toBe(true);

    expect(query).toHaveBeenCalledWith(expect.stringContaining('ON CONFLICT (dedupe_key)'), [
      expect.any(String),
      'billing-usage:t1:2026-07:requests_warning',
      'requests_warning',
      't1',
      'u1',
      null,
      '2026-07-01T00:00:00.000Z',
      '2026-08-01T00:00:00.000Z',
      { used: 8000, limit: 10000 },
    ]);
  });

  it('returns false when the dedupe key already exists', async () => {
    const service = new BillingEmailLogService({
      query: jest.fn().mockResolvedValue([]),
    } as unknown as DataSource);

    await expect(
      service.tryInsert({
        dedupeKey: 'billing:subscription_confirmed:sub_1',
        kind: 'subscription_confirmed',
      }),
    ).resolves.toBe(false);
  });
});
