import { Subject } from 'rxjs';
import { LimitCheckService } from './limit-check.service';
import { NotificationRulesService } from './notification-rules.service';
import { NotificationEmailService } from './notification-email.service';
import { EmailProviderConfigService } from './email-provider-config.service';
import { NotificationLogService } from './notification-log.service';
import { IngestEventBusService } from '../../common/services/ingest-event-bus.service';
import { ManifestRuntimeService } from '../../common/services/manifest-runtime.service';

describe('LimitCheckService', () => {
  let service: LimitCheckService;
  let mockGetActiveBlockRules: jest.Mock;
  let mockGetConsumption: jest.Mock;
  let mockSendThresholdAlert: jest.Mock;
  let mockGetFullConfig: jest.Mock;
  let mockHasAlreadySent: jest.Mock;
  let mockInsertLog: jest.Mock;
  let mockResolveUserEmail: jest.Mock;
  let ingestSubject: Subject<string>;
  let mockRuntime: { getAuthBaseUrl: jest.Mock };

  beforeEach(() => {
    mockGetActiveBlockRules = jest.fn().mockResolvedValue([]);
    mockGetConsumption = jest.fn().mockResolvedValue(0);

    const rulesService = {
      getActiveBlockRules: mockGetActiveBlockRules,
      getConsumption: mockGetConsumption,
    } as unknown as NotificationRulesService;

    mockSendThresholdAlert = jest.fn().mockResolvedValue(true);
    const emailService = {
      sendThresholdAlert: mockSendThresholdAlert,
    } as unknown as NotificationEmailService;

    mockGetFullConfig = jest.fn().mockResolvedValue(null);
    const emailProviderConfig = {
      getFullConfig: mockGetFullConfig,
    } as unknown as EmailProviderConfigService;
    mockRuntime = {
      getAuthBaseUrl: jest.fn().mockReturnValue('http://localhost:3001'),
    };

    ingestSubject = new Subject<string>();
    const ingestBus = {
      all: () => ingestSubject.asObservable(),
    } as unknown as IngestEventBusService;

    mockHasAlreadySent = jest.fn().mockResolvedValue(false);
    mockInsertLog = jest.fn().mockResolvedValue(undefined);
    mockResolveUserEmail = jest.fn().mockResolvedValue(null);
    const notificationLog = {
      hasAlreadySent: mockHasAlreadySent,
      insertLog: mockInsertLog,
      resolveUserEmail: mockResolveUserEmail,
    } as unknown as NotificationLogService;

    service = new LimitCheckService(
      rulesService,
      emailService,
      emailProviderConfig,
      ingestBus,
      mockRuntime as unknown as ManifestRuntimeService,
      notificationLog,
    );
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
    mockGetActiveBlockRules.mockResolvedValue([
      {
        id: 'r1',
        tenant_id: 'tenant-1',
        agent_name: 'my-agent',
        user_id: 'u1',
        metric_type: 'tokens',
        threshold: 50000,
        period: 'day',
      },
    ]);
    mockGetConsumption.mockResolvedValue(30000);

    const result = await service.checkLimits('tenant-1', 'my-agent');
    expect(result).toBeNull();
  });

  it('returns LimitExceeded when consumption meets threshold', async () => {
    mockGetActiveBlockRules.mockResolvedValue([
      {
        id: 'r1',
        tenant_id: 'tenant-1',
        agent_name: 'my-agent',
        user_id: 'u1',
        metric_type: 'tokens',
        threshold: 50000,
        period: 'day',
      },
    ]);
    mockGetConsumption.mockResolvedValue(50000);

    const result = await service.checkLimits('tenant-1', 'my-agent');
    expect(result).not.toBeNull();
    expect(result!.ruleId).toBe('r1');
    expect(result!.metricType).toBe('tokens');
    expect(result!.threshold).toBe(50000);
    expect(result!.actual).toBe(50000);
  });

  it('returns LimitExceeded when consumption exceeds threshold', async () => {
    mockGetActiveBlockRules.mockResolvedValue([
      {
        id: 'r1',
        tenant_id: 'tenant-1',
        agent_name: 'my-agent',
        user_id: 'u1',
        metric_type: 'cost',
        threshold: 10,
        period: 'month',
      },
    ]);
    mockGetConsumption.mockResolvedValue(15.5);

    const result = await service.checkLimits('tenant-1', 'my-agent');
    expect(result).not.toBeNull();
    expect(result!.metricType).toBe('cost');
    expect(result!.actual).toBe(15.5);
  });

  it('returns first exceeded rule when multiple rules exist', async () => {
    mockGetActiveBlockRules.mockResolvedValue([
      {
        id: 'r1',
        tenant_id: 't',
        agent_name: 'a',
        user_id: 'u1',
        metric_type: 'tokens',
        threshold: 100000,
        period: 'day',
      },
      {
        id: 'r2',
        tenant_id: 't',
        agent_name: 'a',
        user_id: 'u1',
        metric_type: 'cost',
        threshold: 5,
        period: 'day',
      },
    ]);
    mockGetConsumption
      .mockResolvedValueOnce(50000) // below r1 threshold
      .mockResolvedValueOnce(10); // above r2 threshold

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
    mockGetActiveBlockRules.mockResolvedValue([
      {
        id: 'r1',
        tenant_id: 'tenant-1',
        agent_name: 'my-agent',
        user_id: 'u1',
        metric_type: 'tokens',
        threshold: 100000,
        period: 'day',
      },
    ]);
    mockGetConsumption.mockResolvedValue(5000);

    await service.checkLimits('tenant-1', 'my-agent');
    await service.checkLimits('tenant-1', 'my-agent');

    expect(mockGetConsumption).toHaveBeenCalledTimes(1);
  });

  it('invalidateCache clears rules and consumption for tenant+agent', async () => {
    mockGetActiveBlockRules.mockResolvedValue([
      {
        id: 'r1',
        tenant_id: 'tenant-1',
        agent_name: 'my-agent',
        user_id: 'u1',
        metric_type: 'tokens',
        threshold: 100000,
        period: 'day',
      },
    ]);
    mockGetConsumption.mockResolvedValue(5000);

    await service.checkLimits('tenant-1', 'my-agent');
    expect(mockGetActiveBlockRules).toHaveBeenCalledTimes(1);

    service.invalidateCache('tenant-1', 'my-agent');

    await service.checkLimits('tenant-1', 'my-agent');
    expect(mockGetActiveBlockRules).toHaveBeenCalledTimes(2);
    expect(mockGetConsumption).toHaveBeenCalledTimes(2);
  });

  it('clears consumption cache when ingest event fires', async () => {
    mockGetActiveBlockRules.mockResolvedValue([
      {
        id: 'r1',
        tenant_id: 'tenant-1',
        agent_name: 'my-agent',
        user_id: 'u1',
        metric_type: 'tokens',
        threshold: 100000,
        period: 'day',
      },
    ]);
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

  it('evicts oldest rules cache entry when MAX_CACHE_SIZE is reached', async () => {
    const rulesCache = (service as any).rulesCache as Map<string, unknown>;
    const now = Date.now();

    // Fill to exactly MAX_CACHE_SIZE so the next insert triggers eviction
    for (let i = 0; i < 10_000; i++) {
      rulesCache.set(`t-${i}:a-${i}`, { data: [], expiresAt: now + 999_999 });
    }
    expect(rulesCache.size).toBe(10_000);

    mockGetActiveBlockRules.mockResolvedValue([]);
    await service.checkLimits('tenant-new', 'agent-new');

    // The first filler entry should have been evicted
    expect(rulesCache.has('t-0:a-0')).toBe(false);
    // The new entry should be present
    expect(rulesCache.has('tenant-new:agent-new')).toBe(true);
  });

  it('evicts oldest consumption cache entry when MAX_CACHE_SIZE is reached', async () => {
    const consumptionCache = (service as any).consumptionCache as Map<string, unknown>;
    const now = Date.now();

    for (let i = 0; i < 10_000; i++) {
      consumptionCache.set(`t-${i}:a-${i}:tokens:2026-01-01`, {
        data: 0,
        expiresAt: now + 999_999,
      });
    }
    expect(consumptionCache.size).toBe(10_000);

    mockGetActiveBlockRules.mockResolvedValue([
      {
        id: 'r1',
        tenant_id: 'tenant-new',
        agent_name: 'agent-new',
        user_id: 'u1',
        metric_type: 'tokens',
        threshold: 100000,
        period: 'day',
      },
    ]);
    mockGetConsumption.mockResolvedValue(0);

    await service.checkLimits('tenant-new', 'agent-new');

    // The first filler entry should have been evicted
    expect(consumptionCache.has('t-0:a-0:tokens:2026-01-01')).toBe(false);
  });

  describe('email notification on block', () => {
    const rule = {
      id: 'r1',
      tenant_id: 'tenant-1',
      agent_name: 'my-agent',
      user_id: 'u1',
      metric_type: 'tokens' as const,
      threshold: 50000,
      period: 'day' as const,
    };

    beforeEach(() => {
      mockGetActiveBlockRules.mockResolvedValue([rule]);
      mockGetConsumption.mockResolvedValue(60000);
    });

    it('sends email and logs when limit exceeded first time', async () => {
      mockResolveUserEmail.mockResolvedValue('test@example.com');

      await service.checkLimits('tenant-1', 'my-agent');
      await new Promise((r) => setTimeout(r, 50));

      expect(mockSendThresholdAlert).toHaveBeenCalledWith(
        'test@example.com',
        expect.objectContaining({
          agentName: 'my-agent',
          metricType: 'tokens',
          threshold: 50000,
          actualValue: 60000,
          period: 'day',
          alertType: 'hard',
          periodResetDate: expect.any(String),
        }),
        undefined,
      );
      expect(mockInsertLog).toHaveBeenCalledWith(
        expect.objectContaining({
          ruleId: 'r1',
          actualValue: 60000,
          thresholdValue: 50000,
          metricType: 'tokens',
          agentName: 'my-agent',
        }),
      );
    });

    it('skips email when already notified for this period', async () => {
      mockHasAlreadySent.mockResolvedValue(true);
      await service.checkLimits('tenant-1', 'my-agent');
      await new Promise((r) => setTimeout(r, 50));
      expect(mockSendThresholdAlert).not.toHaveBeenCalled();
    });

    it('logs notification even when no email is resolved', async () => {
      mockResolveUserEmail.mockResolvedValue(null);
      await service.checkLimits('tenant-1', 'my-agent');
      await new Promise((r) => setTimeout(r, 50));
      expect(mockSendThresholdAlert).not.toHaveBeenCalled();
      expect(mockInsertLog).toHaveBeenCalled();
    });

    it('logs notification even when email send fails', async () => {
      mockSendThresholdAlert.mockResolvedValue(false);
      mockResolveUserEmail.mockResolvedValue('test@example.com');
      await service.checkLimits('tenant-1', 'my-agent');
      await new Promise((r) => setTimeout(r, 50));
      expect(mockSendThresholdAlert).toHaveBeenCalled();
      expect(mockInsertLog).toHaveBeenCalled();
    });

    it('uses email provider config when available', async () => {
      const providerConfig = {
        provider: 'resend',
        apiKey: 'key',
        notificationEmail: 'custom@example.com',
      };
      mockGetFullConfig.mockResolvedValue(providerConfig);
      mockResolveUserEmail.mockResolvedValue('custom@example.com');
      await service.checkLimits('tenant-1', 'my-agent');
      await new Promise((r) => setTimeout(r, 50));
      expect(mockSendThresholdAlert).toHaveBeenCalledWith(
        'custom@example.com',
        expect.anything(),
        providerConfig,
      );
    });

    it('suppresses email when resolveUserEmail returns null', async () => {
      mockResolveUserEmail.mockResolvedValue(null);
      await service.checkLimits('tenant-1', 'my-agent');
      await new Promise((r) => setTimeout(r, 50));
      expect(mockSendThresholdAlert).not.toHaveBeenCalled();
    });

    it('catches and logs error in notifyLimitExceeded', async () => {
      const loggerSpy = jest.spyOn(service['logger'], 'error').mockImplementation();
      mockHasAlreadySent.mockRejectedValue(new Error('DB down'));
      await service.checkLimits('tenant-1', 'my-agent');
      await new Promise((r) => setTimeout(r, 50));
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send block notification'),
      );
      loggerSpy.mockRestore();
    });

    it('includes period field in returned LimitExceeded', async () => {
      const result = await service.checkLimits('tenant-1', 'my-agent');
      expect(result).not.toBeNull();
      expect(result!.period).toBe('day');
    });

    it('passes notificationEmail from provider config to resolveUserEmail', async () => {
      const providerConfig = { notificationEmail: 'local-user@real.com' };
      mockGetFullConfig.mockResolvedValue(providerConfig);
      mockResolveUserEmail.mockResolvedValue('local-user@real.com');

      await service.checkLimits('tenant-1', 'my-agent');
      await new Promise((r) => setTimeout(r, 50));

      expect(mockResolveUserEmail).toHaveBeenCalledWith('u1', 'local-user@real.com');
      expect(mockSendThresholdAlert).toHaveBeenCalledWith(
        'local-user@real.com',
        expect.objectContaining({ agentName: 'my-agent' }),
        providerConfig,
      );
    });
  });
});
