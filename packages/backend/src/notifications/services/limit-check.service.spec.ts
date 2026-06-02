import { Subject } from 'rxjs';
import { LimitCheckService } from './limit-check.service';
import { NotificationRulesService } from './notification-rules.service';
import { NotificationEmailService } from './notification-email.service';
import { EmailProviderConfigService } from './email-provider-config.service';
import { NotificationLogService } from './notification-log.service';
import { IngestEventBusService, IngestEvent } from '../../common/services/ingest-event-bus.service';
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
  let ingestSubject: Subject<IngestEvent>;
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

    ingestSubject = new Subject<IngestEvent>();
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

  it('evicts the writing user consumption cache when ingest event fires', async () => {
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

    // Simulate OTLP ingest event for the same user that owns the rule.
    ingestSubject.next({ userId: 'u1', kind: 'message' });

    await service.checkLimits('tenant-1', 'my-agent');
    expect(mockGetConsumption).toHaveBeenCalledTimes(2);
  });

  it('ingest event for one user does NOT evict another user consumption cache', async () => {
    // Two distinct tenants/users, each with its own block rule.
    mockGetActiveBlockRules.mockImplementation((tenantId: string) =>
      Promise.resolve([
        {
          id: `r-${tenantId}`,
          tenant_id: tenantId,
          agent_name: 'my-agent',
          user_id: tenantId === 'tenant-A' ? 'user-A' : 'user-B',
          metric_type: 'tokens',
          threshold: 100000,
          period: 'day',
        },
      ]),
    );
    mockGetConsumption.mockResolvedValue(5000);

    await service.checkLimits('tenant-A', 'my-agent');
    await service.checkLimits('tenant-B', 'my-agent');
    expect(mockGetConsumption).toHaveBeenCalledTimes(2);

    // Ingest event for user-A only.
    ingestSubject.next({ userId: 'user-A', kind: 'message' });

    await service.checkLimits('tenant-A', 'my-agent'); // re-fetched (evicted)
    await service.checkLimits('tenant-B', 'my-agent'); // still cached
    expect(mockGetConsumption).toHaveBeenCalledTimes(3);
  });

  it('consumption cache entries expire after the TTL even without an ingest event', async () => {
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

    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockReturnValue(1_000_000);
    await service.checkLimits('tenant-1', 'my-agent');
    expect(mockGetConsumption).toHaveBeenCalledTimes(1);

    // Advance past the 60s TTL — the cached entry is now stale.
    nowSpy.mockReturnValue(1_000_000 + 61_000);
    await service.checkLimits('tenant-1', 'my-agent');
    expect(mockGetConsumption).toHaveBeenCalledTimes(2);

    nowSpy.mockRestore();
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

  it('reuses an existing user bucket for a second metric/period entry', async () => {
    // One rule with a long period and one with a short period → two distinct
    // inner keys under the same user bucket. The second insert must reuse the
    // already-created bucket rather than overwrite it.
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
      {
        id: 'r2',
        tenant_id: 'tenant-1',
        agent_name: 'my-agent',
        user_id: 'u1',
        metric_type: 'cost',
        threshold: 100,
        period: 'month',
      },
    ]);
    mockGetConsumption.mockResolvedValue(0);

    await service.checkLimits('tenant-1', 'my-agent');

    const consumptionCache = (service as any).consumptionCache as Map<string, Map<string, unknown>>;
    // Both rules' consumption entries live in the single 'u1' bucket.
    expect(consumptionCache.size).toBe(1);
    expect(consumptionCache.get('u1')!.size).toBe(2);
  });

  it('drops a user bucket whose entries have all expired on the next lookup', async () => {
    const consumptionCache = (service as any).consumptionCache as Map<string, Map<string, unknown>>;
    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockReturnValue(1_000_000);

    // Seed a stale bucket for an unrelated user that will be swept on lookup.
    const staleBucket = new Map<string, unknown>();
    staleBucket.set('tenant-x:agent-x:tokens:2026-01-01', {
      data: 1,
      expiresAt: 1_000_000 + 10,
    });
    consumptionCache.set('user-stale', staleBucket);

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
    mockGetConsumption.mockResolvedValue(0);

    // Jump past the stale bucket's TTL so evictExpiredConsumption drops it.
    nowSpy.mockReturnValue(1_000_000 + 999_999);
    await service.checkLimits('tenant-1', 'my-agent');

    expect(consumptionCache.has('user-stale')).toBe(false);
    nowSpy.mockRestore();
  });

  it('invalidateCache deletes only matching inner entries and keeps the bucket', () => {
    const consumptionCache = (service as any).consumptionCache as Map<
      string,
      Map<string, { data: number; expiresAt: number }>
    >;
    const now = Date.now();
    const bucket = new Map<string, { data: number; expiresAt: number }>();
    // One entry scoped to the agent we invalidate, one to a different agent.
    bucket.set('tenant-1:agent-a:tokens:2026-01-01', { data: 1, expiresAt: now + 999_999 });
    bucket.set('tenant-1:agent-b:tokens:2026-01-01', { data: 2, expiresAt: now + 999_999 });
    consumptionCache.set('u1', bucket);

    service.invalidateCache('tenant-1', 'agent-a');

    // The agent-a entry is gone, agent-b survives, and the bucket is retained.
    expect(bucket.has('tenant-1:agent-a:tokens:2026-01-01')).toBe(false);
    expect(bucket.has('tenant-1:agent-b:tokens:2026-01-01')).toBe(true);
    expect(consumptionCache.has('u1')).toBe(true);
  });

  it('invalidateCache drops an emptied user bucket', async () => {
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
    const consumptionCache = (service as any).consumptionCache as Map<string, unknown>;
    expect(consumptionCache.has('u1')).toBe(true);

    service.invalidateCache('tenant-1', 'my-agent');

    // The single entry was removed, so the now-empty 'u1' bucket is dropped.
    expect(consumptionCache.has('u1')).toBe(false);
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
    const consumptionCache = (service as any).consumptionCache as Map<string, Map<string, unknown>>;
    const now = Date.now();

    // Fill the oldest user bucket to exactly MAX_CACHE_SIZE so the next insert
    // (under a new user) trips the total-size guard and evicts from the oldest.
    const oldestBucket = new Map<string, unknown>();
    for (let i = 0; i < 10_000; i++) {
      oldestBucket.set(`t-${i}:a-${i}:tokens:2026-01-01`, {
        data: 0,
        expiresAt: now + 999_999,
      });
    }
    consumptionCache.set('user-old', oldestBucket);
    expect(oldestBucket.size).toBe(10_000);

    mockGetActiveBlockRules.mockResolvedValue([
      {
        id: 'r1',
        tenant_id: 'tenant-new',
        agent_name: 'agent-new',
        user_id: 'user-new',
        metric_type: 'tokens',
        threshold: 100000,
        period: 'day',
      },
    ]);
    mockGetConsumption.mockResolvedValue(0);

    await service.checkLimits('tenant-new', 'agent-new');

    // The first filler entry in the oldest bucket should have been evicted.
    expect(oldestBucket.has('t-0:a-0:tokens:2026-01-01')).toBe(false);
    // The new user's consumption was still cached under its own bucket.
    expect(consumptionCache.has('user-new')).toBe(true);
    expect(consumptionCache.get('user-new')!.size).toBe(1);
  });

  it('drops an emptied user bucket when its last entry is evicted by size', async () => {
    const consumptionCache = (service as any).consumptionCache as Map<string, Map<string, unknown>>;
    const now = Date.now();

    // Oldest bucket holds a single entry; total still reaches MAX via a second
    // bucket so the size guard fires and empties the oldest bucket entirely.
    const oldestBucket = new Map<string, unknown>();
    oldestBucket.set('t-old:a-old:tokens:2026-01-01', { data: 0, expiresAt: now + 999_999 });
    consumptionCache.set('user-old', oldestBucket);

    const fillerBucket = new Map<string, unknown>();
    for (let i = 0; i < 9_999; i++) {
      fillerBucket.set(`t-${i}:a-${i}:tokens:2026-01-01`, { data: 0, expiresAt: now + 999_999 });
    }
    consumptionCache.set('user-filler', fillerBucket);

    mockGetActiveBlockRules.mockResolvedValue([
      {
        id: 'r1',
        tenant_id: 'tenant-new',
        agent_name: 'agent-new',
        user_id: 'user-new',
        metric_type: 'tokens',
        threshold: 100000,
        period: 'day',
      },
    ]);
    mockGetConsumption.mockResolvedValue(0);

    await service.checkLimits('tenant-new', 'agent-new');

    // The oldest bucket had its only entry evicted and was removed.
    expect(consumptionCache.has('user-old')).toBe(false);
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
