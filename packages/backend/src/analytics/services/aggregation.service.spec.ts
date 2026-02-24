import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AggregationService } from './aggregation.service';
import { AgentMessage } from '../../entities/agent-message.entity';
import { Agent } from '../../entities/agent.entity';
import { TimeseriesQueriesService } from './timeseries-queries.service';

describe('AggregationService', () => {
  let service: AggregationService;
  let mockGetRawOne: jest.Mock;
  let mockGetRawMany: jest.Mock;
  let mockAgentGetOne: jest.Mock;
  let mockAgentDelete: jest.Mock;
  let mockTransaction: jest.Mock;
  let mockAgentCreateQueryBuilder: jest.Mock;

  beforeEach(async () => {
    mockGetRawOne = jest.fn().mockResolvedValue({ total: 0 });
    mockGetRawMany = jest.fn().mockResolvedValue([]);
    mockAgentGetOne = jest.fn().mockResolvedValue(null);
    mockAgentDelete = jest.fn().mockResolvedValue({});

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
      getRawMany: mockGetRawMany,
      getMany: jest.fn().mockResolvedValue([]),
      getOne: jest.fn().mockResolvedValue(null),
    };

    mockTransaction = jest.fn().mockImplementation(async (cb: Function) => cb());

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

    const mockTimeseries = {
      getHourlyTokens: jest.fn().mockResolvedValue([]),
      getDailyTokens: jest.fn().mockResolvedValue([]),
      getHourlyCosts: jest.fn().mockResolvedValue([]),
      getDailyCosts: jest.fn().mockResolvedValue([]),
      getHourlyMessages: jest.fn().mockResolvedValue([]),
      getDailyMessages: jest.fn().mockResolvedValue([]),
      getActiveSkills: jest.fn().mockResolvedValue([]),
      getRecentActivity: jest.fn().mockResolvedValue([]),
      getCostByModel: jest.fn().mockResolvedValue([]),
      getAgentList: jest.fn().mockResolvedValue([]),
    };

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
        { provide: TimeseriesQueriesService, useValue: mockTimeseries },
        { provide: DataSource, useValue: { options: { type: 'postgres' }, transaction: mockTransaction } },
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
  });

  describe('getCostSummary', () => {
    it('returns cost with trend', async () => {
      mockGetRawOne
        .mockResolvedValueOnce({ total: 1.5 })
        .mockResolvedValueOnce({ total: 1.0 });

      const result = await service.getCostSummary('7d', 'test-user');
      expect(result.value).toBe(1.5);
      expect(result.trend_pct).toBe(50);
    });
  });

  describe('getMessageCount', () => {
    it('returns message count with trend', async () => {
      mockGetRawOne
        .mockResolvedValueOnce({ total: 100 })
        .mockResolvedValueOnce({ total: 80 });

      const result = await service.getMessageCount('24h', 'test-user');
      expect(result.value).toBe(100);
      expect(result.trend_pct).toBe(25);
    });
  });

  describe('deleteAgent', () => {
    it('should delete agent when found', async () => {
      const mockAgentQb = mockAgentGetOne;
      mockAgentQb.mockResolvedValueOnce({ id: 'agent-id-1', name: 'my-agent' });

      await service.deleteAgent('test-user', 'my-agent');
      expect(mockAgentDelete).toHaveBeenCalledWith('agent-id-1');
    });

    it('should throw NotFoundException when agent not found', async () => {
      mockAgentGetOne.mockResolvedValueOnce(null);

      await expect(
        service.deleteAgent('test-user', 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('renameAgent', () => {
    it('should throw NotFoundException when agent not found', async () => {
      mockAgentGetOne.mockResolvedValueOnce(null);

      await expect(
        service.renameAgent('test-user', 'nonexistent', 'new-name'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when new name already exists', async () => {
      // First call: find current agent — found
      mockAgentGetOne.mockResolvedValueOnce({ id: 'agent-id-1', name: 'old-agent' });
      // Second call: check for duplicate — found
      mockAgentGetOne.mockResolvedValueOnce({ id: 'agent-id-2', name: 'taken-name' });

      await expect(
        service.renameAgent('test-user', 'old-agent', 'taken-name'),
      ).rejects.toThrow(ConflictException);
    });

    it('should rename agent and update all related tables in a transaction', async () => {
      // First call: find current agent — found
      mockAgentGetOne.mockResolvedValueOnce({ id: 'agent-id-1', name: 'old-agent' });
      // Second call: check for duplicate — not found
      mockAgentGetOne.mockResolvedValueOnce(null);

      const mockExecute = jest.fn().mockResolvedValue({});
      const mockManagerQb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: mockExecute,
      };

      mockTransaction.mockImplementation(async (cb: Function) => {
        const manager = {
          createQueryBuilder: jest.fn().mockReturnValue(mockManagerQb),
        };
        return cb(manager);
      });

      await service.renameAgent('test-user', 'old-agent', 'new-agent');

      // Verify transaction was called
      expect(mockTransaction).toHaveBeenCalledTimes(1);

      // The transaction callback should have executed:
      // 1 update for agents table + 5 updates for related tables = 6 total
      expect(mockExecute).toHaveBeenCalledTimes(6);

      // Verify agents table update was called with agent id
      expect(mockManagerQb.update).toHaveBeenCalledWith('agents');
      expect(mockManagerQb.set).toHaveBeenCalledWith({ name: 'new-agent' });

      // Verify all 5 related tables were updated
      const updateCalls = mockManagerQb.update.mock.calls.map(
        (c: unknown[]) => c[0],
      );
      expect(updateCalls).toContain('agents');
      expect(updateCalls).toContain('agent_messages');
      expect(updateCalls).toContain('notification_rules');
      expect(updateCalls).toContain('notification_logs');
      expect(updateCalls).toContain('token_usage_snapshots');
      expect(updateCalls).toContain('cost_snapshots');
    });
  });

  describe('getMessages', () => {
    it('returns paginated messages with total count and models list', async () => {
      // count query
      mockGetRawOne.mockResolvedValueOnce({ total: 42 });
      // data query
      mockGetRawMany.mockResolvedValueOnce([
        { id: 'msg-1', timestamp: '2026-02-16 10:00:00', model: 'gpt-4o', cost: 0.01 },
        { id: 'msg-2', timestamp: '2026-02-16 09:00:00', model: 'claude-opus-4-6', cost: 0.05 },
      ]);
      // models query
      mockGetRawMany.mockResolvedValueOnce([
        { model: 'claude-opus-4-6' },
        { model: 'gpt-4o' },
      ]);

      const result = await service.getMessages({
        range: '24h',
        userId: 'test-user',
        limit: 20,
      });

      expect(result.total_count).toBe(42);
      expect(result.items).toHaveLength(2);
      expect(result.next_cursor).toBeNull();
      expect(result.models).toEqual(['claude-opus-4-6', 'gpt-4o']);
    });

    it('returns next_cursor when more items exist', async () => {
      const rows = Array.from({ length: 6 }, (_, i) => ({
        id: `msg-${i}`,
        timestamp: `2026-02-16 10:0${i}:00`,
        model: 'gpt-4o',
        cost: 0.01,
      }));

      mockGetRawOne.mockResolvedValueOnce({ total: 20 });
      mockGetRawMany
        .mockResolvedValueOnce(rows) // 6 rows for limit=5 means hasMore
        .mockResolvedValueOnce([]);

      const result = await service.getMessages({
        range: '24h',
        userId: 'test-user',
        limit: 5,
      });

      expect(result.items).toHaveLength(5);
      expect(result.next_cursor).not.toBeNull();
      expect(result.next_cursor).toContain('|msg-4');
    });

    it('returns null next_cursor when no more items', async () => {
      mockGetRawOne.mockResolvedValueOnce({ total: 2 });
      mockGetRawMany
        .mockResolvedValueOnce([
          { id: 'msg-1', timestamp: '2026-02-16 10:00:00' },
        ])
        .mockResolvedValueOnce([]);

      const result = await service.getMessages({
        range: '24h',
        userId: 'test-user',
        limit: 20,
      });

      expect(result.next_cursor).toBeNull();
    });

    it('handles Date objects in timestamp for cursor formatting', async () => {
      const rows = [
        { id: 'msg-0', timestamp: new Date('2026-02-16T10:00:00'), model: 'gpt-4o' },
        { id: 'msg-1', timestamp: new Date('2026-02-16T09:30:00'), model: 'gpt-4o' },
        { id: 'extra', timestamp: new Date('2026-02-16T09:00:00'), model: 'gpt-4o' },
      ];

      mockGetRawOne.mockResolvedValueOnce({ total: 10 });
      mockGetRawMany
        .mockResolvedValueOnce(rows)
        .mockResolvedValueOnce([]);

      const result = await service.getMessages({
        range: '24h',
        userId: 'test-user',
        limit: 2,
      });

      expect(result.next_cursor).not.toBeNull();
      // Should use formatTimestamp for Date objects
      expect(result.next_cursor).toContain('2026-02-16T09:30:00');
      expect(result.next_cursor).toContain('|msg-1');
    });

    it('handles empty result set', async () => {
      mockGetRawOne.mockResolvedValueOnce({ total: 0 });
      mockGetRawMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.getMessages({
        range: '24h',
        userId: 'test-user',
        limit: 20,
      });

      expect(result.total_count).toBe(0);
      expect(result.items).toEqual([]);
      expect(result.next_cursor).toBeNull();
      expect(result.models).toEqual([]);
    });
  });
});

describe('AggregationService (SQLite dialect)', () => {
  let service: AggregationService;
  let mockSelect: jest.Mock;
  let mockAddSelect: jest.Mock;
  let mockGetRawOne: jest.Mock;
  let mockGetRawMany: jest.Mock;

  beforeEach(async () => {
    mockSelect = jest.fn().mockReturnThis();
    mockAddSelect = jest.fn().mockReturnThis();
    mockGetRawOne = jest.fn().mockResolvedValue({ total: 0 });
    mockGetRawMany = jest.fn().mockResolvedValue([]);

    const mockQb = {
      select: mockSelect,
      addSelect: mockAddSelect,
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
      getRawMany: mockGetRawMany,
      getMany: jest.fn().mockResolvedValue([]),
      getOne: jest.fn().mockResolvedValue(null),
    };

    // Clone must return a fresh object with the same mocks
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
        {
          provide: TimeseriesQueriesService,
          useValue: {
            getHourlyTokens: jest.fn().mockResolvedValue([]),
            getDailyTokens: jest.fn().mockResolvedValue([]),
            getHourlyCosts: jest.fn().mockResolvedValue([]),
            getDailyCosts: jest.fn().mockResolvedValue([]),
            getHourlyMessages: jest.fn().mockResolvedValue([]),
            getDailyMessages: jest.fn().mockResolvedValue([]),
            getActiveSkills: jest.fn().mockResolvedValue([]),
            getRecentActivity: jest.fn().mockResolvedValue([]),
            getCostByModel: jest.fn().mockResolvedValue([]),
            getAgentList: jest.fn().mockResolvedValue([]),
          },
        },
        { provide: DataSource, useValue: { options: { type: 'sqljs' } } },
      ],
    }).compile();

    service = module.get<AggregationService>(AggregationService);
  });

  it('detects sqlite dialect from sqljs datasource', () => {
    // Service should initialize without error — dialect detection worked
    expect(service).toBeDefined();
  });

  it('uses CAST(... AS REAL) for cost in getMessages', async () => {
    mockGetRawOne.mockResolvedValueOnce({ total: 1 });
    mockGetRawMany
      .mockResolvedValueOnce([{ id: 'msg-1', timestamp: '2026-01-01', cost: 0.5 }])
      .mockResolvedValueOnce([]);

    await service.getMessages({ range: '24h', userId: 'u1', limit: 20 });

    // Verify addSelect was called with SQLite float cast
    const addSelectCalls = mockAddSelect.mock.calls.map(
      (c: unknown[]) => c[0],
    );
    const hasCastReal = addSelectCalls.some(
      (expr: unknown) => typeof expr === 'string' && expr.includes('CAST') && expr.includes('AS REAL'),
    );
    expect(hasCastReal).toBe(true);
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
