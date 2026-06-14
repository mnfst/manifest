import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TimeseriesQueriesService } from './timeseries-queries.service';
import { AgentMessage } from '../../entities/agent-message.entity';
import { Agent } from '../../entities/agent.entity';
import { TenantCacheService } from '../../common/services/tenant-cache.service';
import {
  MESSAGE_ROW_SELECT_ALIASES,
  EXCLUDE_PLAYGROUND_AGENTS_PREDICATE,
  CUSTOM_PROVIDER_JOIN_CONDITION,
  PROVIDER_SERIES_KEY_EXPR,
} from './query-helpers';
import { CustomProvider } from '../../entities/custom-provider.entity';

describe('TimeseriesQueriesService', () => {
  let service: TimeseriesQueriesService;
  let mockGetRawMany: jest.Mock;
  let mockGetMany: jest.Mock;
  let mockTurnQb: {
    select: jest.Mock;
    addSelect: jest.Mock;
    leftJoin: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    orWhere: jest.Mock;
    groupBy: jest.Mock;
    addGroupBy: jest.Mock;
    orderBy: jest.Mock;
    addOrderBy: jest.Mock;
    limit: jest.Mock;
    setParameter: jest.Mock;
    getRawMany: jest.Mock;
    getRawOne: jest.Mock;
    getMany: jest.Mock;
  };
  let mockAgentQb: {
    select: jest.Mock;
    addSelect: jest.Mock;
    leftJoin: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    orWhere: jest.Mock;
    groupBy: jest.Mock;
    orderBy: jest.Mock;
    getMany: jest.Mock;
    getRawMany: jest.Mock;
  };

  beforeEach(async () => {
    mockGetRawMany = jest.fn().mockResolvedValue([]);
    mockGetMany = jest.fn().mockResolvedValue([]);

    mockTurnQb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      addGroupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      setParameter: jest.fn().mockReturnThis(),
      getRawMany: mockGetRawMany,
      getRawOne: jest.fn().mockResolvedValue({}),
      getMany: mockGetMany,
    };

    mockAgentQb = {
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
        {
          provide: TenantCacheService,
          useValue: { resolve: jest.fn().mockResolvedValue('tenant-123') },
        },
      ],
    }).compile();

    service = module.get<TimeseriesQueriesService>(TimeseriesQueriesService);
  });

  describe('getActiveSkills', () => {
    it('maps DB rows with status field', async () => {
      mockGetRawMany.mockResolvedValue([
        {
          name: 'deploy',
          agent_name: 'bot-1',
          run_count: 5,
          last_active_at: '2026-02-16T10:00:00',
        },
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

    it('excludes the reserved Playground agent when excludePlayground=true', async () => {
      mockGetRawMany.mockResolvedValue([]);
      await service.getActiveSkills('24h', 'u1', undefined, 'tenant-1', true);
      const clauses = mockTurnQb.andWhere.mock.calls.map((c) => c[0]);
      expect(clauses).toContain(EXCLUDE_PLAYGROUND_AGENTS_PREDICATE);
    });

    it('does not exclude playground agents by default', async () => {
      mockGetRawMany.mockResolvedValue([]);
      await service.getActiveSkills('24h', 'u1');
      const clauses = mockTurnQb.andWhere.mock.calls.map((c) => c[0]);
      expect(clauses).not.toContain(EXCLUDE_PLAYGROUND_AGENTS_PREDICATE);
    });
  });

  describe('getCostByModel', () => {
    it('computes share_pct for each model', async () => {
      mockGetRawMany.mockResolvedValue([
        {
          model: 'claude-opus-4-6',
          tokens: 700,
          estimated_cost: 10.0,
          auth_type: 'subscription',
          provider: 'anthropic',
        },
        {
          model: 'gpt-4o',
          tokens: 300,
          estimated_cost: 5.0,
          auth_type: 'api_key',
          provider: 'openai',
        },
      ]);

      const result = await service.getCostByModel('7d', 'u1');
      expect(result).toHaveLength(2);
      expect(result[0].share_pct).toBe(70);
      expect(result[1].share_pct).toBe(30);
      expect(result[0].auth_type).toBe('subscription');
      expect(result[1].auth_type).toBe('api_key');
      expect(result[0].provider).toBe('anthropic');
      expect(result[1].provider).toBe('openai');
    });

    it('returns display_name from model_pricing when available', async () => {
      mockGetRawMany.mockResolvedValue([
        {
          model: 'gpt-4o',
          display_name: 'GPT-4o',
          tokens: 500,
          estimated_cost: 2.0,
          auth_type: null,
          provider: 'openai',
        },
      ]);

      const result = await service.getCostByModel('7d', 'u1');
      expect(result[0].display_name).toBe('GPT-4o');
    });

    it('falls back to model slug when display_name is missing', async () => {
      mockGetRawMany.mockResolvedValue([
        {
          model: 'custom-model',
          tokens: 100,
          estimated_cost: 1.0,
          auth_type: null,
          provider: null,
        },
      ]);

      const result = await service.getCostByModel('7d', 'u1');
      expect(result[0].display_name).toBe('custom-model');
    });

    it('returns 0 share_pct when total tokens is 0', async () => {
      mockGetRawMany.mockResolvedValue([
        { model: 'test', tokens: 0, estimated_cost: 0, provider: null },
      ]);

      const result = await service.getCostByModel('7d', 'u1');
      expect(result[0].share_pct).toBe(0);
      expect(result[0].auth_type).toBeNull();
      expect(result[0].provider).toBeNull();
    });

    it('resolves the custom provider display name', async () => {
      mockGetRawMany.mockResolvedValue([
        {
          model: 'custom:u-1/gpt-oss-120b',
          display_name: 'custom:u-1/gpt-oss-120b',
          tokens: 10,
          estimated_cost: 0.5,
          auth_type: 'api_key',
          provider: 'custom:u-1',
          custom_provider_name: 'MyLLM',
        },
      ]);

      const result = await service.getCostByModel('7d', 'u1');
      expect(mockTurnQb.leftJoin).toHaveBeenCalledWith(
        CustomProvider,
        'cp',
        CUSTOM_PROVIDER_JOIN_CONDITION,
      );
      expect(mockTurnQb.addSelect).toHaveBeenCalledWith('cp.name', 'custom_provider_name');
      expect(mockTurnQb.addGroupBy).toHaveBeenCalledWith('cp.name');
      expect(result[0]).toMatchObject({
        provider: 'custom:u-1',
        custom_provider_name: 'MyLLM',
      });
    });

    it('returns null custom_provider_name for built-in and deleted custom providers', async () => {
      mockGetRawMany.mockResolvedValue([
        {
          model: 'gpt-4o',
          tokens: 5,
          estimated_cost: 0.1,
          auth_type: null,
          provider: 'openai',
          custom_provider_name: null,
        },
      ]);

      const result = await service.getCostByModel('7d', 'u1');
      expect(result[0].custom_provider_name).toBeNull();
    });

    it('excludes the reserved Playground agent when excludePlayground=true', async () => {
      mockGetRawMany.mockResolvedValue([]);
      await service.getCostByModel('7d', 'u1', undefined, 'tenant-1', true);
      const clauses = mockTurnQb.andWhere.mock.calls.map((c) => c[0]);
      expect(clauses).toContain(EXCLUDE_PLAYGROUND_AGENTS_PREDICATE);
    });

    it('does not exclude playground agents by default', async () => {
      mockGetRawMany.mockResolvedValue([]);
      await service.getCostByModel('7d', 'u1');
      const clauses = mockTurnQb.andWhere.mock.calls.map((c) => c[0]);
      expect(clauses).not.toContain(EXCLUDE_PLAYGROUND_AGENTS_PREDICATE);
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

    it('propagates specificity_category rows returned by the helper projection', async () => {
      mockGetRawMany.mockResolvedValue([
        {
          id: '1',
          timestamp: '2026-02-16T10:00:00',
          agent_name: 'bot-1',
          model: 'claude-opus-4-6',
          routing_tier: 'standard',
          routing_reason: 'specificity',
          specificity_category: 'coding',
        },
      ]);
      const rows = (await service.getRecentActivity('24h', 'u1')) as Array<Record<string, unknown>>;
      expect(rows[0]!['specificity_category']).toBe('coding');
    });

    it('projects exactly the columns declared in MESSAGE_ROW_SELECT_ALIASES (regression: helper drift)', async () => {
      mockGetRawMany.mockResolvedValue([]);
      await service.getRecentActivity('24h', 'u1');

      // getRecentActivity routes its column projection through the shared
      // selectMessageRowColumns helper. Any divergence between the helper
      // and this endpoint silently breaks the dashboard message badges, so
      // pin the projected alias set to MESSAGE_ROW_SELECT_ALIASES exactly.
      const projectedAliases = [
        ...mockTurnQb.select.mock.calls.map((call) => call[1] as string),
        ...mockTurnQb.addSelect.mock.calls.map((call) => call[1] as string),
      ];

      expect(mockTurnQb.select).toHaveBeenCalledTimes(1);
      expect(mockTurnQb.addSelect).toHaveBeenCalledTimes(MESSAGE_ROW_SELECT_ALIASES.length - 1);
      expect(projectedAliases).toEqual([...MESSAGE_ROW_SELECT_ALIASES]);
    });

    it('applies tenant isolation via addTenantFilter so cross-tenant data cannot leak', async () => {
      mockGetRawMany.mockResolvedValue([]);
      await service.getRecentActivity('24h', 'u1', 5, undefined, 'tenant-123');

      // When a tenantId is provided the helper filters by tenant_id (not user_id).
      const andWhereCalls = mockTurnQb.andWhere.mock.calls.map((call) => call[0] as string);
      expect(andWhereCalls).toContain('at.tenant_id = :tenantId');
    });

    it('excludes the reserved Playground agent when excludePlayground=true', async () => {
      mockGetRawMany.mockResolvedValue([]);
      await service.getRecentActivity('24h', 'u1', 5, undefined, 'tenant-123', true);
      const clauses = mockTurnQb.andWhere.mock.calls.map((c) => c[0]);
      expect(clauses).toContain(EXCLUDE_PLAYGROUND_AGENTS_PREDICATE);
    });

    it('does not exclude playground agents by default', async () => {
      mockGetRawMany.mockResolvedValue([]);
      await service.getRecentActivity('24h', 'u1');
      const clauses = mockTurnQb.andWhere.mock.calls.map((c) => c[0]);
      expect(clauses).not.toContain(EXCLUDE_PLAYGROUND_AGENTS_PREDICATE);
    });
  });

  describe('getTimeseries', () => {
    it('returns merged token, cost, and message timeseries for hourly', async () => {
      mockGetRawMany.mockResolvedValue([
        { hour: '2026-02-16T10:00:00', input_tokens: 100, output_tokens: 50, cost: 1.5, count: 5 },
        { hour: '2026-02-16T11:00:00', input_tokens: 200, output_tokens: 80, cost: 2.0, count: 8 },
      ]);

      const result = await service.getTimeseries({
        range: '24h',
        userId: 'u1',
        hourly: true,
        tenantId: 'tenant-123',
      });
      expect(result.tokenUsage).toHaveLength(2);
      expect(result.costUsage).toHaveLength(2);
      expect(result.messageUsage).toHaveLength(2);
      expect(result.tokenUsage[0]).toEqual({
        hour: '2026-02-16T10:00:00',
        input_tokens: 100,
        output_tokens: 50,
      });
      expect(result.costUsage[1]).toEqual({ hour: '2026-02-16T11:00:00', cost: 2.0 });
      expect(result.messageUsage[0]).toEqual({ hour: '2026-02-16T10:00:00', count: 5 });
    });

    it('returns merged timeseries for daily buckets', async () => {
      mockGetRawMany.mockResolvedValue([
        { date: '2026-02-15', input_tokens: 500, output_tokens: 300, cost: 5.0, count: 20 },
      ]);

      const result = await service.getTimeseries({
        range: '7d',
        userId: 'u1',
        hourly: false,
        tenantId: 'tenant-123',
      });
      expect(result.tokenUsage).toHaveLength(1);
      expect(result.tokenUsage[0]).toEqual({
        date: '2026-02-15',
        input_tokens: 500,
        output_tokens: 300,
      });
      expect(result.costUsage[0]).toEqual({ date: '2026-02-15', cost: 5.0 });
      expect(result.messageUsage[0]).toEqual({ date: '2026-02-15', count: 20 });
    });

    it('returns empty arrays when no data', async () => {
      mockGetRawMany.mockResolvedValue([]);
      const result = await service.getTimeseries({
        range: '24h',
        userId: 'u1',
        hourly: true,
        tenantId: 'tenant-123',
      });
      expect(result.tokenUsage).toEqual([]);
      expect(result.costUsage).toEqual([]);
      expect(result.messageUsage).toEqual([]);
    });

    it('defaults null values to 0', async () => {
      mockGetRawMany.mockResolvedValue([
        {
          hour: '2026-02-16T10:00:00',
          input_tokens: null,
          output_tokens: null,
          cost: null,
          count: null,
        },
      ]);

      const result = await service.getTimeseries({ range: '24h', userId: 'u1', hourly: true });
      expect(result.tokenUsage[0]).toEqual({
        hour: '2026-02-16T10:00:00',
        input_tokens: 0,
        output_tokens: 0,
      });
      expect(result.costUsage[0]).toEqual({ hour: '2026-02-16T10:00:00', cost: 0 });
      expect(result.messageUsage[0]).toEqual({ hour: '2026-02-16T10:00:00', count: 0 });
    });

    it('passes agentName to tenant filter', async () => {
      mockGetRawMany.mockResolvedValue([]);
      const result = await service.getTimeseries({
        range: '24h',
        userId: 'u1',
        hourly: true,
        tenantId: 'tenant-123',
        agentName: 'bot-1',
      });
      expect(result.tokenUsage).toEqual([]);
    });
  });

  describe('getAgentList', () => {
    const recentIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const oldIso = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString();

    it('excludes the reserved Playground agent by default', async () => {
      await service.getAgentList('u1');
      const clauses = mockAgentQb.andWhere.mock.calls.map((c) => c[0] as string);
      expect(clauses).toContain('a.is_playground = false');
    });

    it('includes playground agents when includePlayground is true (Messages filter)', async () => {
      await service.getAgentList('u1', undefined, true);
      const clauses = mockAgentQb.andWhere.mock.calls.map((c) => c[0] as string);
      expect(clauses).not.toContain('a.is_playground = false');
    });

    it('falls back to the tenant.name = userId join when no tenant resolves', async () => {
      (
        service as unknown as { tenantCache: { resolve: jest.Mock } }
      ).tenantCache.resolve.mockResolvedValueOnce(null);
      await service.getAgentList('u1');
      expect(mockAgentQb.leftJoin).toHaveBeenCalledWith('a.tenant', 't');
      const whereClauses = mockAgentQb.where.mock.calls.map((c) => c[0] as string);
      expect(whereClauses).toContain('t.name = :userId');
    });

    it('returns agents with sparkline data and display_name', async () => {
      mockGetMany.mockResolvedValueOnce([
        { id: 'agent-1', name: 'bot-1', display_name: 'Bot One', created_at: '2026-02-16' },
      ]);
      mockGetRawMany.mockResolvedValueOnce([
        {
          agent_id: 'agent-1',
          date: '2026-02-15',
          message_count: 4,
          cost: 2.0,
          tokens: 400,
          spark_tokens: 100,
          last_active: recentIso,
        },
        {
          agent_id: 'agent-1',
          date: '2026-02-16',
          message_count: 6,
          cost: 3.0,
          tokens: 600,
          spark_tokens: 200,
          last_active: recentIso,
        },
      ]);

      const result = await service.getAgentList('u1');
      expect(result).toHaveLength(1);
      expect(result[0].agent_name).toBe('bot-1');
      expect(result[0].display_name).toBe('Bot One');
      expect(result[0].sparkline).toEqual([100, 200]);
      expect(result[0].total_cost).toBe(5.0);
      expect(result[0].total_tokens).toBe(1000);
      expect(result[0].message_count).toBe(10);
    });

    it('falls back to agent_name when display_name is null', async () => {
      mockGetMany.mockResolvedValueOnce([
        { id: 'agent-1', name: 'bot-1', display_name: null, created_at: '2026-02-16' },
      ]);
      mockGetRawMany.mockResolvedValueOnce([
        {
          agent_id: 'agent-1',
          date: '2026-02-16',
          message_count: 10,
          cost: 5.0,
          tokens: 1000,
          spark_tokens: 0,
          last_active: oldIso,
        },
      ]);

      const result = await service.getAgentList('u1');
      expect(result[0].display_name).toBe('bot-1');
    });

    it('returns empty sparkline for agent with no spark data', async () => {
      mockGetMany.mockResolvedValueOnce([
        { id: 'agent-2', name: 'lonely-bot', display_name: null, created_at: '2026-02-16' },
      ]);
      mockGetRawMany.mockResolvedValueOnce([
        {
          agent_id: 'agent-2',
          date: '2026-02-01',
          message_count: 1,
          cost: 0,
          tokens: 0,
          spark_tokens: 0,
          last_active: oldIso,
        },
      ]);

      const result = await service.getAgentList('u1');
      expect(result[0].sparkline).toEqual([]);
    });

    it('returns agent with zero stats when no telemetry exists', async () => {
      mockGetMany.mockResolvedValueOnce([
        { id: 'agent-3', name: 'new-bot', display_name: null, created_at: '2026-02-16' },
      ]);
      mockGetRawMany.mockResolvedValueOnce([]);

      const result = await service.getAgentList('u1');
      expect(result).toHaveLength(1);
      expect(result[0].agent_name).toBe('new-bot');
      expect(result[0].display_name).toBe('new-bot');
      expect(result[0].message_count).toBe(0);
      expect(result[0].total_cost).toBe(0);
      expect(result[0].sparkline).toEqual([]);
    });
  });

  describe('getTimeseries with authType/provider filters', () => {
    it('applies auth_type and provider andWhere clauses', async () => {
      mockGetRawMany.mockResolvedValue([]);
      await service.getTimeseries({
        range: '24h',
        userId: 'u1',
        hourly: true,
        tenantId: 'tenant-1',
        agentName: 'agent-x',
        authType: 'subscription',
        provider: 'openai',
      });
      const clauses = mockTurnQb.andWhere.mock.calls.map((c) => c[0]);
      expect(clauses).toContain('at.auth_type = :authType');
      expect(clauses).toContain('at.provider = :provider');
    });

    it('excludes the reserved Playground agent when excludePlayground=true', async () => {
      mockGetRawMany.mockResolvedValue([]);
      await service.getTimeseries({
        range: '24h',
        userId: 'u1',
        hourly: true,
        tenantId: 'tenant-1',
        excludePlayground: true,
      });
      const clauses = mockTurnQb.andWhere.mock.calls.map((c) => c[0]);
      expect(clauses).toContain(EXCLUDE_PLAYGROUND_AGENTS_PREDICATE);
      // Semi-join exclusion adds no LEFT JOIN of its own.
      expect(mockTurnQb.leftJoin).not.toHaveBeenCalled();
    });

    it('does not exclude playground agents by default', async () => {
      mockGetRawMany.mockResolvedValue([]);
      await service.getTimeseries({
        range: '24h',
        userId: 'u1',
        hourly: true,
        tenantId: 'tenant-1',
      });
      const clauses = mockTurnQb.andWhere.mock.calls.map((c) => c[0]);
      expect(clauses).not.toContain(EXCLUDE_PLAYGROUND_AGENTS_PREDICATE);
    });

    it('scopes the aggregate timeseries to a connection label when provided', async () => {
      mockGetRawMany.mockResolvedValue([]);
      await service.getTimeseries({
        range: '24h',
        userId: 'u1',
        hourly: true,
        tenantId: 'tenant-1',
        authType: 'api_key',
        provider: 'openai',
        excludePlayground: true,
        label: 'Work',
      });
      const labelCall = mockTurnQb.andWhere.mock.calls.find(
        (c) => c[0] === "LOWER(COALESCE(at.provider_key_label, 'Default')) = LOWER(:keyLabel)",
      );
      expect(labelCall![1]).toEqual({ keyLabel: 'Work' });
    });
  });

  describe('getPerDimensionTimeseries — agent dimension (hourly)', () => {
    const rows = [
      { hour: '01', agent_name: 'bravo', tokens: 5, messages: 2, cost: 0.5 },
      { hour: '01', agent_name: 'alpha', tokens: 10, messages: 1, cost: 1.0 },
      { hour: '02', agent_name: 'alpha', tokens: 3, messages: 4, cost: 0.3 },
    ];

    it('pivots tokens with sorted agents and zero-fill', async () => {
      mockGetRawMany.mockResolvedValue(rows);
      const out = await service.getPerDimensionTimeseries('agent', 'tokens', {
        range: '24h',
        userId: 'u1',
        hourly: true,
        tenantId: 'tenant-1',
        authType: 'subscription',
        provider: 'openai',
      });
      expect(out.agents).toEqual(['alpha', 'bravo']);
      expect(out.timeseries).toEqual([
        { hour: '01', alpha: 10, bravo: 5 },
        { hour: '02', alpha: 3, bravo: 0 },
      ]);
      const clauses = mockTurnQb.andWhere.mock.calls.map((c) => c[0]);
      expect(clauses).toContain(EXCLUDE_PLAYGROUND_AGENTS_PREDICATE);
      expect(clauses).toContain('at.auth_type = :authType');
      expect(clauses).toContain('at.provider = :provider');
      // The NOT EXISTS semi-join matches a playground agent by id OR name and is a
      // pure existence test, so a soft-deleted agent sharing a slug with a live
      // one can never multiply the per-agent SUM. It adds no LEFT JOIN.
      expect(mockTurnQb.leftJoin).not.toHaveBeenCalled();
      // Matching by name (not just id) means a Playground row carrying only
      // agent_name (NULL agent_id) is excluded too — no leak.
      expect(EXCLUDE_PLAYGROUND_AGENTS_PREDICATE).toContain(
        'playag.id = at.agent_id OR playag.name = at.agent_name',
      );
    });

    it('pivots message counts', async () => {
      mockGetRawMany.mockResolvedValue(rows);
      const out = await service.getPerDimensionTimeseries('agent', 'messages', {
        range: '24h',
        userId: 'u1',
        hourly: true,
      });
      expect(out.timeseries[0]).toEqual({ hour: '01', alpha: 1, bravo: 2 });
    });

    it('pivots cost (non-hourly date bucket)', async () => {
      mockGetRawMany.mockResolvedValue([{ date: '2026-01-01', agent_name: 'alpha', cost: 2.5 }]);
      const out = await service.getPerDimensionTimeseries('agent', 'cost', {
        range: '7d',
        userId: 'u1',
        hourly: false,
      });
      expect(out.agents).toEqual(['alpha']);
      expect(out.timeseries).toEqual([{ date: '2026-01-01', alpha: 2.5 }]);
    });

    const labelClause = "LOWER(COALESCE(at.provider_key_label, 'Default')) = LOWER(:keyLabel)";

    it('scopes each per-agent metric to a connection label when provided', async () => {
      mockGetRawMany.mockResolvedValue([]);
      for (const metric of ['tokens', 'messages', 'cost'] as const) {
        await service.getPerDimensionTimeseries('agent', metric, {
          range: '24h',
          userId: 'u1',
          hourly: true,
          tenantId: 't1',
          authType: 'api_key',
          provider: 'openai',
          label: 'Work',
        });
      }
      const labelCalls = mockTurnQb.andWhere.mock.calls.filter((c) => c[0] === labelClause);
      expect(labelCalls).toHaveLength(3);
      for (const call of labelCalls) expect(call[1]).toEqual({ keyLabel: 'Work' });
    });

    it('treats a legacy empty connection label as Default in the per-agent filter', async () => {
      mockGetRawMany.mockResolvedValue([]);
      await service.getPerDimensionTimeseries('agent', 'tokens', {
        range: '24h',
        userId: 'u1',
        hourly: true,
        tenantId: 't1',
        authType: 'api_key',
        provider: 'openai',
        label: '',
      });
      const labelCall = mockTurnQb.andWhere.mock.calls.find((c) => c[0] === labelClause);
      expect(labelCall![1]).toEqual({ keyLabel: 'Default' });
    });

    it('omits the label filter when no label is given', async () => {
      mockGetRawMany.mockResolvedValue([]);
      await service.getPerDimensionTimeseries('agent', 'tokens', {
        range: '24h',
        userId: 'u1',
        hourly: true,
        tenantId: 't1',
        authType: 'api_key',
        provider: 'openai',
      });
      expect(mockTurnQb.andWhere.mock.calls.some((c) => c[0] === labelClause)).toBe(false);
    });

    it('scopes to a connection by user_providers id when provided (id wins over label)', async () => {
      mockGetRawMany.mockResolvedValue([]);
      await service.getPerDimensionTimeseries('agent', 'tokens', {
        range: '24h',
        userId: 'u1',
        hourly: true,
        tenantId: 't1',
        userProviderId: 'conn-1',
        label: 'Work',
      });
      const idCall = mockTurnQb.andWhere.mock.calls.find(
        (c) => c[0] === 'at.user_provider_id = :userProviderId',
      );
      expect(idCall![1]).toEqual({ userProviderId: 'conn-1' });
      expect(mockTurnQb.andWhere.mock.calls.some((c) => c[0] === labelClause)).toBe(false);
    });
  });

  describe('getPerDimensionTimeseries — provider dimension', () => {
    it('filters by the live agent id and pivots tokens', async () => {
      mockGetRawMany.mockResolvedValue([
        { hour: '01', provider: 'openai', tokens: 7 },
        { hour: '01', provider: 'anthropic', tokens: 3 },
      ]);
      const out = await service.getPerDimensionTimeseries('provider', 'tokens', {
        range: '24h',
        userId: 'u1',
        hourly: true,
        tenantId: 'tenant-1',
        agentName: 'agent-x',
      });
      expect(out.agents).toEqual(['anthropic', 'openai']);
      expect(out.timeseries[0]).toEqual({ hour: '01', anthropic: 3, openai: 7 });
      const clauses = mockTurnQb.andWhere.mock.calls.map((c) => c[0]);
      // Scope to the LIVE agent owning the slug (agent_id subquery), not a raw
      // name match — a soft-deleted agent sharing the slug must not leak rows.
      const liveAgentClause = clauses.find(
        (c) =>
          typeof c === 'string' &&
          c.includes('at.agent_id = (') &&
          c.includes('deleted_at IS NULL'),
      );
      expect(liveAgentClause).toBeDefined();
      expect(clauses).not.toContain('at.agent_name = :agentName');
      const liveAgentCall = mockTurnQb.andWhere.mock.calls.find(
        (c) => typeof c[0] === 'string' && c[0].includes('at.agent_id = ('),
      );
      expect(liveAgentCall![1]).toEqual({ liveAgentName: 'agent-x', liveTenantId: 'tenant-1' });
      // Playground (is_playground) usage must be excluded from per-provider totals,
      // via the same NOT EXISTS semi-join as the per-agent endpoints (no join).
      expect(clauses).toContain(EXCLUDE_PLAYGROUND_AGENTS_PREDICATE);
      // Custom provider names resolve via the cp join (built-ins join to NULL).
      expect(mockTurnQb.leftJoin).toHaveBeenCalledWith(
        CustomProvider,
        'cp',
        CUSTOM_PROVIDER_JOIN_CONDITION,
      );
    });

    it('resolves custom series keys via the CASE expression in all per-provider metrics', async () => {
      mockGetRawMany.mockResolvedValue([
        { hour: '01', provider: 'MyLLM', tokens: 7 },
        { hour: '01', provider: 'openai', tokens: 3 },
      ]);
      const out = await service.getPerDimensionTimeseries('provider', 'tokens', {
        range: '24h',
        userId: 'u1',
        hourly: true,
      });
      expect(mockTurnQb.addSelect).toHaveBeenCalledWith(PROVIDER_SERIES_KEY_EXPR, 'provider');
      expect(mockTurnQb.addGroupBy).toHaveBeenCalledWith(PROVIDER_SERIES_KEY_EXPR);
      expect(out.agents).toEqual(['MyLLM', 'openai']);

      for (const metric of ['messages', 'cost'] as const) {
        mockTurnQb.addSelect.mockClear();
        mockTurnQb.addGroupBy.mockClear();
        mockTurnQb.leftJoin.mockClear();
        await service.getPerDimensionTimeseries('provider', metric, {
          range: '24h',
          userId: 'u1',
          hourly: true,
        });
        expect(mockTurnQb.leftJoin).toHaveBeenCalledWith(
          CustomProvider,
          'cp',
          CUSTOM_PROVIDER_JOIN_CONDITION,
        );
        expect(mockTurnQb.addSelect).toHaveBeenCalledWith(PROVIDER_SERIES_KEY_EXPR, 'provider');
        expect(mockTurnQb.addGroupBy).toHaveBeenCalledWith(PROVIDER_SERIES_KEY_EXPR);
      }
    });

    it('omits the agent filter entirely when no agent is given', async () => {
      mockGetRawMany.mockResolvedValue([{ hour: '01', provider: 'openai', tokens: 1 }]);
      await service.getPerDimensionTimeseries('provider', 'tokens', {
        range: '24h',
        userId: 'u1',
        hourly: true,
        tenantId: 'tenant-1',
      });
      const clauses = mockTurnQb.andWhere.mock.calls.map((c) => c[0]);
      expect(clauses.some((c) => typeof c === 'string' && c.includes('at.agent_id = ('))).toBe(
        false,
      );
    });

    it('pivots message counts', async () => {
      mockGetRawMany.mockResolvedValue([{ hour: '01', provider: 'openai', messages: 4 }]);
      const out = await service.getPerDimensionTimeseries('provider', 'messages', {
        range: '24h',
        userId: 'u1',
        hourly: true,
      });
      expect(out.timeseries).toEqual([{ hour: '01', openai: 4 }]);
    });

    it('pivots cost', async () => {
      mockGetRawMany.mockResolvedValue([{ hour: '01', provider: 'openai', cost: 1.25 }]);
      const out = await service.getPerDimensionTimeseries('provider', 'cost', {
        range: '24h',
        userId: 'u1',
        hourly: true,
      });
      expect(out.timeseries).toEqual([{ hour: '01', openai: 1.25 }]);
    });

    it('zero-fills missing values from null', async () => {
      mockGetRawMany.mockResolvedValue([{ hour: '01', provider: 'openai', tokens: null }]);
      const out = await service.getPerDimensionTimeseries('provider', 'tokens', {
        range: '24h',
        userId: 'u1',
        hourly: true,
      });
      expect(out.timeseries).toEqual([{ hour: '01', openai: 0 }]);
    });
  });
});
