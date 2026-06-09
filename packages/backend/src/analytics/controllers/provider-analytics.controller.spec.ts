import { ProviderAnalyticsController } from './provider-analytics.controller';
import type { AggregationService } from '../services/aggregation.service';
import type { TimeseriesQueriesService } from '../services/timeseries-queries.service';
import type { TenantCacheService } from '../../common/services/tenant-cache.service';
import type { Repository } from 'typeorm';
import type { UserProvider } from '../../entities/user-provider.entity';
import type { AgentMessage } from '../../entities/agent-message.entity';
import type { Tenant } from '../../entities/tenant.entity';
import type { AuthUser } from '../../auth/auth.instance';

const user = { id: 'u1' } as AuthUser;

interface ConnectionDetailFull {
  connection: { last_used_at: string | null; [k: string]: unknown };
  agents: Array<Record<string, unknown>>;
  model_usage: Array<Record<string, unknown>>;
  recent_messages: Array<Record<string, unknown>>;
}

/**
 * A chainable QueryBuilder mock whose terminal getRawOne/getRawMany return
 * values are supplied per-instance. The controller builds a fresh builder for
 * each query, so each createQueryBuilder() call shifts the next scripted result.
 */
function makeQb(result: { rawOne?: unknown; rawMany?: unknown[] }) {
  const qb: Record<string, jest.Mock> = {
    select: jest.fn(),
    addSelect: jest.fn(),
    leftJoin: jest.fn(),
    where: jest.fn(),
    andWhere: jest.fn(),
    groupBy: jest.fn(),
    orderBy: jest.fn(),
    limit: jest.fn(),
    getRawOne: jest.fn().mockResolvedValue(result.rawOne),
    getRawMany: jest.fn().mockResolvedValue(result.rawMany ?? []),
  };
  for (const k of Object.keys(qb)) {
    if (!k.startsWith('getRaw')) qb[k].mockReturnValue(qb);
  }
  return qb;
}

describe('ProviderAnalyticsController', () => {
  let aggregation: { getSummaryMetrics: jest.Mock };
  let timeseries: {
    getTimeseries: jest.Mock;
    getPerAgentTimeseries: jest.Mock;
    getPerAgentMessageTimeseries: jest.Mock;
    getPerAgentCostTimeseries: jest.Mock;
    getAgentNamesByAuthType: jest.Mock;
  };
  let tenantCache: { resolve: jest.Mock };
  let providerRepo: { findOne: jest.Mock };
  let messageRepo: { createQueryBuilder: jest.Mock };
  let tenantRepo: { findOne: jest.Mock };
  let controller: ProviderAnalyticsController;

  beforeEach(() => {
    aggregation = {
      getSummaryMetrics: jest.fn().mockResolvedValue({
        messages: { value: 5 },
        tokens: { tokens_today: { value: 100 } },
      }),
    };
    timeseries = {
      getTimeseries: jest
        .fn()
        .mockResolvedValue({ tokenUsage: [{ hour: '01' }], messageUsage: [{ hour: '01' }] }),
      getPerAgentTimeseries: jest.fn().mockResolvedValue({ agents: ['a'], timeseries: [] }),
      getPerAgentMessageTimeseries: jest.fn().mockResolvedValue({ agents: ['a'], timeseries: [] }),
      getPerAgentCostTimeseries: jest.fn().mockResolvedValue({ agents: ['a'], timeseries: [] }),
      getAgentNamesByAuthType: jest.fn().mockResolvedValue(['agent-1']),
    };
    tenantCache = { resolve: jest.fn().mockResolvedValue('tenant-1') };
    providerRepo = { findOne: jest.fn() };
    messageRepo = { createQueryBuilder: jest.fn() };
    tenantRepo = { findOne: jest.fn() };

    controller = new ProviderAnalyticsController(
      aggregation as unknown as AggregationService,
      timeseries as unknown as TimeseriesQueriesService,
      tenantCache as unknown as TenantCacheService,
      providerRepo as unknown as Repository<UserProvider>,
      messageRepo as unknown as Repository<AgentMessage>,
      tenantRepo as unknown as Repository<Tenant>,
    );
  });

  describe('getAnalytics', () => {
    it('returns summary + timeseries for default range (24h, hourly)', async () => {
      const out = await controller.getAnalytics(user, 'subscription');
      // Final `true` arg = excludeSystem: Playground usage must not pollute
      // provider analytics aggregates.
      expect(aggregation.getSummaryMetrics).toHaveBeenCalledWith(
        '24h',
        'u1',
        'tenant-1',
        undefined,
        'subscription',
        undefined,
        true,
        undefined,
      );
      expect(timeseries.getTimeseries).toHaveBeenCalledWith(
        '24h',
        'u1',
        true,
        'tenant-1',
        undefined,
        'subscription',
        undefined,
        true,
        undefined,
      );
      expect(out.summary.messages).toEqual({ value: 5 });
      expect(out.token_usage).toEqual([{ hour: '01' }]);
    });

    it('honors 7d range (non-hourly) and agent + provider filters', async () => {
      await controller.getAnalytics(user, 'api_key', '7d', 'agent-x', 'openai');
      expect(timeseries.getTimeseries).toHaveBeenCalledWith(
        '7d',
        'u1',
        false,
        'tenant-1',
        'agent-x',
        'api_key',
        'openai',
        true,
        undefined,
      );
    });

    it('honors 30d range', async () => {
      await controller.getAnalytics(user, undefined, '30d');
      expect(aggregation.getSummaryMetrics).toHaveBeenCalledWith(
        '30d',
        'u1',
        'tenant-1',
        undefined,
        undefined,
        undefined,
        true,
        undefined,
      );
    });

    it('falls back to undefined tenantId when unresolved', async () => {
      tenantCache.resolve.mockResolvedValue(null);
      await controller.getAnalytics(user, 'subscription');
      expect(timeseries.getTimeseries).toHaveBeenCalledWith(
        '24h',
        'u1',
        true,
        undefined,
        undefined,
        'subscription',
        undefined,
        true,
        undefined,
      );
    });

    it('scopes summary + timeseries to a connection label', async () => {
      await controller.getAnalytics(user, 'api_key', '7d', undefined, 'openai', 'Work');
      expect(aggregation.getSummaryMetrics).toHaveBeenCalledWith(
        '7d',
        'u1',
        'tenant-1',
        undefined,
        'api_key',
        'openai',
        true,
        'Work',
      );
      expect(timeseries.getTimeseries).toHaveBeenCalledWith(
        '7d',
        'u1',
        false,
        'tenant-1',
        undefined,
        'api_key',
        'openai',
        true,
        'Work',
      );
    });
  });

  describe('per-agent timeseries endpoints', () => {
    it('getPerAgentTimeseries delegates with hourly default', async () => {
      const out = await controller.getPerAgentTimeseries(user, 'subscription', 'openai');
      expect(timeseries.getPerAgentTimeseries).toHaveBeenCalledWith(
        '24h',
        'u1',
        true,
        'tenant-1',
        'subscription',
        'openai',
        undefined,
      );
      expect(out).toEqual({ agents: ['a'], timeseries: [] });
    });

    it('getPerAgentMessageTimeseries honors 30d', async () => {
      await controller.getPerAgentMessageTimeseries(user, 'subscription', 'openai', '30d');
      expect(timeseries.getPerAgentMessageTimeseries).toHaveBeenCalledWith(
        '30d',
        'u1',
        false,
        'tenant-1',
        'subscription',
        'openai',
        undefined,
      );
    });

    it('getPerAgentCostTimeseries honors 7d', async () => {
      await controller.getPerAgentCostTimeseries(user, 'api_key', 'anthropic', '7d');
      expect(timeseries.getPerAgentCostTimeseries).toHaveBeenCalledWith(
        '7d',
        'u1',
        false,
        'tenant-1',
        'api_key',
        'anthropic',
        undefined,
      );
    });

    it('forwards the connection label to every per-agent timeseries query', async () => {
      await controller.getPerAgentTimeseries(user, 'api_key', 'openai', '7d', 'Work');
      await controller.getPerAgentMessageTimeseries(user, 'api_key', 'openai', '7d', 'Work');
      await controller.getPerAgentCostTimeseries(user, 'api_key', 'openai', '7d', 'Work');
      expect(timeseries.getPerAgentTimeseries).toHaveBeenCalledWith(
        '7d',
        'u1',
        false,
        'tenant-1',
        'api_key',
        'openai',
        'Work',
      );
      expect(timeseries.getPerAgentMessageTimeseries).toHaveBeenCalledWith(
        '7d',
        'u1',
        false,
        'tenant-1',
        'api_key',
        'openai',
        'Work',
      );
      expect(timeseries.getPerAgentCostTimeseries).toHaveBeenCalledWith(
        '7d',
        'u1',
        false,
        'tenant-1',
        'api_key',
        'openai',
        'Work',
      );
    });
  });

  describe('getAgents', () => {
    it('returns agent names with explicit auth_type', async () => {
      const out = await controller.getAgents(user, 'api_key');
      expect(timeseries.getAgentNamesByAuthType).toHaveBeenCalledWith('api_key', 'u1', 'tenant-1');
      expect(out).toEqual({ agents: ['agent-1'] });
    });

    it('defaults auth_type to subscription', async () => {
      await controller.getAgents(user);
      expect(timeseries.getAgentNamesByAuthType).toHaveBeenCalledWith(
        'subscription',
        'u1',
        'tenant-1',
      );
    });
  });

  describe('getConnectionDetail', () => {
    it('returns empty shape when connection_id is missing', async () => {
      const out = await controller.getConnectionDetail(user, undefined);
      expect(out).toEqual({ connection: null, agents: [], recent_messages: [] });
    });

    it('returns empty shape when the connection is not found / not owned', async () => {
      providerRepo.findOne.mockResolvedValue(null);
      const out = await controller.getConnectionDetail(user, 'c1');
      expect(providerRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'c1', user_id: 'u1' },
      });
      expect(out).toEqual({ connection: null, agents: [], recent_messages: [] });
    });

    it('returns connection-only shape when tenant is missing', async () => {
      providerRepo.findOne.mockResolvedValue({
        id: 'c1',
        provider: 'openai',
        auth_type: 'api_key',
        label: 'My OpenAI',
        cached_models: [{ id: 'm1' }, { id: 'm2' }],
        key_prefix: 'sk-abc',
        connected_at: '2026-01-01',
      });
      tenantRepo.findOne.mockResolvedValue(null);

      const out = (await controller.getConnectionDetail(
        user,
        'c1',
      )) as unknown as ConnectionDetailFull;
      expect(out.connection).toMatchObject({ id: 'c1', cached_model_count: 2 });
      expect(out.agents).toEqual([]);
      expect(out.model_usage).toEqual([]);
      expect(out.recent_messages).toEqual([]);
    });

    it('aggregates agents, models and recent messages with percentages', async () => {
      providerRepo.findOne.mockResolvedValue({
        id: 'c1',
        provider: 'openai',
        auth_type: 'api_key',
        label: 'My OpenAI',
        cached_models: null, // non-array -> count 0
        key_prefix: 'sk-abc',
        connected_at: '2026-01-01',
        is_active: true,
      });
      tenantRepo.findOne.mockResolvedValue({ id: 'tenant-1' });

      const lastUsedDate = new Date('2026-02-01T10:00:00Z');
      // Query order in controller: lastUsed, agentRows, modelRows, recentMessages
      messageRepo.createQueryBuilder
        .mockReturnValueOnce(makeQb({ rawOne: { last_used_at: lastUsedDate } }))
        .mockReturnValueOnce(
          makeQb({
            rawMany: [
              {
                agent_name: 'agent-a',
                tokens: 80,
                cost: 1.5,
                messages: 3,
                last_used: lastUsedDate,
                agent_platform: 'openclaw',
              },
              {
                agent_name: 'agent-b',
                tokens: 20,
                cost: 0.5,
                messages: 1,
                last_used: '2026-02-01T09:00:00Z',
                agent_platform: null,
              },
            ],
          }),
        )
        .mockReturnValueOnce(
          makeQb({
            rawMany: [
              { model: 'gpt-4o', tokens: 60, cost: 1.0, messages: 2 },
              { model: 'gpt-4o-mini', tokens: 40, cost: 0.2, messages: 2 },
            ],
          }),
        )
        .mockReturnValueOnce(makeQb({ rawMany: [{ id: 'msg-1' }] }));

      const out = (await controller.getConnectionDetail(
        user,
        'c1',
      )) as unknown as ConnectionDetailFull;

      expect(out.connection).toMatchObject({
        id: 'c1',
        cached_model_count: 0,
        is_active: true,
        last_used_at: lastUsedDate.toISOString(),
      });
      // agent percentages: 80/100=80, 20/100=20
      expect(out.agents[0]).toMatchObject({
        agent_name: 'agent-a',
        agent_platform: 'openclaw',
        pct_of_total: 80,
        last_used: lastUsedDate.toISOString(),
      });
      expect(out.agents[1]).toMatchObject({
        agent_name: 'agent-b',
        agent_platform: null,
        pct_of_total: 20,
        last_used: '2026-02-01T09:00:00Z',
      });
      // model percentages: 60/100=60, 40/100=40
      expect(out.model_usage[0]).toMatchObject({ model: 'gpt-4o', pct_of_total: 60 });
      expect(out.model_usage[1]).toMatchObject({ model: 'gpt-4o-mini', pct_of_total: 40 });
      expect(out.recent_messages).toEqual([{ id: 'msg-1' }]);
    });

    it('handles zero totals (pct 0), null last_used and string last_used_at', async () => {
      providerRepo.findOne.mockResolvedValue({
        id: 'c1',
        provider: 'openai',
        auth_type: 'api_key',
        label: 'My OpenAI',
        cached_models: null,
        key_prefix: null,
        connected_at: '2026-01-01',
        is_active: false,
      });
      tenantRepo.findOne.mockResolvedValue({ id: 'tenant-1' });

      messageRepo.createQueryBuilder
        // last_used_at as a raw string (not a Date)
        .mockReturnValueOnce(makeQb({ rawOne: { last_used_at: '2026-02-01T00:00:00Z' } }))
        .mockReturnValueOnce(
          makeQb({
            rawMany: [{ agent_name: 'agent-a', tokens: 0, cost: 0, messages: 0, last_used: null }],
          }),
        )
        .mockReturnValueOnce(
          makeQb({ rawMany: [{ model: 'gpt-4o', tokens: 0, cost: 0, messages: 0 }] }),
        )
        .mockReturnValueOnce(makeQb({ rawMany: [] }));

      const out = (await controller.getConnectionDetail(
        user,
        'c1',
      )) as unknown as ConnectionDetailFull;
      expect(out.connection.last_used_at).toBe('2026-02-01T00:00:00Z');
      expect(out.agents[0].pct_of_total).toBe(0);
      expect(out.agents[0].last_used).toBeNull();
      expect(out.model_usage[0].pct_of_total).toBe(0);
    });

    it('filters every usage query by the connection label (case-insensitive, NULL->Default)', async () => {
      // Two keys share provider+auth_type but differ by label. The detail for
      // the "Work" connection must filter every usage query by that label so a
      // sibling "Personal" key's usage never bleeds in.
      providerRepo.findOne.mockResolvedValue({
        id: 'c1',
        provider: 'openai',
        auth_type: 'api_key',
        label: 'Work',
        cached_models: [],
        key_prefix: 'sk',
        connected_at: '2026-01-01',
        is_active: true,
      });
      tenantRepo.findOne.mockResolvedValue({ id: 'tenant-1' });

      const qbs = [
        makeQb({ rawOne: { last_used_at: null } }),
        makeQb({ rawMany: [] }),
        makeQb({ rawMany: [] }),
        makeQb({ rawMany: [] }),
      ];
      messageRepo.createQueryBuilder
        .mockReturnValueOnce(qbs[0])
        .mockReturnValueOnce(qbs[1])
        .mockReturnValueOnce(qbs[2])
        .mockReturnValueOnce(qbs[3]);

      await controller.getConnectionDetail(user, 'c1');

      // Every one of the four usage builders must carry the label predicate
      // with the connection's label bound case-insensitively.
      for (const qb of qbs) {
        const labelCall = qb.andWhere.mock.calls.find((c) =>
          String(c[0]).includes("LOWER(COALESCE(at.provider_key_label, 'Default'))"),
        );
        expect(labelCall).toBeDefined();
        expect(labelCall![1]).toEqual({ keyLabel: 'Work' });
      }
    });

    it('treats a legacy NULL connection label as Default in the usage filter', async () => {
      providerRepo.findOne.mockResolvedValue({
        id: 'c1',
        provider: 'openai',
        auth_type: 'api_key',
        label: null,
        cached_models: [],
        key_prefix: 'sk',
        connected_at: '2026-01-01',
        is_active: true,
      });
      tenantRepo.findOne.mockResolvedValue({ id: 'tenant-1' });

      const firstQb = makeQb({ rawOne: { last_used_at: null } });
      messageRepo.createQueryBuilder
        .mockReturnValueOnce(firstQb)
        .mockReturnValueOnce(makeQb({ rawMany: [] }))
        .mockReturnValueOnce(makeQb({ rawMany: [] }))
        .mockReturnValueOnce(makeQb({ rawMany: [] }));

      await controller.getConnectionDetail(user, 'c1');

      const labelCall = firstQb.andWhere.mock.calls.find((c) =>
        String(c[0]).includes("LOWER(COALESCE(at.provider_key_label, 'Default'))"),
      );
      expect(labelCall![1]).toEqual({ keyLabel: 'Default' });
    });

    it('returns null last_used_at when no rows have ever been recorded', async () => {
      providerRepo.findOne.mockResolvedValue({
        id: 'c1',
        provider: 'openai',
        auth_type: 'api_key',
        label: 'My OpenAI',
        cached_models: [],
        key_prefix: 'sk',
        connected_at: '2026-01-01',
        is_active: true,
      });
      tenantRepo.findOne.mockResolvedValue({ id: 'tenant-1' });

      messageRepo.createQueryBuilder
        .mockReturnValueOnce(makeQb({ rawOne: { last_used_at: null } }))
        .mockReturnValueOnce(makeQb({ rawMany: [] }))
        .mockReturnValueOnce(makeQb({ rawMany: [] }))
        .mockReturnValueOnce(makeQb({ rawMany: [] }));

      const out = (await controller.getConnectionDetail(
        user,
        'c1',
      )) as unknown as ConnectionDetailFull;
      expect(out.connection.last_used_at).toBeNull();
      expect(out.agents).toEqual([]);
      expect(out.model_usage).toEqual([]);
    });
  });
});
