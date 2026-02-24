import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from './notifications.controller';
import { NotificationRulesService } from './services/notification-rules.service';

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
  let controller: NotificationsController;
  let rulesService: jest.Mocked<NotificationRulesService>;

  beforeEach(async () => {
    const mockRulesService = {
      listRules: jest.fn().mockResolvedValue([mockRule]),
      createRule: jest.fn().mockResolvedValue(mockRule),
      updateRule: jest.fn().mockResolvedValue({ ...mockRule, is_active: 0 }),
      deleteRule: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [{ provide: NotificationRulesService, useValue: mockRulesService }],
    }).compile();

    controller = module.get(NotificationsController);
    rulesService = module.get(NotificationRulesService);
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
});
