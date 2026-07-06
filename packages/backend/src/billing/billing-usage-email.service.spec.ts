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
  let countRequestsSince: jest.Mock;
  let hasDedupeKey: jest.Mock;
  let tryInsert: jest.Mock;
  let sendPlanUsageEmail: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    (isBillingEnabled as jest.Mock).mockReturnValue(true);
    getLimits = jest.fn().mockResolvedValue({ agents: 1, requestsPerMonth: 10_000 });
    countRequestsSince = jest.fn().mockResolvedValue(8_000);
    hasDedupeKey = jest.fn().mockResolvedValue(false);
    tryInsert = jest.fn().mockResolvedValue(true);
    sendPlanUsageEmail = jest.fn().mockResolvedValue(true);
    dataSourceQuery = jest.fn(() => {
      return Promise.resolve([{ email: 'owner@example.com', name: 'Ada', user_id: 'u1' }]);
    });
    service = new BillingUsageEmailService(
      { all: jest.fn() } as unknown as IngestEventBusService,
      { getLimits, countRequestsSince } as unknown as PlanService,
      { query: dataSourceQuery } as unknown as DataSource,
      { hasDedupeKey, tryInsert } as unknown as BillingEmailLogService,
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

      expect(countRequestsSince).toHaveBeenCalledWith('t1', Date.UTC(2026, 6, 1));
      expect(hasDedupeKey).toHaveBeenCalledWith(
        'billing-usage:t1:2026-07-01T00:00:00.000Z:requests_warning',
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
    } finally {
      jest.useRealTimers();
    }
  });

  it('subscribes to message events and unsubscribes on destroy', async () => {
    const unsubscribe = jest.fn();
    const handlers: Array<(event: { kind: string; tenantId: string }) => void> = [];
    const bus = {
      all: jest.fn(() => ({
        subscribe: (handler: (event: { kind: string; tenantId: string }) => void) => {
          handlers.push(handler);
          return { unsubscribe };
        },
      })),
    } as unknown as IngestEventBusService;
    const localService = new BillingUsageEmailService(
      bus,
      { getLimits, countRequestsSince } as unknown as PlanService,
      { query: dataSourceQuery } as unknown as DataSource,
      { hasDedupeKey, tryInsert } as unknown as BillingEmailLogService,
      { sendPlanUsageEmail } as unknown as BillingEmailService,
    );
    const check = jest.spyOn(localService, 'checkTenantUsage').mockRejectedValue(new Error('boom'));
    const loggerWarn = jest.spyOn(localService['logger'], 'warn').mockImplementation();

    localService.onModuleInit();
    handlers[0]({ kind: 'other', tenantId: 't1' });
    handlers[0]({ kind: 'message', tenantId: 't1' });
    await Promise.resolve();

    expect(check).toHaveBeenCalledTimes(1);
    expect(check).toHaveBeenCalledWith('t1');
    expect(loggerWarn).toHaveBeenCalledWith(
      'Billing usage email check failed for tenant t1: Error: boom',
    );

    localService.onModuleDestroy();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    loggerWarn.mockRestore();
  });

  it('sends the limit-reached email instead of the warning when usage is at the cap', async () => {
    countRequestsSince.mockResolvedValue(10_000);

    await service.checkTenantUsage('t1');

    expect(sendPlanUsageEmail).toHaveBeenCalledWith(
      'owner@example.com',
      expect.objectContaining({ kind: 'requests_limit_reached', used: 10000 }),
    );
  });

  it('does not send when the dedupe log already exists', async () => {
    hasDedupeKey.mockResolvedValue(true);

    await expect(service.checkTenantUsage('t1')).resolves.toBe(false);

    expect(sendPlanUsageEmail).not.toHaveBeenCalled();
    expect(tryInsert).not.toHaveBeenCalled();
  });

  it('does not write the dedupe log when no billing recipient exists', async () => {
    const warn = jest.spyOn(service['logger'], 'warn').mockImplementation();
    dataSourceQuery.mockResolvedValueOnce([]);

    await expect(service.checkTenantUsage('t1')).resolves.toBe(false);

    expect(warn).toHaveBeenCalledWith('No billing email recipient found for tenant t1');
    expect(sendPlanUsageEmail).not.toHaveBeenCalled();
    expect(tryInsert).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('does not write the dedupe log when sending fails', async () => {
    sendPlanUsageEmail.mockResolvedValue(false);

    await expect(service.checkTenantUsage('t1')).resolves.toBe(false);

    expect(sendPlanUsageEmail).toHaveBeenCalledTimes(1);
    expect(tryInsert).not.toHaveBeenCalled();
  });

  it('does not send below the usage threshold', async () => {
    countRequestsSince.mockResolvedValue(7_999);

    await expect(service.checkTenantUsage('t1')).resolves.toBe(false);

    expect(hasDedupeKey).not.toHaveBeenCalled();
    expect(tryInsert).not.toHaveBeenCalled();
    expect(sendPlanUsageEmail).not.toHaveBeenCalled();
  });
});
