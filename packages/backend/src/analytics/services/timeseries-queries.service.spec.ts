import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TimeseriesQueriesService } from './timeseries-queries.service';
import { AgentMessage } from '../../entities/agent-message.entity';
import { Agent } from '../../entities/agent.entity';

describe('TimeseriesQueriesService', () => {
  let service: TimeseriesQueriesService;
  let mockGetRawMany: jest.Mock;
  let mockGetMany: jest.Mock;

  beforeEach(async () => {
    mockGetRawMany = jest.fn().mockResolvedValue([]);
    mockGetMany = jest.fn().mockResolvedValue([]);

    const mockTurnQb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      addGroupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getRawMany: mockGetRawMany,
      getRawOne: jest.fn().mockResolvedValue({}),
      getMany: mockGetMany,
    };

    const mockAgentQb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: mockGetMany,
      getRawMany: mockGetRawMany,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimeseriesQueriesService,
        {
          provide: getRepositoryToken(AgentMessage),
          useValue: { createQueryBuilder: jest.fn().mockReturnValue(mockTurnQb) },
        },
        {
          provide: getRepositoryToken(Agent),
          useValue: { createQueryBuilder: jest.fn().mockReturnValue(mockAgentQb) },
        },
        { provide: DataSource, useValue: { options: { type: 'postgres' } } },
      ],
    }).compile();

    service = module.get<TimeseriesQueriesService>(TimeseriesQueriesService);
  });

  describe('getHourlyTokens', () => {
    it('maps DB rows to typed objects', async () => {
      mockGetRawMany.mockResolvedValue([
        { hour: '2026-02-16T10:00:00', input_tokens: 100, output_tokens: 50 },
        { hour: '2026-02-16T11:00:00', input_tokens: 200, output_tokens: 80 },
      ]);

      const result = await service.getHourlyTokens('24h', 'u1');
      expect(result).toEqual([
        { hour: '2026-02-16T10:00:00', input_tokens: 100, output_tokens: 50 },
        { hour: '2026-02-16T11:00:00', input_tokens: 200, output_tokens: 80 },
      ]);
    });

    it('defaults null token values to 0', async () => {
      mockGetRawMany.mockResolvedValue([
        { hour: '2026-02-16T10:00:00', input_tokens: null, output_tokens: null },
      ]);

      const result = await service.getHourlyTokens('24h', 'u1');
      expect(result[0].input_tokens).toBe(0);
      expect(result[0].output_tokens).toBe(0);
    });
  });

  describe('getActiveSkills', () => {
    it('maps DB rows with status field', async () => {
      mockGetRawMany.mockResolvedValue([
        { name: 'deploy', agent_name: 'bot-1', run_count: 5, last_active_at: '2026-02-16T10:00:00' },
      ]);

      const result = await service.getActiveSkills('24h', 'u1');
      expect(result[0]).toEqual({
        name: 'deploy',
        agent_name: 'bot-1',
        run_count: 5,
        last_active_at: '2026-02-16T10:00:00',
        status: 'active',
      });
    });

    it('returns null agent_name when not present', async () => {
      mockGetRawMany.mockResolvedValue([
        { name: 'scan', agent_name: null, run_count: 1, last_active_at: '2026-02-16' },
      ]);

      const result = await service.getActiveSkills('24h', 'u1');
      expect(result[0].agent_name).toBeNull();
    });
  });

  describe('getCostByModel', () => {
    it('computes share_pct for each model', async () => {
      mockGetRawMany.mockResolvedValue([
        { model: 'claude-opus-4-6', tokens: 700, estimated_cost: 10.0 },
        { model: 'gpt-4o', tokens: 300, estimated_cost: 5.0 },
      ]);

      const result = await service.getCostByModel('7d', 'u1');
      expect(result).toHaveLength(2);
      expect(result[0].share_pct).toBe(70);
      expect(result[1].share_pct).toBe(30);
    });

    it('returns 0 share_pct when total tokens is 0', async () => {
      mockGetRawMany.mockResolvedValue([
        { model: 'test', tokens: 0, estimated_cost: 0 },
      ]);

      const result = await service.getCostByModel('7d', 'u1');
      expect(result[0].share_pct).toBe(0);
    });
  });

  describe('getDailyTokens', () => {
    it('maps DB rows with date field and defaults nulls to 0', async () => {
      mockGetRawMany.mockResolvedValue([
        { date: '2026-02-15', input_tokens: 500, output_tokens: 200 },
        { date: '2026-02-16', input_tokens: null, output_tokens: null },
      ]);
      const result = await service.getDailyTokens('7d', 'u1');
      expect(result[0]).toEqual({ date: '2026-02-15', input_tokens: 500, output_tokens: 200 });
      expect(result[1].input_tokens).toBe(0);
      expect(result[1].output_tokens).toBe(0);
    });

    it('returns empty array when no data', async () => {
      mockGetRawMany.mockResolvedValue([]);
      expect(await service.getDailyTokens('30d', 'u1')).toEqual([]);
    });
  });

  describe('getHourlyCosts', () => {
    it('maps DB rows and defaults null cost to 0', async () => {
      mockGetRawMany.mockResolvedValue([
        { hour: '2026-02-16T10:00:00', cost: 1.25 },
        { hour: '2026-02-16T11:00:00', cost: null },
      ]);
      const result = await service.getHourlyCosts('24h', 'u1');
      expect(result[0].cost).toBe(1.25);
      expect(result[1].cost).toBe(0);
    });
  });

  describe('getDailyCosts', () => {
    it('maps DB rows and defaults null cost to 0', async () => {
      mockGetRawMany.mockResolvedValue([
        { date: '2026-02-15', cost: 3.50 },
        { date: '2026-02-16', cost: null },
      ]);
      const result = await service.getDailyCosts('7d', 'u1');
      expect(result[0]).toEqual({ date: '2026-02-15', cost: 3.50 });
      expect(result[1].cost).toBe(0);
    });
  });

  describe('getHourlyMessages', () => {
    it('maps DB rows and defaults null count to 0', async () => {
      mockGetRawMany.mockResolvedValue([
        { hour: '2026-02-16T10:00:00', count: 15 },
        { hour: '2026-02-16T11:00:00', count: null },
      ]);
      const result = await service.getHourlyMessages('24h', 'u1');
      expect(result[0].count).toBe(15);
      expect(result[1].count).toBe(0);
    });
  });

  describe('getDailyMessages', () => {
    it('maps DB rows and returns empty for no data', async () => {
      mockGetRawMany.mockResolvedValue([
        { date: '2026-02-15', count: 100 },
      ]);
      const result = await service.getDailyMessages('7d', 'u1');
      expect(result).toEqual([{ date: '2026-02-15', count: 100 }]);

      mockGetRawMany.mockResolvedValue([]);
      expect(await service.getDailyMessages('30d', 'u1')).toEqual([]);
    });
  });

  describe('getRecentActivity', () => {
    it('returns raw query results', async () => {
      const fakeRows = [{ id: '1', timestamp: '2026-02-16', agent_name: 'bot-1' }];
      mockGetRawMany.mockResolvedValue(fakeRows);
      expect(await service.getRecentActivity('24h', 'u1')).toEqual(fakeRows);
    });

    it('returns empty array when no activity', async () => {
      mockGetRawMany.mockResolvedValue([]);
      expect(await service.getRecentActivity('24h', 'u1', 10)).toEqual([]);
    });
  });

  describe('getAgentList', () => {
    it('returns agents with sparkline data and display_name', async () => {
      mockGetMany.mockResolvedValueOnce([
        { name: 'bot-1', display_name: 'Bot One', created_at: '2026-02-16' },
      ]);
      mockGetRawMany
        .mockResolvedValueOnce([
          { agent_name: 'bot-1', message_count: 10, last_active: '2026-02-16', total_cost: 5.0, total_tokens: 1000 },
        ])
        .mockResolvedValueOnce([
          { agent_name: 'bot-1', hour: '2026-02-16T09:00:00', tokens: 100 },
          { agent_name: 'bot-1', hour: '2026-02-16T10:00:00', tokens: 200 },
        ]);

      const result = await service.getAgentList('u1');
      expect(result).toHaveLength(1);
      expect(result[0].agent_name).toBe('bot-1');
      expect(result[0].display_name).toBe('Bot One');
      expect(result[0].sparkline).toBeDefined();
      expect(result[0].total_cost).toBe(5.0);
    });

    it('falls back to agent_name when display_name is null', async () => {
      mockGetMany.mockResolvedValueOnce([
        { name: 'bot-1', display_name: null, created_at: '2026-02-16' },
      ]);
      mockGetRawMany
        .mockResolvedValueOnce([
          { agent_name: 'bot-1', message_count: 10, last_active: '2026-02-16', total_cost: 5.0, total_tokens: 1000 },
        ])
        .mockResolvedValueOnce([]);

      const result = await service.getAgentList('u1');
      expect(result[0].display_name).toBe('bot-1');
    });

    it('returns empty sparkline for agent with no spark data', async () => {
      mockGetMany.mockResolvedValueOnce([
        { name: 'lonely-bot', display_name: null, created_at: '2026-02-16' },
      ]);
      mockGetRawMany
        .mockResolvedValueOnce([
          { agent_name: 'lonely-bot', message_count: 1, last_active: '2026-02-16', total_cost: 0, total_tokens: 0 },
        ])
        .mockResolvedValueOnce([]);

      const result = await service.getAgentList('u1');
      expect(result[0].sparkline).toEqual([]);
    });

    it('returns agent with zero stats when no telemetry exists', async () => {
      mockGetMany.mockResolvedValueOnce([
        { name: 'new-bot', display_name: null, created_at: '2026-02-16' },
      ]);
      mockGetRawMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.getAgentList('u1');
      expect(result).toHaveLength(1);
      expect(result[0].agent_name).toBe('new-bot');
      expect(result[0].display_name).toBe('new-bot');
      expect(result[0].message_count).toBe(0);
      expect(result[0].total_cost).toBe(0);
      expect(result[0].sparkline).toEqual([]);
    });
  });
});

describe('TimeseriesQueriesService (SQLite dialect)', () => {
  let service: TimeseriesQueriesService;
  let mockSelect: jest.Mock;
  let mockAddSelect: jest.Mock;
  let mockGetRawMany: jest.Mock;
  let mockGetMany: jest.Mock;

  beforeEach(async () => {
    mockSelect = jest.fn().mockReturnThis();
    mockAddSelect = jest.fn().mockReturnThis();
    mockGetRawMany = jest.fn().mockResolvedValue([]);
    mockGetMany = jest.fn().mockResolvedValue([]);

    const mockTurnQb = {
      select: mockSelect,
      addSelect: mockAddSelect,
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      addGroupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getRawMany: mockGetRawMany,
      getRawOne: jest.fn().mockResolvedValue({}),
      getMany: mockGetMany,
    };

    const mockAgentQb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: mockGetMany,
      getRawMany: mockGetRawMany,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimeseriesQueriesService,
        {
          provide: getRepositoryToken(AgentMessage),
          useValue: { createQueryBuilder: jest.fn().mockReturnValue(mockTurnQb) },
        },
        {
          provide: getRepositoryToken(Agent),
          useValue: { createQueryBuilder: jest.fn().mockReturnValue(mockAgentQb) },
        },
        { provide: DataSource, useValue: { options: { type: 'sqljs' } } },
      ],
    }).compile();

    service = module.get<TimeseriesQueriesService>(TimeseriesQueriesService);
  });

  it('initializes with sqlite dialect from sqljs', () => {
    expect(service).toBeDefined();
  });

  it('uses strftime for hour bucketing in getHourlyTokens', async () => {
    mockGetRawMany.mockResolvedValue([]);
    await service.getHourlyTokens('24h', 'u1');

    const selectCalls = mockSelect.mock.calls.map((c: unknown[]) => c[0]);
    const hasStrftime = selectCalls.some(
      (expr: unknown) => typeof expr === 'string' && expr.includes('strftime') && expr.includes('%H:00:00'),
    );
    expect(hasStrftime).toBe(true);
  });

  it('uses strftime for date bucketing in getDailyTokens', async () => {
    mockGetRawMany.mockResolvedValue([]);
    await service.getDailyTokens('7d', 'u1');

    const selectCalls = mockSelect.mock.calls.map((c: unknown[]) => c[0]);
    const hasStrftime = selectCalls.some(
      (expr: unknown) => typeof expr === 'string' && expr.includes("strftime('%Y-%m-%d'"),
    );
    expect(hasStrftime).toBe(true);
  });

  it('uses CAST AS REAL in getRecentActivity', async () => {
    mockGetRawMany.mockResolvedValue([]);
    await service.getRecentActivity('24h', 'u1');

    const addSelectCalls = mockAddSelect.mock.calls.map((c: unknown[]) => c[0]);
    const hasCastReal = addSelectCalls.some(
      (expr: unknown) => typeof expr === 'string' && expr.includes('CAST') && expr.includes('AS REAL'),
    );
    expect(hasCastReal).toBe(true);
  });

  it('business logic works identically on sqlite dialect', async () => {
    mockGetRawMany.mockResolvedValue([
      { hour: '2026-02-16T10:00:00', input_tokens: 100, output_tokens: 50 },
    ]);

    const result = await service.getHourlyTokens('24h', 'u1');
    expect(result).toEqual([
      { hour: '2026-02-16T10:00:00', input_tokens: 100, output_tokens: 50 },
    ]);
  });

  it('getCostByModel works with sqlite dialect', async () => {
    mockGetRawMany.mockResolvedValue([
      { model: 'gpt-4o', tokens: 500, estimated_cost: 2.0 },
      { model: 'claude', tokens: 500, estimated_cost: 3.0 },
    ]);

    const result = await service.getCostByModel('7d', 'u1');
    expect(result).toHaveLength(2);
    expect(result[0].share_pct).toBe(50);
    expect(result[1].share_pct).toBe(50);
  });
});
