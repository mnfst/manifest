import { Test, TestingModule } from '@nestjs/testing';
import { NotificationCronService } from './notification-cron.service';
import { NotificationRulesService } from './notification-rules.service';
import { NotificationEmailService } from './notification-email.service';
import { EmailProviderConfigService } from './email-provider-config.service';
import { NotificationLogService } from './notification-log.service';
import { ManifestRuntimeService } from '../../common/services/manifest-runtime.service';

const activeRule = {
  id: 'rule-1',
  tenant_id: 'tenant-1',
  agent_name: 'my-agent',
  user_id: 'user-1',
  metric_type: 'tokens' as const,
  threshold: 100000,
  period: 'day' as const,
};

describe('NotificationCronService', () => {
  let service: NotificationCronService;
  let mockGetAllActiveRules: jest.Mock;
  let mockGetConsumption: jest.Mock;
  let mockSendThresholdAlert: jest.Mock;
  let mockHasAlreadySent: jest.Mock;
  let mockInsertLog: jest.Mock;
  let mockResolveUserEmail: jest.Mock;
  let mockGetFullConfig: jest.Mock;
  let mockRuntime: { getAuthBaseUrl: jest.Mock };

  beforeEach(async () => {
    mockGetAllActiveRules = jest.fn();
    mockGetConsumption = jest.fn();
    mockSendThresholdAlert = jest.fn().mockResolvedValue(true);
    mockHasAlreadySent = jest.fn().mockResolvedValue(false);
    mockInsertLog = jest.fn().mockResolvedValue(undefined);
    mockResolveUserEmail = jest.fn().mockResolvedValue(null);
    mockGetFullConfig = jest.fn().mockResolvedValue(null);
    mockRuntime = {
      getAuthBaseUrl: jest.fn().mockReturnValue('http://localhost:3001'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationCronService,
        {
          provide: NotificationRulesService,
          useValue: {
            getAllActiveRules: mockGetAllActiveRules,
            getActiveRulesForUser: jest.fn().mockResolvedValue([]),
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
        { provide: ManifestRuntimeService, useValue: mockRuntime },
      ],
    }).compile();

    service = module.get(NotificationCronService);
  });

  it('returns 0 when no active rules', async () => {
    mockGetAllActiveRules.mockResolvedValue([]);
    const result = await service.checkThresholds();
    expect(result).toBe(0);
  });

  it('onModuleInit calls checkThresholds for startup catch-up', async () => {
    mockGetAllActiveRules.mockResolvedValue([]);
    const spy = jest.spyOn(service, 'checkThresholds');
    await service.onModuleInit();
    expect(spy).toHaveBeenCalled();
  });

  it('onModuleInit does not throw on error', async () => {
    mockGetAllActiveRules.mockRejectedValue(new Error('DB not ready'));
    await expect(service.onModuleInit()).resolves.not.toThrow();
  });

  it('onModuleInit logs startup catch-up count when triggers occur', async () => {
    mockGetAllActiveRules.mockResolvedValue([activeRule]);
    mockGetConsumption.mockResolvedValue(200000);
    mockResolveUserEmail.mockResolvedValue('user@test.com');

    const loggerSpy = jest.spyOn(service['logger'], 'log').mockImplementation();
    await service.onModuleInit();

    expect(loggerSpy).toHaveBeenCalledWith(
      expect.stringContaining('Startup catch-up: 1 notification(s) triggered'),
    );
    loggerSpy.mockRestore();
  });

  it('skips rule when consumption fetch fails', async () => {
    mockGetAllActiveRules.mockResolvedValue([activeRule]);
    mockGetConsumption.mockRejectedValue(new Error('DB timeout'));

    const loggerSpy = jest.spyOn(service['logger'], 'error').mockImplementation();
    const result = await service.checkThresholds();
    expect(result).toBe(0);
    expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('Error fetching consumption'));
    loggerSpy.mockRestore();
  });

  it('skips rule when already notified for current period (dedup)', async () => {
    mockGetAllActiveRules.mockResolvedValue([activeRule]);
    mockGetConsumption.mockResolvedValue(200000);
    mockHasAlreadySent.mockResolvedValue(true);

    const result = await service.checkThresholds();
    expect(result).toBe(0);
  });

  it('does not trigger when consumption is below threshold', async () => {
    mockGetAllActiveRules.mockResolvedValue([activeRule]);
    mockGetConsumption.mockResolvedValue(50000);

    const result = await service.checkThresholds();
    expect(result).toBe(0);
    expect(mockSendThresholdAlert).not.toHaveBeenCalled();
  });

  it('triggers notification when consumption exceeds threshold', async () => {
    mockGetAllActiveRules.mockResolvedValue([activeRule]);
    mockGetConsumption.mockResolvedValue(150000);
    mockResolveUserEmail.mockResolvedValue('user@test.com');

    const result = await service.checkThresholds();
    expect(result).toBe(1);
    expect(mockInsertLog).toHaveBeenCalledWith(
      expect.objectContaining({
        ruleId: 'rule-1',
        actualValue: 150000,
        thresholdValue: 100000,
        metricType: 'tokens',
        agentName: 'my-agent',
      }),
    );
    expect(mockSendThresholdAlert).toHaveBeenCalledWith(
      'user@test.com',
      expect.objectContaining({
        agentName: 'my-agent',
        metricType: 'tokens',
        threshold: 100000,
        actualValue: 150000,
        alertType: 'soft',
      }),
      undefined,
    );
  });

  it('still records log when user email not found', async () => {
    mockGetAllActiveRules.mockResolvedValue([activeRule]);
    mockGetConsumption.mockResolvedValue(200000);
    mockResolveUserEmail.mockResolvedValue(null);

    const result = await service.checkThresholds();
    expect(result).toBe(1);
    expect(mockSendThresholdAlert).not.toHaveBeenCalled();
    expect(mockInsertLog).toHaveBeenCalled();
  });

  it('records log even when email send fails', async () => {
    mockGetAllActiveRules.mockResolvedValue([activeRule]);
    mockGetConsumption.mockResolvedValue(200000);
    mockResolveUserEmail.mockResolvedValue('user@test.com');
    mockSendThresholdAlert.mockResolvedValue(false);

    const result = await service.checkThresholds();
    expect(result).toBe(1);
    expect(mockInsertLog).toHaveBeenCalled();
  });

  it('handles multiple rules and counts only triggered ones', async () => {
    const rule2 = { ...activeRule, id: 'rule-2', threshold: 500000 };
    mockGetAllActiveRules.mockResolvedValue([activeRule, rule2]);
    mockGetConsumption.mockResolvedValueOnce(150000);
    mockResolveUserEmail.mockResolvedValue('user@test.com');

    const result = await service.checkThresholds();
    expect(result).toBe(1);
  });

  it('triggers notification for hourly period', async () => {
    const hourlyRule = { ...activeRule, id: 'rule-hour', period: 'hour' as const };
    mockGetAllActiveRules.mockResolvedValue([hourlyRule]);
    mockGetConsumption.mockResolvedValue(150000);
    mockResolveUserEmail.mockResolvedValue('user@test.com');

    const result = await service.checkThresholds();
    expect(result).toBe(1);
    expect(mockSendThresholdAlert).toHaveBeenCalled();
  });

  it('triggers notification for weekly period', async () => {
    const weeklyRule = { ...activeRule, id: 'rule-week', period: 'week' as const };
    mockGetAllActiveRules.mockResolvedValue([weeklyRule]);
    mockGetConsumption.mockResolvedValue(150000);
    mockResolveUserEmail.mockResolvedValue('user@test.com');

    const result = await service.checkThresholds();
    expect(result).toBe(1);
  });

  it('triggers notification for monthly period', async () => {
    const monthlyRule = { ...activeRule, id: 'rule-month', period: 'month' as const };
    mockGetAllActiveRules.mockResolvedValue([monthlyRule]);
    mockGetConsumption.mockResolvedValue(150000);
    mockResolveUserEmail.mockResolvedValue('user@test.com');

    const result = await service.checkThresholds();
    expect(result).toBe(1);
  });

  it('continues processing remaining rules when one throws', async () => {
    const rule2 = { ...activeRule, id: 'rule-2' };
    mockGetAllActiveRules.mockResolvedValue([activeRule, rule2]);
    mockGetConsumption.mockResolvedValueOnce(200000);
    mockResolveUserEmail.mockResolvedValue('user@test.com');

    mockHasAlreadySent.mockRejectedValueOnce(new Error('DB down')).mockResolvedValueOnce(false);

    const result = await service.checkThresholds();
    expect(result).toBe(1);
  });

  it('passes provider config notificationEmail to resolveUserEmail', async () => {
    const providerConfig = { notificationEmail: 'custom@test.com' };
    mockGetFullConfig.mockResolvedValue(providerConfig);
    mockGetAllActiveRules.mockResolvedValue([activeRule]);
    mockGetConsumption.mockResolvedValue(200000);
    mockResolveUserEmail.mockResolvedValue('custom@test.com');

    await service.checkThresholds();
    expect(mockResolveUserEmail).toHaveBeenCalledWith('user-1', 'custom@test.com');
  });

  it('warns when email send fails', async () => {
    mockGetAllActiveRules.mockResolvedValue([activeRule]);
    mockGetConsumption.mockResolvedValue(200000);
    mockResolveUserEmail.mockResolvedValue('user@test.com');
    mockSendThresholdAlert.mockResolvedValue(false);

    const loggerSpy = jest.spyOn(service['logger'], 'warn').mockImplementation();
    await service.checkThresholds();
    expect(loggerSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to send alert for rule'),
    );
    loggerSpy.mockRestore();
  });

  it('warns when no email found for user', async () => {
    mockGetAllActiveRules.mockResolvedValue([activeRule]);
    mockGetConsumption.mockResolvedValue(200000);
    mockResolveUserEmail.mockResolvedValue(null);

    const loggerSpy = jest.spyOn(service['logger'], 'warn').mockImplementation();
    await service.checkThresholds();
    expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('No email found for user'));
    loggerSpy.mockRestore();
  });
});
