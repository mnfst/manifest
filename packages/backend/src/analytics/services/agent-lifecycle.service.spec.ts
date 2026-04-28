import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AgentLifecycleService } from './agent-lifecycle.service';
import { Agent } from '../../entities/agent.entity';

describe('AgentLifecycleService', () => {
  let service: AgentLifecycleService;
  let mockAgentGetOne: jest.Mock;
  let mockAgentDelete: jest.Mock;
  let mockTransaction: jest.Mock;
  let mockAgentCreateQueryBuilder: jest.Mock;

  beforeEach(async () => {
    mockTransaction = jest
      .fn()
      .mockImplementation(async (cb: (...args: unknown[]) => unknown) => cb());

    mockAgentGetOne = jest.fn().mockResolvedValue(null);
    mockAgentDelete = jest.fn().mockResolvedValue({});

    const mockAgentQb = {
      select: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getOne: mockAgentGetOne,
      getMany: jest.fn().mockResolvedValue([]),
    };

    mockAgentCreateQueryBuilder = jest.fn().mockReturnValue(mockAgentQb);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentLifecycleService,
        {
          provide: getRepositoryToken(Agent),
          useValue: {
            createQueryBuilder: mockAgentCreateQueryBuilder,
            delete: mockAgentDelete,
          },
        },
        {
          provide: DataSource,
          useValue: { transaction: mockTransaction },
        },
      ],
    }).compile();

    service = module.get<AgentLifecycleService>(AgentLifecycleService);
  });

  describe('findAgentInfo', () => {
    it('returns agent metadata when found', async () => {
      mockAgentGetOne.mockResolvedValueOnce({
        id: 'agent-id-1',
        name: 'bot-1',
        display_name: 'Bot One',
        agent_category: 'app',
        agent_platform: 'openai-sdk',
      });

      const result = await service.findAgentInfo('user-1', 'bot-1');
      expect(result).toEqual({
        agent_name: 'bot-1',
        display_name: 'Bot One',
        agent_category: 'app',
        agent_platform: 'openai-sdk',
      });
    });

    it('falls back display_name to agent name when null', async () => {
      mockAgentGetOne.mockResolvedValueOnce({
        id: 'agent-id-1',
        name: 'bot-1',
        display_name: null,
        agent_category: null,
        agent_platform: null,
      });

      const result = await service.findAgentInfo('user-1', 'bot-1');
      expect(result?.display_name).toBe('bot-1');
      expect(result?.agent_category).toBeNull();
      expect(result?.agent_platform).toBeNull();
    });

    it('returns null when agent not found', async () => {
      mockAgentGetOne.mockResolvedValueOnce(null);
      const result = await service.findAgentInfo('user-1', 'nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('deleteAgent', () => {
    it('should delete agent when found', async () => {
      mockAgentGetOne.mockResolvedValueOnce({ id: 'agent-id-1', name: 'my-agent' });

      await service.deleteAgent('test-user', 'my-agent');
      expect(mockAgentDelete).toHaveBeenCalledWith('agent-id-1');
    });

    it('should throw NotFoundException when agent not found', async () => {
      mockAgentGetOne.mockResolvedValueOnce(null);

      await expect(service.deleteAgent('test-user', 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateAgentType', () => {
    it('should update agent_category and agent_platform', async () => {
      mockAgentGetOne.mockResolvedValueOnce({ id: 'agent-id-1', name: 'my-agent' });

      const mockExecute = jest.fn().mockResolvedValue({});
      const mockUpdateQb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: mockExecute,
      };

      mockAgentCreateQueryBuilder
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          leftJoin: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          getOne: mockAgentGetOne,
          getMany: jest.fn().mockResolvedValue([]),
        })
        .mockReturnValueOnce(mockUpdateQb);

      await service.updateAgentType('test-user', 'my-agent', {
        agent_category: 'app',
        agent_platform: 'openai-sdk',
      });

      expect(mockUpdateQb.set).toHaveBeenCalledWith({
        agent_category: 'app',
        agent_platform: 'openai-sdk',
      });
      expect(mockUpdateQb.where).toHaveBeenCalledWith('id = :id', { id: 'agent-id-1' });
      expect(mockExecute).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException when agent not found', async () => {
      mockAgentGetOne.mockResolvedValueOnce(null);

      await expect(
        service.updateAgentType('test-user', 'nonexistent', { agent_category: 'personal' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should skip update when no fields provided', async () => {
      mockAgentGetOne.mockResolvedValueOnce({ id: 'agent-id-1', name: 'my-agent' });

      await service.updateAgentType('test-user', 'my-agent', {});

      // Only the findAgentByUser query builder should be created, not an update one
      expect(mockAgentCreateQueryBuilder).toHaveBeenCalledTimes(1);
    });

    it('should update only agent_category when only category provided', async () => {
      mockAgentGetOne.mockResolvedValueOnce({ id: 'agent-id-1', name: 'my-agent' });

      const mockExecute = jest.fn().mockResolvedValue({});
      const mockUpdateQb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: mockExecute,
      };

      mockAgentCreateQueryBuilder
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          leftJoin: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          getOne: mockAgentGetOne,
          getMany: jest.fn().mockResolvedValue([]),
        })
        .mockReturnValueOnce(mockUpdateQb);

      await service.updateAgentType('test-user', 'my-agent', {
        agent_category: 'personal',
      });

      expect(mockUpdateQb.set).toHaveBeenCalledWith({ agent_category: 'personal' });
    });
  });

  describe('renameAgent', () => {
    it('should throw NotFoundException when agent not found', async () => {
      mockAgentGetOne.mockResolvedValueOnce(null);

      await expect(service.renameAgent('test-user', 'nonexistent', 'new-name')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException when new name already exists', async () => {
      mockAgentGetOne.mockResolvedValueOnce({ id: 'agent-id-1', name: 'old-agent' });
      mockAgentGetOne.mockResolvedValueOnce({ id: 'agent-id-2', name: 'taken-name' });

      await expect(service.renameAgent('test-user', 'old-agent', 'taken-name')).rejects.toThrow(
        ConflictException,
      );
    });

    it('should rename agent and update all related tables in a transaction', async () => {
      mockAgentGetOne.mockResolvedValueOnce({
        id: 'agent-id-1',
        name: 'old-agent',
        tenant_id: 'tenant-1',
      });
      mockAgentGetOne.mockResolvedValueOnce(null);

      const mockExecute = jest.fn().mockResolvedValue({});
      const mockManagerQb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: mockExecute,
      };
      const mockManagerQuery = jest.fn().mockResolvedValue([]);

      mockTransaction.mockImplementation(async (cb: (...args: unknown[]) => unknown) => {
        const manager = {
          createQueryBuilder: jest.fn().mockReturnValue(mockManagerQb),
          query: mockManagerQuery,
        };
        return cb(manager);
      });

      await service.renameAgent('test-user', 'old-agent', 'new-agent', 'New Agent');

      expect(mockTransaction).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledTimes(3);
      expect(mockManagerQb.update).toHaveBeenCalledWith('agents');
      expect(mockManagerQb.set).toHaveBeenCalledWith({
        name: 'new-agent',
        display_name: 'New Agent',
      });

      const updateCalls = mockManagerQb.update.mock.calls.map((c: unknown[]) => c[0]);
      expect(updateCalls).toContain('agents');
      expect(updateCalls).toContain('agent_messages');
      expect(updateCalls).toContain('notification_rules');
      expect(updateCalls).not.toContain('notification_logs');

      const tenantScopedWhereCalls = mockManagerQb.where.mock.calls.filter(
        (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('tenant_id'),
      );
      expect(tenantScopedWhereCalls.length).toBe(2);
      for (const call of tenantScopedWhereCalls) {
        expect(call[1]).toEqual({ tenantId: 'tenant-1', currentName: 'old-agent' });
      }

      expect(mockManagerQuery).toHaveBeenCalledTimes(1);
      const [logsSql, logsParams] = mockManagerQuery.mock.calls[0];
      expect(logsSql).toContain('UPDATE notification_logs');
      expect(logsSql).toContain('notification_rules');
      expect(logsSql).toContain('tenant_id');
      expect(logsParams).toEqual(['new-agent', 'tenant-1']);
    });

    it('should short-circuit when slug is unchanged and only update display_name', async () => {
      mockAgentGetOne.mockResolvedValueOnce({ id: 'agent-id-1', name: 'my-agent' });

      const mockExecute = jest.fn().mockResolvedValue({});
      const mockAgentUpdateQb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: mockExecute,
      };

      mockAgentCreateQueryBuilder
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          leftJoin: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          getOne: mockAgentGetOne,
          getMany: jest.fn().mockResolvedValue([]),
        })
        .mockReturnValueOnce(mockAgentUpdateQb);

      await service.renameAgent('test-user', 'my-agent', 'my-agent', 'My Agent');

      expect(mockTransaction).not.toHaveBeenCalled();
      expect(mockExecute).toHaveBeenCalledTimes(1);
      expect(mockAgentUpdateQb.set).toHaveBeenCalledWith({ display_name: 'My Agent' });
    });

    it('should short-circuit without update when slug unchanged and displayName is undefined', async () => {
      mockAgentGetOne.mockResolvedValueOnce({ id: 'agent-id-1', name: 'my-agent' });

      await service.renameAgent('test-user', 'my-agent', 'my-agent');

      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('should rename without display_name when displayName is undefined', async () => {
      mockAgentGetOne.mockResolvedValueOnce({
        id: 'agent-id-1',
        name: 'old-agent',
        tenant_id: 'tenant-1',
      });
      mockAgentGetOne.mockResolvedValueOnce(null);

      const mockExecute = jest.fn().mockResolvedValue({});
      const mockManagerQb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: mockExecute,
      };

      mockTransaction.mockImplementation(async (cb: (...args: unknown[]) => unknown) => {
        const manager = {
          createQueryBuilder: jest.fn().mockReturnValue(mockManagerQb),
          query: jest.fn().mockResolvedValue([]),
        };
        return cb(manager);
      });

      await service.renameAgent('test-user', 'old-agent', 'new-agent');

      expect(mockTransaction).toHaveBeenCalledTimes(1);
      expect(mockManagerQb.set).toHaveBeenCalledWith({ name: 'new-agent' });
    });
  });
});
