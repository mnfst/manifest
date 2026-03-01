import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from './notifications.controller';
import { NotificationRulesService } from './services/notification-rules.service';
import { EmailProviderConfigService } from './services/email-provider-config.service';
import { NotificationCronService } from './services/notification-cron.service';
import { LimitCheckService } from './services/limit-check.service';

const mockUser = { id: 'user-1', email: 'test@test.com', name: 'Test' } as never;

const mockRule = {
  id: 'rule-1',
  tenant_id: 't-1',
  agent_id: 'a-1',
  agent_name: 'my-agent',
  user_id: 'user-1',
  metric_type: 'tokens',
  threshold: 100000,
  period: 'day',
  is_active: 1,
  created_at: '2026-01-01 00:00:00',
  updated_at: '2026-01-01 00:00:00',
};

describe('NotificationsController', () => {
  let module: TestingModule;
  let controller: NotificationsController;
  let rulesService: jest.Mocked<NotificationRulesService>;
  let emailProviderConfigService: jest.Mocked<EmailProviderConfigService>;

  beforeEach(async () => {
    const mockRulesService = {
      listRules: jest.fn().mockResolvedValue([mockRule]),
      createRule: jest.fn().mockResolvedValue(mockRule),
      updateRule: jest.fn().mockResolvedValue({ ...mockRule, is_active: 0 }),
      deleteRule: jest.fn().mockResolvedValue(undefined),
      getRule: jest.fn().mockResolvedValue(mockRule),
    };

    const mockEmailProviderConfigService = {
      getConfig: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue({ provider: 'resend', domain: null, keyPrefix: 're_test1', is_active: true, notificationEmail: null }),
      remove: jest.fn().mockResolvedValue(undefined),
      testConfig: jest.fn().mockResolvedValue({ success: true }),
      testSavedConfig: jest.fn().mockResolvedValue({ success: true }),
      getNotificationEmail: jest.fn().mockResolvedValue(null),
      setNotificationEmail: jest.fn().mockResolvedValue(undefined),
    };

    const mockCronService = {
      checkThresholds: jest.fn().mockResolvedValue(2),
    };

    const mockLimitCheck = {
      invalidateCache: jest.fn(),
    };

    module = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        { provide: NotificationRulesService, useValue: mockRulesService },
        { provide: EmailProviderConfigService, useValue: mockEmailProviderConfigService },
        { provide: NotificationCronService, useValue: mockCronService },
        { provide: LimitCheckService, useValue: mockLimitCheck },
      ],
    }).compile();

    controller = module.get(NotificationsController);
    rulesService = module.get(NotificationRulesService);
    emailProviderConfigService = module.get(EmailProviderConfigService);
  });

  it('lists rules for an agent', async () => {
    const result = await controller.listRules('my-agent', mockUser);
    expect(rulesService.listRules).toHaveBeenCalledWith('user-1', 'my-agent');
    expect(result).toEqual([mockRule]);
  });

  it('creates a rule', async () => {
    const dto = { agent_name: 'my-agent', metric_type: 'tokens' as const, threshold: 100000, period: 'day' as const };
    const result = await controller.createRule(dto, mockUser);
    expect(rulesService.createRule).toHaveBeenCalledWith('user-1', dto);
    expect(result).toEqual(mockRule);
  });

  it('updates a rule', async () => {
    const dto = { is_active: false };
    const result = await controller.updateRule('rule-1', dto, mockUser);
    expect(rulesService.updateRule).toHaveBeenCalledWith('user-1', 'rule-1', dto);
    expect(result.is_active).toBe(0);
  });

  it('deletes a rule', async () => {
    const result = await controller.deleteRule('rule-1', mockUser);
    expect(rulesService.deleteRule).toHaveBeenCalledWith('user-1', 'rule-1');
    expect(result).toEqual({ deleted: true });
  });

  it('returns configured: false when no provider', async () => {
    const result = await controller.getEmailProvider(mockUser);
    expect(emailProviderConfigService.getConfig).toHaveBeenCalledWith('user-1');
    expect(result).toEqual({ configured: false });
  });

  it('tests email provider config', async () => {
    const dto = { provider: 'resend', apiKey: 're_testkey123', domain: 'example.com', to: 'test@test.com' } as never;
    const result = await controller.testEmailProvider(mockUser, dto);
    expect(emailProviderConfigService.testConfig).toHaveBeenCalledWith(
      { provider: 'resend', apiKey: 're_testkey123', domain: 'example.com' },
      'test@test.com',
    );
    expect(result).toEqual({ success: true });
  });

  it('tests sendgrid provider config without domain', async () => {
    const dto = { provider: 'sendgrid', apiKey: 'SG.testkey123456', to: 'test@test.com' } as never;
    const result = await controller.testEmailProvider(mockUser, dto);
    expect(emailProviderConfigService.testConfig).toHaveBeenCalledWith(
      { provider: 'sendgrid', apiKey: 'SG.testkey123456', domain: undefined },
      'test@test.com',
    );
    expect(result).toEqual({ success: true });
  });

  it('triggers manual notification check', async () => {
    const cronService = module.get(NotificationCronService) as jest.Mocked<NotificationCronService>;
    const result = await controller.triggerCheck();
    expect(cronService.checkThresholds).toHaveBeenCalled();
    expect(result).toEqual({ triggered: 2, message: '2 notification(s) triggered' });
  });

  it('returns null notification email when not set', async () => {
    const result = await controller.getNotificationEmail(mockUser);
    expect(emailProviderConfigService.getNotificationEmail).toHaveBeenCalledWith('user-1');
    expect(result).toEqual({ email: null });
  });

  it('saves notification email', async () => {
    const result = await controller.setNotificationEmail(mockUser, { email: 'alerts@test.com' });
    expect(emailProviderConfigService.setNotificationEmail).toHaveBeenCalledWith('user-1', 'alerts@test.com');
    expect(result).toEqual({ saved: true });
  });

  it('saves email provider config', async () => {
    const dto = { provider: 'resend', apiKey: 're_testkey123456' } as never;
    const result = await controller.setEmailProvider(mockUser, dto);
    expect(emailProviderConfigService.upsert).toHaveBeenCalledWith('user-1', dto);
    expect(result.provider).toBe('resend');
  });

  it('saves email provider config without API key (keep existing)', async () => {
    const dto = { provider: 'resend', notificationEmail: 'new@test.com' } as never;
    const result = await controller.setEmailProvider(mockUser, dto);
    expect(emailProviderConfigService.upsert).toHaveBeenCalledWith('user-1', dto);
    expect(result.provider).toBe('resend');
  });

  it('removes email provider config', async () => {
    const result = await controller.removeEmailProvider(mockUser);
    expect(emailProviderConfigService.remove).toHaveBeenCalledWith('user-1');
    expect(result).toEqual({ ok: true });
  });

  it('returns existing provider config', async () => {
    emailProviderConfigService.getConfig.mockResolvedValue({
      provider: 'sendgrid',
      domain: null,
      keyPrefix: 'SG.abcde',
      is_active: true,
      notificationEmail: 'alerts@test.com',
    });
    const result = await controller.getEmailProvider(mockUser);
    expect(result).toEqual({
      provider: 'sendgrid',
      domain: null,
      keyPrefix: 'SG.abcde',
      is_active: true,
      notificationEmail: 'alerts@test.com',
    });
  });

  it('tests saved email provider config', async () => {
    const result = await controller.testSavedEmailProvider(mockUser, { to: 'test@test.com' });
    expect(emailProviderConfigService.testSavedConfig).toHaveBeenCalledWith('user-1', 'test@test.com');
    expect(result).toEqual({ success: true });
  });

  describe('block rule cache invalidation', () => {
    let limitCheck: jest.Mocked<LimitCheckService>;

    beforeEach(() => {
      limitCheck = module.get(LimitCheckService);
    });

    it('invalidates cache when creating a block rule', async () => {
      const blockRule = { ...mockRule, action: 'block' };
      rulesService.createRule.mockResolvedValue(blockRule);

      const dto = {
        agent_name: 'my-agent', metric_type: 'tokens' as const,
        threshold: 100000, period: 'day' as const, action: 'block' as const,
      };
      await controller.createRule(dto, mockUser);

      expect(limitCheck.invalidateCache).toHaveBeenCalledWith('t-1', 'my-agent');
    });

    it('does not invalidate cache when creating a notify rule', async () => {
      const notifyRule = { ...mockRule, action: 'notify' };
      rulesService.createRule.mockResolvedValue(notifyRule);

      const dto = {
        agent_name: 'my-agent', metric_type: 'tokens' as const,
        threshold: 100000, period: 'day' as const, action: 'notify' as const,
      };
      await controller.createRule(dto, mockUser);

      expect(limitCheck.invalidateCache).not.toHaveBeenCalled();
    });

    it('invalidates cache when creating a both rule', async () => {
      const bothRule = { ...mockRule, action: 'both' };
      rulesService.createRule.mockResolvedValue(bothRule);

      const dto = {
        agent_name: 'my-agent', metric_type: 'tokens' as const,
        threshold: 100000, period: 'day' as const, action: 'both' as const,
      };
      await controller.createRule(dto, mockUser);

      expect(limitCheck.invalidateCache).toHaveBeenCalledWith('t-1', 'my-agent');
    });

    it('always invalidates cache on update', async () => {
      rulesService.updateRule.mockResolvedValue({ ...mockRule, threshold: 200 });

      await controller.updateRule('rule-1', { threshold: 200 }, mockUser);

      expect(limitCheck.invalidateCache).toHaveBeenCalledWith('t-1', 'my-agent');
    });

    it('invalidates cache on delete when rule exists', async () => {
      rulesService.getRule.mockResolvedValue(mockRule);

      await controller.deleteRule('rule-1', mockUser);

      expect(limitCheck.invalidateCache).toHaveBeenCalledWith('t-1', 'my-agent');
    });

    it('does not invalidate cache on delete when rule not found', async () => {
      rulesService.getRule.mockResolvedValue(undefined);

      await controller.deleteRule('rule-missing', mockUser);

      expect(limitCheck.invalidateCache).not.toHaveBeenCalled();
    });
  });
});
