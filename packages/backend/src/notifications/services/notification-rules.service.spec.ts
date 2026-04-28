import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { In } from 'typeorm';
import { NotificationRulesService } from './notification-rules.service';
import { NotificationRule } from '../../entities/notification-rule.entity';
import { NotificationLog } from '../../entities/notification-log.entity';
import { AgentMessage } from '../../entities/agent-message.entity';
import { Agent } from '../../entities/agent.entity';
import { Tenant } from '../../entities/tenant.entity';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('NotificationRulesService', () => {
  let service: NotificationRulesService;
  let ruleRepo: {
    find: jest.Mock;
    findOneBy: jest.Mock;
    insert: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    count: jest.Mock;
  };
  let logRepo: { createQueryBuilder: jest.Mock };
  let messageRepo: { createQueryBuilder: jest.Mock };
  let agentRepo: { createQueryBuilder: jest.Mock };

  const makeQb = <T>(rawOne: T | null = null, rawMany: T[] = []) => {
    const qb: Record<string, jest.Mock> = {};
    qb.select = jest.fn().mockReturnValue(qb);
    qb.addSelect = jest.fn().mockReturnValue(qb);
    qb.where = jest.fn().mockReturnValue(qb);
    qb.andWhere = jest.fn().mockReturnValue(qb);
    qb.groupBy = jest.fn().mockReturnValue(qb);
    qb.innerJoin = jest.fn().mockReturnValue(qb);
    qb.getRawOne = jest.fn().mockResolvedValue(rawOne);
    qb.getRawMany = jest.fn().mockResolvedValue(rawMany);
    qb.getOne = jest.fn().mockResolvedValue(rawOne);
    return qb;
  };

  beforeEach(async () => {
    ruleRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOneBy: jest.fn().mockResolvedValue(null),
      insert: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
      count: jest.fn().mockResolvedValue(0),
    };
    logRepo = { createQueryBuilder: jest.fn().mockReturnValue(makeQb()) };
    messageRepo = { createQueryBuilder: jest.fn().mockReturnValue(makeQb()) };
    agentRepo = { createQueryBuilder: jest.fn().mockReturnValue(makeQb()) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationRulesService,
        { provide: getRepositoryToken(NotificationRule), useValue: ruleRepo },
        { provide: getRepositoryToken(NotificationLog), useValue: logRepo },
        { provide: getRepositoryToken(AgentMessage), useValue: messageRepo },
        { provide: getRepositoryToken(Agent), useValue: agentRepo },
        { provide: getRepositoryToken(Tenant), useValue: {} },
      ],
    }).compile();

    service = module.get(NotificationRulesService);
  });

  describe('listRules', () => {
    it('returns rules decorated with trigger counts', async () => {
      const rule = { id: 'r1', user_id: 'u1', agent_name: 'a1' } as NotificationRule;
      ruleRepo.find.mockResolvedValueOnce([rule]);
      logRepo.createQueryBuilder.mockReturnValueOnce(
        makeQb(null, [{ rule_id: 'r1', trigger_count: '5' }]),
      );

      const result = await service.listRules('u1', 'a1');
      expect(result).toEqual([{ ...rule, trigger_count: 5 }]);
      expect(ruleRepo.find).toHaveBeenCalledWith({
        where: { user_id: 'u1', agent_name: 'a1' },
        order: { created_at: 'DESC' },
      });
    });

    it('returns empty array when no rules exist (skips log lookup)', async () => {
      ruleRepo.find.mockResolvedValueOnce([]);

      const result = await service.listRules('u1', 'a1');
      expect(result).toEqual([]);
      expect(logRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('defaults missing trigger counts to zero', async () => {
      const rule = { id: 'r1', user_id: 'u1', agent_name: 'a1' } as NotificationRule;
      ruleRepo.find.mockResolvedValueOnce([rule]);
      logRepo.createQueryBuilder.mockReturnValueOnce(makeQb(null, []));

      const result = await service.listRules('u1', 'a1');
      expect(result[0].trigger_count).toBe(0);
    });
  });

  describe('createRule', () => {
    it('resolves the agent and inserts a rule', async () => {
      agentRepo.createQueryBuilder.mockReturnValueOnce(
        makeQb({ id: 'agent-1', tenant_id: 'tenant-1' }),
      );
      ruleRepo.findOneBy.mockResolvedValueOnce({ id: 'new-rule' } as NotificationRule);

      const result = await service.createRule('u1', {
        agent_name: 'a1',
        metric_type: 'tokens',
        threshold: 50000,
        period: 'day',
      });

      expect(result).toEqual({ id: 'new-rule' });
      expect(ruleRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          agent_id: 'agent-1',
          tenant_id: 'tenant-1',
          agent_name: 'a1',
          user_id: 'u1',
          metric_type: 'tokens',
          threshold: 50000,
          period: 'day',
          action: 'notify',
          is_active: true,
        }),
      );
    });

    it('throws BadRequestException when agent not found', async () => {
      agentRepo.createQueryBuilder.mockReturnValueOnce(makeQb(null));

      await expect(
        service.createRule('u1', {
          agent_name: 'unknown',
          metric_type: 'tokens',
          threshold: 100,
          period: 'hour',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('uses provided action value', async () => {
      agentRepo.createQueryBuilder.mockReturnValueOnce(
        makeQb({ id: 'agent-1', tenant_id: 'tenant-1' }),
      );
      ruleRepo.findOneBy.mockResolvedValueOnce({ id: 'new-rule' } as NotificationRule);

      await service.createRule('u1', {
        agent_name: 'a1',
        metric_type: 'tokens',
        threshold: 1,
        period: 'hour',
        action: 'block',
      });

      expect(ruleRepo.insert).toHaveBeenCalledWith(expect.objectContaining({ action: 'block' }));
    });
  });

  describe('updateRule', () => {
    it('patches only the provided fields', async () => {
      ruleRepo.count.mockResolvedValueOnce(1);
      ruleRepo.findOneBy.mockResolvedValueOnce({
        id: 'r1',
        threshold: 200,
      } as NotificationRule);

      const result = await service.updateRule('u1', 'r1', { threshold: 200 });
      expect(result?.threshold).toBe(200);
      expect(ruleRepo.update).toHaveBeenCalledWith(
        { id: 'r1' },
        expect.objectContaining({ threshold: 200, updated_at: expect.any(String) }),
      );
    });

    it('returns existing rule when no fields to update (skips UPDATE)', async () => {
      ruleRepo.count.mockResolvedValueOnce(1);
      ruleRepo.findOneBy.mockResolvedValueOnce({ id: 'r1', threshold: 100 } as NotificationRule);

      const result = await service.updateRule('u1', 'r1', {});
      expect(result?.threshold).toBe(100);
      expect(ruleRepo.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when rule not owned', async () => {
      ruleRepo.count.mockResolvedValueOnce(0);

      await expect(service.updateRule('u1', 'missing', { threshold: 1 })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('updates action when provided', async () => {
      ruleRepo.count.mockResolvedValueOnce(1);
      ruleRepo.findOneBy.mockResolvedValueOnce({ id: 'r1', action: 'block' } as NotificationRule);

      const result = await service.updateRule('u1', 'r1', { action: 'block' });
      expect(result?.action).toBe('block');
      expect(ruleRepo.update).toHaveBeenCalledWith(
        { id: 'r1' },
        expect.objectContaining({ action: 'block' }),
      );
    });
  });

  describe('deleteRule', () => {
    it('deletes the rule after ownership check', async () => {
      ruleRepo.count.mockResolvedValueOnce(1);

      await service.deleteRule('u1', 'r1');
      expect(ruleRepo.delete).toHaveBeenCalledWith({ id: 'r1' });
    });

    it('throws when not owned', async () => {
      ruleRepo.count.mockResolvedValueOnce(0);
      await expect(service.deleteRule('u1', 'r1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getConsumption', () => {
    it('sums input+output tokens for tokens metric', async () => {
      const qb = makeQb({ total: '12345' });
      messageRepo.createQueryBuilder.mockReturnValueOnce(qb);

      const result = await service.getConsumption(
        't1',
        'a1',
        'tokens',
        '2026-02-17 00:00:00',
        '2026-02-17 14:00:00',
      );

      expect(result).toBe(12345);
      expect(qb.select).toHaveBeenCalledWith(
        expect.stringContaining('SUM(at.input_tokens + at.output_tokens)'),
        'total',
      );
    });

    it('sums cost_usd for cost metric', async () => {
      const qb = makeQb({ total: '3.45' });
      messageRepo.createQueryBuilder.mockReturnValueOnce(qb);

      const result = await service.getConsumption(
        't1',
        'a1',
        'cost',
        '2026-02-01 00:00:00',
        '2026-02-17 14:00:00',
      );

      expect(result).toBe(3.45);
      expect(qb.select).toHaveBeenCalledWith(expect.stringContaining('SUM(at.cost_usd)'), 'total');
    });

    it('returns 0 when no rows match', async () => {
      messageRepo.createQueryBuilder.mockReturnValueOnce(makeQb(null));

      const result = await service.getConsumption('t1', 'a1', 'tokens', '', '');
      expect(result).toBe(0);
    });
  });

  describe('getAllActiveRules', () => {
    it('returns active notify+both rules', async () => {
      const rules = [{ id: 'r1', is_active: true, action: 'notify' }] as NotificationRule[];
      ruleRepo.find.mockResolvedValueOnce(rules);

      const result = await service.getAllActiveRules();
      expect(result).toEqual(rules);
      expect(ruleRepo.find).toHaveBeenCalledWith({
        where: { is_active: true, action: In(['notify', 'both']) },
      });
    });
  });

  describe('getActiveRulesForUser', () => {
    it('returns active notify+both rules for a specific user', async () => {
      const rules = [{ id: 'r1' }] as NotificationRule[];
      ruleRepo.find.mockResolvedValueOnce(rules);

      const result = await service.getActiveRulesForUser('u1');
      expect(result).toEqual(rules);
      expect(ruleRepo.find).toHaveBeenCalledWith({
        where: { user_id: 'u1', is_active: true, action: In(['notify', 'both']) },
      });
    });
  });

  describe('getActiveBlockRules', () => {
    it('returns block+both rules for a tenant/agent', async () => {
      const rules = [{ id: 'r1', action: 'block' }] as NotificationRule[];
      ruleRepo.find.mockResolvedValueOnce(rules);

      const result = await service.getActiveBlockRules('t1', 'a1');
      expect(result).toEqual(rules);
      expect(ruleRepo.find).toHaveBeenCalledWith({
        where: {
          tenant_id: 't1',
          agent_name: 'a1',
          is_active: true,
          action: In(['block', 'both']),
        },
      });
    });
  });

  describe('getRule / getOwnedRule', () => {
    it('returns a rule by id', async () => {
      const rule = { id: 'r1' } as NotificationRule;
      ruleRepo.findOneBy.mockResolvedValueOnce(rule);

      const result = await service.getRule('r1');
      expect(result).toEqual(rule);
    });

    it('returns undefined when not found', async () => {
      ruleRepo.findOneBy.mockResolvedValueOnce(null);
      const result = await service.getRule('missing');
      expect(result).toBeUndefined();
    });

    it('getOwnedRule filters by user', async () => {
      const rule = { id: 'r1', user_id: 'u1' } as NotificationRule;
      ruleRepo.findOneBy.mockResolvedValueOnce(rule);

      const result = await service.getOwnedRule('u1', 'r1');
      expect(result).toEqual(rule);
      expect(ruleRepo.findOneBy).toHaveBeenCalledWith({ id: 'r1', user_id: 'u1' });
    });
  });
});
