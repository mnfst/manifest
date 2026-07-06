jest.mock('./billing.config', () => ({
  isBillingEnabled: jest.fn(),
}));

import { DataSource } from 'typeorm';
import { BillingUsageEmailService } from './billing-usage-email.service';
import { isBillingEnabled } from './billing.config';
import { PlanService } from './plan.service';
import { BillingEmailLogService } from './billing-email-log.service';
import { BillingEmailService } from './billing-email.service';
import { IngestEventBusService } from '../common/services/ingest-event-bus.service';

describe('BillingUsageEmailService', () => {
  let service: BillingUsageEmailService;
  let dataSourceQuery: jest.Mock;
  let getLimits: jest.Mock;
  let tryInsert: jest.Mock;
  let sendPlanUsageEmail: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    (isBillingEnabled as jest.Mock).mockReturnValue(true);
    getLimits = jest.fn().mockResolvedValue({ agents: 1, requestsPerMonth: 10_000 });
    tryInsert = jest.fn().mockResolvedValue(true);
    sendPlanUsageEmail = jest.fn().mockResolvedValue(true);
    dataSourceQuery = jest.fn((sql: string) => {
      if (sql.includes('agent_messages')) return Promise.resolve([{ n: 8_000 }]);
      return Promise.resolve([{ email: 'owner@example.com', name: 'Ada', user_id: 'u1' }]);
    });
    service = new BillingUsageEmailService(
      { all: jest.fn() } as unknown as IngestEventBusService,
      { getLimits } as unknown as PlanService,
      { query: dataSourceQuery } as unknown as DataSource,
      { tryInsert } as unknown as BillingEmailLogService,
      { sendPlanUsageEmail } as unknown as BillingEmailService,
    );
  });

  it('does nothing when billing is disabled', async () => {
    (isBillingEnabled as jest.Mock).mockReturnValue(false);

    await expect(service.checkTenantUsage('t1')).resolves.toBe(false);

    expect(getLimits).not.toHaveBeenCalled();
    expect(sendPlanUsageEmail).not.toHaveBeenCalled();
  });

  it('sends the 80 percent warning once per tenant and month', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-06T12:00:00.000Z'));
    try {
      await expect(service.checkTenantUsage('t1')).resolves.toBe(true);

      expect(tryInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          dedupeKey: 'billing-usage:t1:2026-07-01T00:00:00.000Z:requests_warning',
          kind: 'requests_warning',
          tenantId: 't1',
          userId: 'u1',
          periodStart: '2026-07-01T00:00:00.000Z',
          periodEnd: '2026-08-01T00:00:00.000Z',
          metadata: { used: 8000, limit: 10000 },
        }),
      );
      expect(sendPlanUsageEmail).toHaveBeenCalledWith(
        'owner@example.com',
        expect.objectContaining({
          kind: 'requests_warning',
          userName: 'Ada',
          used: 8000,
          limit: 10000,
          periodEnd: '2026-08-01T00:00:00.000Z',
        }),
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('sends the limit-reached email instead of the warning when usage is at the cap', async () => {
    dataSourceQuery.mockImplementation((sql: string) => {
      if (sql.includes('agent_messages')) return Promise.resolve([{ n: 10_000 }]);
      return Promise.resolve([{ email: 'owner@example.com', name: 'Ada', user_id: 'u1' }]);
    });

    await service.checkTenantUsage('t1');

    expect(sendPlanUsageEmail).toHaveBeenCalledWith(
      'owner@example.com',
      expect.objectContaining({ kind: 'requests_limit_reached', used: 10000 }),
    );
  });

  it('does not send when the dedupe log already exists', async () => {
    tryInsert.mockResolvedValue(false);

    await expect(service.checkTenantUsage('t1')).resolves.toBe(false);

    expect(sendPlanUsageEmail).not.toHaveBeenCalled();
  });

  it('does not send below the usage threshold', async () => {
    dataSourceQuery.mockImplementation((sql: string) => {
      if (sql.includes('agent_messages')) return Promise.resolve([{ n: 7_999 }]);
      return Promise.resolve([{ email: 'owner@example.com', name: 'Ada', user_id: 'u1' }]);
    });

    await expect(service.checkTenantUsage('t1')).resolves.toBe(false);

    expect(tryInsert).not.toHaveBeenCalled();
    expect(sendPlanUsageEmail).not.toHaveBeenCalled();
  });
});
