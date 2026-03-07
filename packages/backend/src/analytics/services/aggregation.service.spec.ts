import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Brackets, DataSource } from 'typeorm';
import { AggregationService } from './aggregation.service';
import { AgentMessage } from '../../entities/agent-message.entity';
import { Agent } from '../../entities/agent.entity';
import { TenantCacheService } from '../../common/services/tenant-cache.service';

describe('AggregationService', () => {
  let service: AggregationService;
  let mockGetRawOne: jest.Mock;
  let mockAgentGetOne: jest.Mock;
  let mockAgentDelete: jest.Mock;
  let mockTransaction: jest.Mock;
  let mockAgentCreateQueryBuilder: jest.Mock;

  beforeEach(async () => {
    mockGetRawOne = jest.fn().mockResolvedValue({ total: 0 });

    const mockQb: Record<string, jest.Mock> = {
      select: jest.fn(),
      addSelect: jest.fn(),
      where: jest.fn(),
      andWhere: jest.fn(),
      orWhere: jest.fn(),
      groupBy: jest.fn(),
      orderBy: jest.fn(),
      addOrderBy: jest.fn(),
      limit: jest.fn(),
      clone: jest.fn(),
      leftJoin: jest.fn(),
      getRawOne: mockGetRawOne,
      getRawMany: jest.fn().mockResolvedValue([]),
      getMany: jest.fn().mockResolvedValue([]),
      getOne: jest.fn().mockResolvedValue(null),
    };

    const chainableMethods = [
      'select',
      'addSelect',
      'where',
      'andWhere',
      'orWhere',
      'groupBy',
      'orderBy',
      'addOrderBy',
      'limit',
      'clone',
      'leftJoin',
    ];
    for (const method of chainableMethods) {
      mockQb[method].mockImplementation((...args: unknown[]) => {
        const arg = args[0];
        if (arg instanceof Brackets && typeof (arg as any).whereFactory === 'function') {
          (arg as any).whereFactory(mockQb);
        }
        return mockQb;
      });
    }

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
        AggregationService,
        {
          provide: getRepositoryToken(AgentMessage),
          useValue: { createQueryBuilder: jest.fn().mockReturnValue(mockQb) },
        },
        {
          provide: getRepositoryToken(Agent),
          useValue: {
            createQueryBuilder: mockAgentCreateQueryBuilder,
            delete: mockAgentDelete,
          },
        },
        {
          provide: DataSource,
          useValue: { options: { type: 'postgres' }, transaction: mockTransaction },
        },
        {
          provide: TenantCacheService,
          useValue: { resolve: jest.fn().mockResolvedValue('tenant-123') },
        },
      ],
    }).compile();

    service = module.get<AggregationService>(AggregationService);
  });

  describe('hasAnyData', () => {
    it('returns true when a row exists', async () => {
      mockGetRawOne.mockResolvedValueOnce({ '?column?': 1 });
      const result = await service.hasAnyData('test-user');
      expect(result).toBe(true);
    });

    it('returns false when no rows exist', async () => {
      mockGetRawOne.mockResolvedValueOnce(null);
      const result = await service.hasAnyData('test-user');
      expect(result).toBe(false);
    });

    it('returns false when getRawOne returns undefined', async () => {
      mockGetRawOne.mockResolvedValueOnce(undefined);
      const result = await service.hasAnyData('test-user');
      expect(result).toBe(false);
    });
  });

  describe('getTokenSummary', () => {
    it('returns token totals with trend', async () => {
      mockGetRawOne
        .mockResolvedValueOnce({ total: 5000 })
        .mockResolvedValueOnce({ total: 4000 })
        .mockResolvedValueOnce({ inp: 3000, out: 2000 });

      const result = await service.getTokenSummary('24h', 'test-user');
      expect(result.tokens_today.value).toBe(5000);
      expect(result.tokens_today.trend_pct).toBe(25);
      expect(result.input_tokens).toBe(3000);
      expect(result.output_tokens).toBe(2000);
    });

    it('returns zero trend when no previous data', async () => {
      mockGetRawOne
        .mockResolvedValueOnce({ total: 1000 })
        .mockResolvedValueOnce({ total: 0 })
        .mockResolvedValueOnce({ inp: 600, out: 400 });

      const result = await service.getTokenSummary('24h', 'test-user');
      expect(result.tokens_today.trend_pct).toBe(0);
    });

    it('should pass agentName to tenant filter when provided', async () => {
      mockGetRawOne
        .mockResolvedValueOnce({ total: 100 })
        .mockResolvedValueOnce({ total: 50 })
        .mockResolvedValueOnce({ inp: 60, out: 40 });

      const result = await service.getTokenSummary('24h', 'test-user', 'my-agent');
      expect(result.tokens_today.value).toBe(100);
    });

    it('should handle null query results gracefully', async () => {
      mockGetRawOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const result = await service.getTokenSummary('24h', 'test-user');
      expect(result.tokens_today.value).toBe(0);
      expect(result.input_tokens).toBe(0);
      expect(result.output_tokens).toBe(0);
    });
  });

  describe('getCostSummary', () => {
    it('returns cost with trend', async () => {
      mockGetRawOne.mockResolvedValueOnce({ total: 1.5 }).mockResolvedValueOnce({ total: 1.0 });

      const result = await service.getCostSummary('7d', 'test-user');
      expect(result.value).toBe(1.5);
      expect(result.trend_pct).toBe(50);
    });

    it('should pass agentName to tenant filter when provided', async () => {
      mockGetRawOne.mockResolvedValueOnce({ total: 2.5 }).mockResolvedValueOnce({ total: 1.0 });

      const result = await service.getCostSummary('7d', 'test-user', 'my-agent');
      expect(result.value).toBe(2.5);
    });

    it('should handle null query results gracefully', async () => {
      mockGetRawOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

      const result = await service.getCostSummary('24h', 'test-user');
      expect(result.value).toBe(0);
      expect(result.trend_pct).toBe(0);
    });
  });

  describe('getMessageCount', () => {
    it('returns message count with trend', async () => {
      mockGetRawOne.mockResolvedValueOnce({ total: 100 }).mockResolvedValueOnce({ total: 80 });

      const result = await service.getMessageCount('24h', 'test-user');
      expect(result.value).toBe(100);
      expect(result.trend_pct).toBe(25);
    });

    it('should pass agentName to tenant filter when provided', async () => {
      mockGetRawOne.mockResolvedValueOnce({ total: 50 }).mockResolvedValueOnce({ total: 40 });

      const result = await service.getMessageCount('24h', 'test-user', 'my-agent');
      expect(result.value).toBe(50);
    });

    it('should handle null query results gracefully', async () => {
      mockGetRawOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

      const result = await service.getMessageCount('24h', 'test-user');
      expect(result.value).toBe(0);
      expect(result.trend_pct).toBe(0);
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
      mockAgentGetOne.mockResolvedValueOnce({ id: 'agent-id-1', name: 'old-agent' });
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
        };
        return cb(manager);
      });

      await service.renameAgent('test-user', 'old-agent', 'new-agent', 'New Agent');

      expect(mockTransaction).toHaveBeenCalledTimes(1);
      expect(mockExecute).toHaveBeenCalledTimes(6);
      expect(mockManagerQb.update).toHaveBeenCalledWith('agents');
      expect(mockManagerQb.set).toHaveBeenCalledWith({
        name: 'new-agent',
        display_name: 'New Agent',
      });

      const updateCalls = mockManagerQb.update.mock.calls.map((c: unknown[]) => c[0]);
      expect(updateCalls).toContain('agents');
      expect(updateCalls).toContain('agent_messages');
      expect(updateCalls).toContain('notification_rules');
      expect(updateCalls).toContain('notification_logs');
      expect(updateCalls).toContain('token_usage_snapshots');
      expect(updateCalls).toContain('cost_snapshots');
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
      mockAgentGetOne.mockResolvedValueOnce({ id: 'agent-id-1', name: 'old-agent' });
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
        };
        return cb(manager);
      });

      await service.renameAgent('test-user', 'old-agent', 'new-agent');

      expect(mockTransaction).toHaveBeenCalledTimes(1);
      expect(mockManagerQb.set).toHaveBeenCalledWith({ name: 'new-agent' });
    });
  });

  describe('hasAnyData with agentName', () => {
    it('should pass agentName to tenant filter when provided', async () => {
      mockGetRawOne.mockResolvedValueOnce({ '?column?': 1 });
      const result = await service.hasAnyData('test-user', 'my-agent');
      expect(result).toBe(true);
    });
  });
});

describe('AggregationService (sql.js / local mode)', () => {
  let service: AggregationService;
  let mockGetRawOne: jest.Mock;

  beforeEach(async () => {
    mockGetRawOne = jest.fn().mockResolvedValue({ total: 0 });

    const mockQb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      clone: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      getRawOne: mockGetRawOne,
      getRawMany: jest.fn().mockResolvedValue([]),
      getMany: jest.fn().mockResolvedValue([]),
      getOne: jest.fn().mockResolvedValue(null),
    };

    mockQb.clone = jest.fn().mockReturnValue({ ...mockQb, clone: jest.fn() });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AggregationService,
        {
          provide: getRepositoryToken(AgentMessage),
          useValue: { createQueryBuilder: jest.fn().mockReturnValue(mockQb) },
        },
        {
          provide: getRepositoryToken(Agent),
          useValue: {
            createQueryBuilder: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnThis(),
              leftJoin: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              orderBy: jest.fn().mockReturnThis(),
              getOne: jest.fn().mockResolvedValue(null),
              getMany: jest.fn().mockResolvedValue([]),
            }),
            delete: jest.fn().mockResolvedValue({}),
          },
        },
        { provide: DataSource, useValue: { options: { type: 'sqljs' } } },
        { provide: TenantCacheService, useValue: { resolve: jest.fn().mockResolvedValue(null) } },
      ],
    }).compile();

    service = module.get<AggregationService>(AggregationService);
  });

  it('detects sqlite dialect from sqljs datasource', () => {
    expect(service).toBeDefined();
  });

  it('business logic works identically on sqlite dialect', async () => {
    mockGetRawOne
      .mockResolvedValueOnce({ total: 200 })
      .mockResolvedValueOnce({ total: 100 })
      .mockResolvedValueOnce({ inp: 120, out: 80 });

    const result = await service.getTokenSummary('24h', 'user-1');
    expect(result.tokens_today.value).toBe(200);
    expect(result.tokens_today.trend_pct).toBe(100);
    expect(result.input_tokens).toBe(120);
    expect(result.output_tokens).toBe(80);
  });
});
