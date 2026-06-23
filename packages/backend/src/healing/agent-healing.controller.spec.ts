import { HttpException } from '@nestjs/common';
import { AgentHealingController } from './agent-healing.controller';
import type { TenantContext } from '../common/decorators/tenant-context.decorator';

describe('AgentHealingController', () => {
  let healingRepo: { findOne: jest.Mock; delete: jest.Mock; createQueryBuilder: jest.Mock };
  let agentRepo: { findOne: jest.Mock };
  let controller: AgentHealingController;
  const execute = jest.fn().mockResolvedValue(undefined);
  const qb = {
    insert: jest.fn().mockReturnThis(),
    into: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    orIgnore: jest.fn().mockReturnThis(),
    execute,
  };
  const ctx = (tenantId: string | null = 'tenant-1') => ({ tenantId }) as TenantContext;

  beforeEach(() => {
    jest.clearAllMocks();
    healingRepo = {
      findOne: jest.fn(),
      delete: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn(() => qb),
    };
    agentRepo = { findOne: jest.fn() };
    controller = new AgentHealingController(healingRepo as never, agentRepo as never);
  });

  describe('status', () => {
    it('returns enabled:true when an activation row exists', async () => {
      agentRepo.findOne.mockResolvedValue({ id: 'agent-1' });
      healingRepo.findOne.mockResolvedValue({ agent_id: 'agent-1' });
      expect(await controller.status(ctx(), 'My Agent')).toEqual({ enabled: true });
    });

    it('returns enabled:false when no row exists', async () => {
      agentRepo.findOne.mockResolvedValue({ id: 'agent-1' });
      healingRepo.findOne.mockResolvedValue(null);
      expect(await controller.status(ctx(), 'My Agent')).toEqual({ enabled: false });
    });

    it('returns enabled:false without a tenant', async () => {
      expect(await controller.status(ctx(null), 'a')).toEqual({ enabled: false });
      expect(agentRepo.findOne).not.toHaveBeenCalled();
    });

    it('returns enabled:false when the agent is unknown', async () => {
      agentRepo.findOne.mockResolvedValue(null);
      expect(await controller.status(ctx(), 'a')).toEqual({ enabled: false });
    });
  });

  describe('enable', () => {
    it('inserts an activation row for a known agent', async () => {
      agentRepo.findOne.mockResolvedValue({ id: 'agent-1' });
      expect(await controller.enable(ctx(), 'a')).toEqual({ ok: true });
      expect(qb.values).toHaveBeenCalledWith({ agent_id: 'agent-1' });
      expect(execute).toHaveBeenCalled();
    });

    it('404s for an unknown agent', async () => {
      agentRepo.findOne.mockResolvedValue(null);
      await expect(controller.enable(ctx(), 'a')).rejects.toThrow(HttpException);
    });
  });

  describe('disable', () => {
    it('deletes the activation row for a known agent', async () => {
      agentRepo.findOne.mockResolvedValue({ id: 'agent-1' });
      expect(await controller.disable(ctx(), 'a')).toEqual({ ok: true });
      expect(healingRepo.delete).toHaveBeenCalledWith({ agent_id: 'agent-1' });
    });

    it('404s for an unknown agent', async () => {
      agentRepo.findOne.mockResolvedValue(null);
      await expect(controller.disable(ctx(), 'a')).rejects.toThrow(HttpException);
    });
  });
});
