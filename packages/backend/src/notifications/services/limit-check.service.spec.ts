import { Subject } from 'rxjs';
import { LimitCheckService } from './limit-check.service';
import { NotificationRulesService } from './notification-rules.service';
import { NotificationEmailService } from './notification-email.service';
import { EmailProviderConfigService } from './email-provider-config.service';
import { IngestEventBusService } from '../../common/services/ingest-event-bus.service';
import { DataSource } from 'typeorm';

describe('LimitCheckService', () => {
  let service: LimitCheckService;
  let mockGetActiveBlockRules: jest.Mock;
  let mockGetConsumption: jest.Mock;
  let mockQuery: jest.Mock;
  let mockSendThresholdAlert: jest.Mock;
  let mockGetFullConfig: jest.Mock;
  let ingestSubject: Subject<string>;

  beforeEach(() => {
    mockGetActiveBlockRules = jest.fn().mockResolvedValue([]);
    mockGetConsumption = jest.fn().mockResolvedValue(0);

    const rulesService = {
      getActiveBlockRules: mockGetActiveBlockRules,
      getConsumption: mockGetConsumption,
    } as unknown as NotificationRulesService;

    mockQuery = jest.fn().mockResolvedValue([]);
    const ds = {
      query: mockQuery,
      options: { type: 'postgres' },
    } as unknown as DataSource;

    mockSendThresholdAlert = jest.fn().mockResolvedValue(true);
    const emailService = {
      sendThresholdAlert: mockSendThresholdAlert,
    } as unknown as NotificationEmailService;

    mockGetFullConfig = jest.fn().mockResolvedValue(null);
    const emailProviderConfig = {
      getFullConfig: mockGetFullConfig,
    } as unknown as EmailProviderConfigService;

    ingestSubject = new Subject<string>();
    const ingestBus = { all: () => ingestSubject.asObservable() } as unknown as IngestEventBusService;

    service = new LimitCheckService(ds, rulesService, emailService, emailProviderConfig, ingestBus);
    service.onModuleInit();
  });

  afterEach(() => {
    service.onModuleDestroy();
    ingestSubject.complete();
  });

  it('returns null when no block rules exist', async () => {
    const result = await service.checkLimits('tenant-1', 'my-agent');
    expect(result).toBeNull();
  });

  it('returns null when consumption is below threshold', async () => {
    mockGetActiveBlockRules.mockResolvedValue([{
      id: 'r1', tenant_id: 'tenant-1', agent_name: 'my-agent', user_id: 'u1',
      metric_type: 'tokens', threshold: 50000, period: 'day',
    }]);
    mockGetConsumption.mockResolvedValue(30000);

    const result = await service.checkLimits('tenant-1', 'my-agent');
    expect(result).toBeNull();
  });

  it('returns LimitExceeded when consumption meets threshold', async () => {
    mockGetActiveBlockRules.mockResolvedValue([{
      id: 'r1', tenant_id: 'tenant-1', agent_name: 'my-agent', user_id: 'u1',
      metric_type: 'tokens', threshold: 50000, period: 'day',
    }]);
    mockGetConsumption.mockResolvedValue(50000);

    const result = await service.checkLimits('tenant-1', 'my-agent');
    expect(result).not.toBeNull();
    expect(result!.ruleId).toBe('r1');
    expect(result!.metricType).toBe('tokens');
    expect(result!.threshold).toBe(50000);
    expect(result!.actual).toBe(50000);
  });

  it('returns LimitExceeded when consumption exceeds threshold', async () => {
    mockGetActiveBlockRules.mockResolvedValue([{
      id: 'r1', tenant_id: 'tenant-1', agent_name: 'my-agent', user_id: 'u1',
      metric_type: 'cost', threshold: 10, period: 'month',
    }]);
    mockGetConsumption.mockResolvedValue(15.5);

    const result = await service.checkLimits('tenant-1', 'my-agent');
    expect(result).not.toBeNull();
    expect(result!.metricType).toBe('cost');
    expect(result!.actual).toBe(15.5);
  });

  it('returns first exceeded rule when multiple rules exist', async () => {
    mockGetActiveBlockRules.mockResolvedValue([
      { id: 'r1', tenant_id: 't', agent_name: 'a', user_id: 'u1', metric_type: 'tokens', threshold: 100000, period: 'day' },
      { id: 'r2', tenant_id: 't', agent_name: 'a', user_id: 'u1', metric_type: 'cost', threshold: 5, period: 'day' },
    ]);
    mockGetConsumption
      .mockResolvedValueOnce(50000) // below r1 threshold
      .mockResolvedValueOnce(10);   // above r2 threshold

    const result = await service.checkLimits('t', 'a');
    expect(result).not.toBeNull();
    expect(result!.ruleId).toBe('r2');
  });

  it('caches rules for 60s', async () => {
    mockGetActiveBlockRules.mockResolvedValue([]);

    await service.checkLimits('tenant-1', 'my-agent');
    await service.checkLimits('tenant-1', 'my-agent');

    expect(mockGetActiveBlockRules).toHaveBeenCalledTimes(1);
  });

  it('caches consumption values for 60s', async () => {
    mockGetActiveBlockRules.mockResolvedValue([{
      id: 'r1', tenant_id: 'tenant-1', agent_name: 'my-agent', user_id: 'u1',
      metric_type: 'tokens', threshold: 100000, period: 'day',
    }]);
    mockGetConsumption.mockResolvedValue(5000);

    await service.checkLimits('tenant-1', 'my-agent');
    await service.checkLimits('tenant-1', 'my-agent');

    expect(mockGetConsumption).toHaveBeenCalledTimes(1);
  });

  it('invalidateCache clears rules and consumption for tenant+agent', async () => {
    mockGetActiveBlockRules.mockResolvedValue([{
      id: 'r1', tenant_id: 'tenant-1', agent_name: 'my-agent', user_id: 'u1',
      metric_type: 'tokens', threshold: 100000, period: 'day',
    }]);
    mockGetConsumption.mockResolvedValue(5000);

    await service.checkLimits('tenant-1', 'my-agent');
    expect(mockGetActiveBlockRules).toHaveBeenCalledTimes(1);

    service.invalidateCache('tenant-1', 'my-agent');

    await service.checkLimits('tenant-1', 'my-agent');
    expect(mockGetActiveBlockRules).toHaveBeenCalledTimes(2);
    expect(mockGetConsumption).toHaveBeenCalledTimes(2);
  });

  it('clears consumption cache when ingest event fires', async () => {
    mockGetActiveBlockRules.mockResolvedValue([{
      id: 'r1', tenant_id: 'tenant-1', agent_name: 'my-agent', user_id: 'u1',
      metric_type: 'tokens', threshold: 100000, period: 'day',
    }]);
    mockGetConsumption.mockResolvedValue(5000);

    await service.checkLimits('tenant-1', 'my-agent');
    expect(mockGetConsumption).toHaveBeenCalledTimes(1);

    // Simulate OTLP ingest event
    ingestSubject.next('some-user');

    await service.checkLimits('tenant-1', 'my-agent');
    expect(mockGetConsumption).toHaveBeenCalledTimes(2);
  });

  it('invalidateCache does not affect other tenant+agent pairs', async () => {
    mockGetActiveBlockRules.mockResolvedValue([]);

    await service.checkLimits('tenant-1', 'agent-a');
    await service.checkLimits('tenant-2', 'agent-b');
    expect(mockGetActiveBlockRules).toHaveBeenCalledTimes(2);

    service.invalidateCache('tenant-1', 'agent-a');

    await service.checkLimits('tenant-1', 'agent-a');
    await service.checkLimits('tenant-2', 'agent-b');
    // tenant-1/agent-a re-fetched, tenant-2/agent-b cached
    expect(mockGetActiveBlockRules).toHaveBeenCalledTimes(3);
  });

  describe('email notification on block', () => {
    const rule = {
      id: 'r1', tenant_id: 'tenant-1', agent_name: 'my-agent', user_id: 'u1',
      metric_type: 'tokens' as const, threshold: 50000, period: 'day' as const,
    };

    beforeEach(() => {
      mockGetActiveBlockRules.mockResolvedValue([rule]);
      mockGetConsumption.mockResolvedValue(60000);
      // No prior notification log
      mockQuery.mockResolvedValue([]);
    });

    it('sends email and logs when limit exceeded first time', async () => {
      mockQuery
        .mockResolvedValueOnce([])                              // notification_logs check
        .mockResolvedValueOnce([{ email: 'test@example.com' }]) // user email
        .mockResolvedValueOnce([]);                             // INSERT

      await service.checkLimits('tenant-1', 'my-agent');
      await new Promise((r) => setTimeout(r, 50));

      expect(mockSendThresholdAlert).toHaveBeenCalledWith(
        'test@example.com',
        expect.objectContaining({ agentName: 'my-agent', metricType: 'tokens', threshold: 50000, actualValue: 60000, period: 'day' }),
        undefined,
      );
      const insertCall = mockQuery.mock.calls.find(
        (c: unknown[]) => typeof c[0] === 'string' && c[0].includes('INSERT INTO notification_logs'),
      );
      expect(insertCall).toBeDefined();
    });

    it('skips email when already notified for this period', async () => {
      mockQuery.mockResolvedValueOnce([{ 1: 1 }]);
      await service.checkLimits('tenant-1', 'my-agent');
      await new Promise((r) => setTimeout(r, 50));
      expect(mockSendThresholdAlert).not.toHaveBeenCalled();
    });

    it('logs notification even when no email is resolved', async () => {
      mockQuery.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
      await service.checkLimits('tenant-1', 'my-agent');
      await new Promise((r) => setTimeout(r, 50));
      expect(mockSendThresholdAlert).not.toHaveBeenCalled();
      const insertCall = mockQuery.mock.calls.find(
        (c: unknown[]) => typeof c[0] === 'string' && c[0].includes('INSERT INTO notification_logs'),
      );
      expect(insertCall).toBeDefined();
    });

    it('does not log notification when email send fails', async () => {
      mockSendThresholdAlert.mockResolvedValue(false);
      mockQuery.mockResolvedValueOnce([]).mockResolvedValueOnce([{ email: 'test@example.com' }]);
      await service.checkLimits('tenant-1', 'my-agent');
      await new Promise((r) => setTimeout(r, 50));
      expect(mockSendThresholdAlert).toHaveBeenCalled();
      const insertCall = mockQuery.mock.calls.find(
        (c: unknown[]) => typeof c[0] === 'string' && c[0].includes('INSERT INTO notification_logs'),
      );
      expect(insertCall).toBeUndefined();
    });

    it('uses email provider config when available', async () => {
      const providerConfig = { provider: 'resend', apiKey: 'key', notificationEmail: 'custom@example.com' };
      mockGetFullConfig.mockResolvedValue(providerConfig);
      mockQuery.mockResolvedValueOnce([]);
      await service.checkLimits('tenant-1', 'my-agent');
      await new Promise((r) => setTimeout(r, 50));
      expect(mockSendThresholdAlert).toHaveBeenCalledWith('custom@example.com', expect.anything(), providerConfig);
    });

    it('suppresses email for LOCAL_EMAIL users', async () => {
      mockQuery.mockResolvedValueOnce([]).mockResolvedValueOnce([{ email: 'local@manifest.local' }]);
      await service.checkLimits('tenant-1', 'my-agent');
      await new Promise((r) => setTimeout(r, 50));
      expect(mockSendThresholdAlert).not.toHaveBeenCalled();
    });

    it('catches and logs error in notifyLimitExceeded', async () => {
      const loggerSpy = jest.spyOn(service['logger'], 'error').mockImplementation();
      mockQuery.mockRejectedValueOnce(new Error('DB down'));
      await service.checkLimits('tenant-1', 'my-agent');
      await new Promise((r) => setTimeout(r, 50));
      expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to send block notification'));
      loggerSpy.mockRestore();
    });

    it('includes period field in returned LimitExceeded', async () => {
      const result = await service.checkLimits('tenant-1', 'my-agent');
      expect(result).not.toBeNull();
      expect(result!.period).toBe('day');
    });
  });

});
