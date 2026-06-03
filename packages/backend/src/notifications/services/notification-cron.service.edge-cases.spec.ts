/**
 * Edge-case tests for NotificationCronService — complements
 * notification-cron.service.spec.ts. Split out to stay under the 300-line cap.
 *
 * Pins the non-atomic period-boundary race: checkThresholds() computes
 * (periodStart, periodEnd) once for consumption, then evaluateRule() calls
 * computePeriodBoundaries() again for dedup + insertLog. If wall-clock crosses
 * a period boundary between the two, the dedup key written to notification_logs
 * no longer matches the period whose consumption was measured.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { NotificationCronService } from './notification-cron.service';
import { NotificationRulesService } from './notification-rules.service';
import { NotificationEmailService } from './notification-email.service';
import { EmailProviderConfigService } from './email-provider-config.service';
import { NotificationLogService } from './notification-log.service';
import { ManifestRuntimeService } from '../../common/services/manifest-runtime.service';

const baseRule = {
  id: 'rule-1',
  tenant_id: 'tenant-1',
  agent_name: 'my-agent',
  user_id: 'user-1',
  metric_type: 'tokens' as const,
  threshold: 100_000,
  period: 'day' as const,
};

describe('NotificationCronService — edge cases', () => {
  let service: NotificationCronService;
  let mockGetAllActiveRules: jest.Mock;
  let mockGetActiveRulesForUser: jest.Mock;
  let mockGetConsumption: jest.Mock;
  let mockSendThresholdAlert: jest.Mock;
  let mockHasAlreadySent: jest.Mock;
  let mockInsertLog: jest.Mock;
  let mockResolveUserEmail: jest.Mock;
  let mockGetFullConfig: jest.Mock;

  beforeEach(async () => {
    mockGetAllActiveRules = jest.fn();
    mockGetActiveRulesForUser = jest.fn();
    mockGetConsumption = jest.fn();
    mockSendThresholdAlert = jest.fn().mockResolvedValue(true);
    mockHasAlreadySent = jest.fn().mockResolvedValue(false);
    mockInsertLog = jest.fn().mockResolvedValue(undefined);
    mockResolveUserEmail = jest.fn().mockResolvedValue('user@test.com');
    mockGetFullConfig = jest.fn().mockResolvedValue(null);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationCronService,
        {
          provide: NotificationRulesService,
          useValue: {
            getAllActiveRules: mockGetAllActiveRules,
            getActiveRulesForUser: mockGetActiveRulesForUser,
            getConsumption: mockGetConsumption,
          },
        },
        {
          provide: NotificationEmailService,
          useValue: { sendThresholdAlert: mockSendThresholdAlert },
        },
        {
          provide: EmailProviderConfigService,
          useValue: { getFullConfig: mockGetFullConfig },
        },
        {
          provide: NotificationLogService,
          useValue: {
            hasAlreadySent: mockHasAlreadySent,
            insertLog: mockInsertLog,
            resolveUserEmail: mockResolveUserEmail,
          },
        },
        {
          provide: ManifestRuntimeService,
          useValue: { getAuthBaseUrl: jest.fn().mockReturnValue('http://localhost:3001') },
        },
      ],
    }).compile();

    service = module.get(NotificationCronService);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  /* ── 1. Non-atomic period boundary (documented race) ───────────── */

  describe('period boundary drift between consumption fetch and dedup check', () => {
    it('passes the SAME periodStart string to hasAlreadySent and insertLog when wall-clock is steady', async () => {
      // Pin time so both computePeriodBoundaries() calls inside checkThresholds()
      // observe the identical Date.now(). This is the happy path: dedup key and
      // log row agree on period_start. Hardcoded to mid-day to avoid boundary noise.
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-06-15T12:00:00Z'));

      mockGetAllActiveRules.mockResolvedValue([baseRule]);
      mockGetConsumption.mockResolvedValue(150_000);

      const result = await service.checkThresholds();
      expect(result).toBe(1);

      // hasAlreadySent (line 107) reads its own computePeriodBoundaries result.
      // insertLog (line 116) does too. With time pinned, both align with the
      // value passed to getConsumption (line 63 inside checkThresholds).
      expect(mockHasAlreadySent).toHaveBeenCalledTimes(1);
      const dedupPeriodStart = mockHasAlreadySent.mock.calls[0][1];
      const consumptionPeriodStart = mockGetConsumption.mock.calls[0][3];
      const insertedPeriodStart = mockInsertLog.mock.calls[0][0].periodStart;

      expect(dedupPeriodStart).toBe(consumptionPeriodStart);
      expect(insertedPeriodStart).toBe(consumptionPeriodStart);
      // Day period: midnight UTC. Fixed expectation.
      expect(consumptionPeriodStart).toBe('2026-06-15 00:00:00');
    });

    it('emits an "hour" period that recomputes consistently within the same tick', async () => {
      // Fixed timestamp away from hour boundary so the two computePeriodBoundaries
      // calls cannot diverge. This proves the dedup key is reproducible under
      // steady time — the failure mode is *clock drift between the two calls*.
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-06-15T12:30:00Z'));

      const hourRule = { ...baseRule, period: 'hour' as const };
      mockGetAllActiveRules.mockResolvedValue([hourRule]);
      mockGetConsumption.mockResolvedValue(150_000);

      await service.checkThresholds();

      const consumptionPeriodStart = mockGetConsumption.mock.calls[0][3];
      const dedupPeriodStart = mockHasAlreadySent.mock.calls[0][1];
      // hour period: previous hour boundary (UTC).
      expect(consumptionPeriodStart).toBe('2026-06-15 11:00:00');
      expect(dedupPeriodStart).toBe(consumptionPeriodStart);
    });

    it('demonstrates the gap: if clock crosses an hour boundary between the two calls, dedup key drifts', async () => {
      // Start 1s before an hour boundary so the FIRST computePeriodBoundaries
      // (inside checkThresholds, line 63) sees 11:00 as the previous-hour start.
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-06-15T11:59:59Z'));

      const hourRule = { ...baseRule, period: 'hour' as const };
      mockGetAllActiveRules.mockResolvedValue([hourRule]);

      // Advance the clock past the hour boundary before evaluateRule() runs its own
      // computePeriodBoundaries(). After advance, "previous hour" rolls forward,
      // so periodStart shifts to the new hour.
      mockGetConsumption.mockImplementation(async () => {
        jest.setSystemTime(new Date('2026-06-15T12:00:01Z'));
        return 150_000;
      });

      await service.checkThresholds();

      const consumptionPeriodStart = mockGetConsumption.mock.calls[0][3];
      const dedupPeriodStart = mockHasAlreadySent.mock.calls[0][1];
      const insertedPeriodStart = mockInsertLog.mock.calls[0][0].periodStart;

      // The drift is real and observable: consumption was measured against the
      // 10:00 start, but the dedup key + log row were written under the 11:00 start.
      // This documents the current behaviour. When the source is refactored to
      // capture periodStart once (e.g. pass it from checkThresholds into
      // evaluateRule, or use a fixed epoch-modulo derivation), update these
      // expectations to equality.
      expect(consumptionPeriodStart).toBe('2026-06-15 10:00:00');
      expect(dedupPeriodStart).toBe('2026-06-15 11:00:00');
      expect(insertedPeriodStart).toBe('2026-06-15 11:00:00');
      expect(dedupPeriodStart).not.toBe(consumptionPeriodStart);
    });
  });

  /* ── 2. Grouping: shared consumption query across rules ────────── */

  describe('rule grouping by (tenant, agent, period)', () => {
    it('fetches consumption ONCE per (group, metric) even with many same-group rules', async () => {
      const r1 = { ...baseRule, id: 'r1', threshold: 100_000 };
      const r2 = { ...baseRule, id: 'r2', threshold: 200_000 };
      const r3 = { ...baseRule, id: 'r3', threshold: 50_000 };
      mockGetAllActiveRules.mockResolvedValue([r1, r2, r3]);
      mockGetConsumption.mockResolvedValue(75_000);

      const result = await service.checkThresholds();

      // Only r3 (50k threshold) trips at consumption=75k. r1 and r2 do not.
      expect(result).toBe(1);
      // Three rules, same group, same metric — single getConsumption call.
      expect(mockGetConsumption).toHaveBeenCalledTimes(1);
    });

    it('fetches consumption per metric type within the same group', async () => {
      const tokensRule = {
        ...baseRule,
        id: 'tk',
        metric_type: 'tokens' as const,
        threshold: 50_000,
      };
      const costRule = { ...baseRule, id: 'cs', metric_type: 'cost' as const, threshold: 1.0 };
      mockGetAllActiveRules.mockResolvedValue([tokensRule, costRule]);
      mockGetConsumption.mockImplementation(async (_t: string, _a: string, metric: string) =>
        metric === 'tokens' ? 100_000 : 5.0,
      );

      const result = await service.checkThresholds();

      expect(result).toBe(2);
      // One fetch per metric type, same group.
      expect(mockGetConsumption).toHaveBeenCalledTimes(2);
      const metrics = mockGetConsumption.mock.calls.map((c) => c[2]).sort();
      expect(metrics).toEqual(['cost', 'tokens']);
    });

    it('separates consumption queries when rules differ in (agent, period)', async () => {
      const ruleDay = { ...baseRule, id: 'd1', period: 'day' as const };
      const ruleHour = { ...baseRule, id: 'h1', period: 'hour' as const };
      const ruleOtherAgent = { ...baseRule, id: 'o1', agent_name: 'other-agent' };
      mockGetAllActiveRules.mockResolvedValue([ruleDay, ruleHour, ruleOtherAgent]);
      mockGetConsumption.mockResolvedValue(10);

      await service.checkThresholds();

      // Three distinct groups → three getConsumption calls.
      expect(mockGetConsumption).toHaveBeenCalledTimes(3);
    });
  });

  /* ── 3. Per-user invocation path ───────────────────────────────── */

  describe('checkThresholds(userId)', () => {
    it('uses getActiveRulesForUser when userId is provided', async () => {
      mockGetActiveRulesForUser.mockResolvedValue([baseRule]);
      mockGetConsumption.mockResolvedValue(200_000);

      const result = await service.checkThresholds('user-1');

      expect(result).toBe(1);
      expect(mockGetActiveRulesForUser).toHaveBeenCalledWith('user-1');
      expect(mockGetAllActiveRules).not.toHaveBeenCalled();
    });

    it('returns 0 when per-user query yields no rules', async () => {
      mockGetActiveRulesForUser.mockResolvedValue([]);

      const result = await service.checkThresholds('user-1');

      expect(result).toBe(0);
      expect(mockGetConsumption).not.toHaveBeenCalled();
    });
  });

  /* ── 4. Cost metric path ───────────────────────────────────────── */

  describe('cost metric', () => {
    it('triggers for cost metric at boundary (consumption == threshold)', async () => {
      const costRule = {
        ...baseRule,
        id: 'cost-rule',
        metric_type: 'cost' as const,
        threshold: 12.5,
        period: 'month' as const,
      };
      mockGetAllActiveRules.mockResolvedValue([costRule]);
      // Exact equality must trip (actual >= threshold).
      mockGetConsumption.mockResolvedValue(12.5);

      const result = await service.checkThresholds();

      expect(result).toBe(1);
      expect(mockInsertLog).toHaveBeenCalledWith(
        expect.objectContaining({
          ruleId: 'cost-rule',
          actualValue: 12.5,
          thresholdValue: 12.5,
          metricType: 'cost',
        }),
      );
    });

    it('does not trigger when cost falls 0.01 below threshold', async () => {
      const costRule = {
        ...baseRule,
        metric_type: 'cost' as const,
        threshold: 10.0,
        period: 'month' as const,
      };
      mockGetAllActiveRules.mockResolvedValue([costRule]);
      mockGetConsumption.mockResolvedValue(9.99);

      const result = await service.checkThresholds();
      expect(result).toBe(0);
      expect(mockInsertLog).not.toHaveBeenCalled();
    });
  });
});
