import { ProviderAnalyticsController } from './provider-analytics.controller';
import type { AggregationService } from '../services/aggregation.service';
import type { TimeseriesQueriesService } from '../services/timeseries-queries.service';
import type { ConnectionDetailService } from '../services/connection-detail.service';
import type { TenantCacheService } from '../../common/services/tenant-cache.service';
import type { AuthUser } from '../../auth/auth.instance';

const user = { id: 'u1' } as AuthUser;

describe('ProviderAnalyticsController', () => {
  let aggregation: { getSummaryMetrics: jest.Mock };
  let timeseries: { getTimeseries: jest.Mock; getPerDimensionTimeseries: jest.Mock };
  let connectionDetail: { getConnectionDetail: jest.Mock };
  let tenantCache: { resolve: jest.Mock };
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
      getPerDimensionTimeseries: jest.fn().mockResolvedValue({ agents: ['a'], timeseries: [] }),
    };
    connectionDetail = {
      getConnectionDetail: jest
        .fn()
        .mockResolvedValue({ connection: null, agents: [], model_usage: [], recent_messages: [] }),
    };
    tenantCache = { resolve: jest.fn().mockResolvedValue('tenant-1') };

    controller = new ProviderAnalyticsController(
      aggregation as unknown as AggregationService,
      timeseries as unknown as TimeseriesQueriesService,
      connectionDetail as unknown as ConnectionDetailService,
      tenantCache as unknown as TenantCacheService,
    );
  });

  describe('getAnalytics', () => {
    it('returns summary + timeseries for default range (24h, hourly), excluding Playground', async () => {
      const out = await controller.getAnalytics(user, 'subscription');
      expect(aggregation.getSummaryMetrics).toHaveBeenCalledWith({
        range: '24h',
        userId: 'u1',
        tenantId: 'tenant-1',
        agentName: undefined,
        authType: 'subscription',
        provider: undefined,
        excludePlayground: true,
        label: undefined,
        userProviderId: undefined,
      });
      expect(timeseries.getTimeseries).toHaveBeenCalledWith({
        range: '24h',
        userId: 'u1',
        hourly: true,
        tenantId: 'tenant-1',
        agentName: undefined,
        authType: 'subscription',
        provider: undefined,
        excludePlayground: true,
        label: undefined,
        userProviderId: undefined,
      });
      expect(out.summary.messages).toEqual({ value: 5 });
      expect(out.token_usage).toEqual([{ hour: '01' }]);
    });

    it('honors 7d range (non-hourly) and agent + provider filters', async () => {
      await controller.getAnalytics(user, 'api_key', '7d', 'agent-x', 'openai');
      expect(timeseries.getTimeseries).toHaveBeenCalledWith({
        range: '7d',
        userId: 'u1',
        hourly: false,
        tenantId: 'tenant-1',
        agentName: 'agent-x',
        authType: 'api_key',
        provider: 'openai',
        excludePlayground: true,
        label: undefined,
        userProviderId: undefined,
      });
    });

    it('honors 30d range', async () => {
      await controller.getAnalytics(user, undefined, '30d');
      expect(aggregation.getSummaryMetrics).toHaveBeenCalledWith({
        range: '30d',
        userId: 'u1',
        tenantId: 'tenant-1',
        agentName: undefined,
        authType: undefined,
        provider: undefined,
        excludePlayground: true,
        label: undefined,
        userProviderId: undefined,
      });
    });

    it('falls back to undefined tenantId when unresolved', async () => {
      tenantCache.resolve.mockResolvedValue(null);
      await controller.getAnalytics(user, 'subscription');
      expect(timeseries.getTimeseries).toHaveBeenCalledWith({
        range: '24h',
        userId: 'u1',
        hourly: true,
        tenantId: undefined,
        agentName: undefined,
        authType: 'subscription',
        provider: undefined,
        excludePlayground: true,
        label: undefined,
        userProviderId: undefined,
      });
    });

    it('scopes summary + timeseries to a connection label', async () => {
      await controller.getAnalytics(user, 'api_key', '7d', undefined, 'openai', 'Work');
      expect(aggregation.getSummaryMetrics).toHaveBeenCalledWith({
        range: '7d',
        userId: 'u1',
        tenantId: 'tenant-1',
        agentName: undefined,
        authType: 'api_key',
        provider: 'openai',
        excludePlayground: true,
        label: 'Work',
        userProviderId: undefined,
      });
      expect(timeseries.getTimeseries).toHaveBeenCalledWith({
        range: '7d',
        userId: 'u1',
        hourly: false,
        tenantId: 'tenant-1',
        agentName: undefined,
        authType: 'api_key',
        provider: 'openai',
        excludePlayground: true,
        label: 'Work',
        userProviderId: undefined,
      });
    });

    it('scopes summary + timeseries to an exact connection id when connection_id is given', async () => {
      await controller.getAnalytics(user, 'api_key', '7d', undefined, 'openai', 'Work', 'conn-123');
      // connection_id rides as userProviderId; the services prefer it over the
      // provider/auth_type/label tuple.
      expect(aggregation.getSummaryMetrics).toHaveBeenCalledWith({
        range: '7d',
        userId: 'u1',
        tenantId: 'tenant-1',
        agentName: undefined,
        authType: 'api_key',
        provider: 'openai',
        excludePlayground: true,
        label: 'Work',
        userProviderId: 'conn-123',
      });
      expect(timeseries.getTimeseries).toHaveBeenCalledWith({
        range: '7d',
        userId: 'u1',
        hourly: false,
        tenantId: 'tenant-1',
        agentName: undefined,
        authType: 'api_key',
        provider: 'openai',
        excludePlayground: true,
        label: 'Work',
        userProviderId: 'conn-123',
      });
    });
  });

  describe('per-agent timeseries endpoints', () => {
    it('getPerAgentTimeseries delegates to getPerDimensionTimeseries(agent, tokens) with hourly default', async () => {
      const out = await controller.getPerAgentTimeseries(user, 'subscription', 'openai');
      expect(timeseries.getPerDimensionTimeseries).toHaveBeenCalledWith('agent', 'tokens', {
        range: '24h',
        userId: 'u1',
        hourly: true,
        tenantId: 'tenant-1',
        authType: 'subscription',
        provider: 'openai',
        label: undefined,
        userProviderId: undefined,
      });
      expect(out).toEqual({ agents: ['a'], timeseries: [] });
    });

    it('getPerAgentMessageTimeseries honors 30d', async () => {
      await controller.getPerAgentMessageTimeseries(user, 'subscription', 'openai', '30d');
      expect(timeseries.getPerDimensionTimeseries).toHaveBeenCalledWith('agent', 'messages', {
        range: '30d',
        userId: 'u1',
        hourly: false,
        tenantId: 'tenant-1',
        authType: 'subscription',
        provider: 'openai',
        label: undefined,
        userProviderId: undefined,
      });
    });

    it('getPerAgentCostTimeseries honors 7d', async () => {
      await controller.getPerAgentCostTimeseries(user, 'api_key', 'anthropic', '7d');
      expect(timeseries.getPerDimensionTimeseries).toHaveBeenCalledWith('agent', 'cost', {
        range: '7d',
        userId: 'u1',
        hourly: false,
        tenantId: 'tenant-1',
        authType: 'api_key',
        provider: 'anthropic',
        label: undefined,
        userProviderId: undefined,
      });
    });

    it('forwards the connection label to every per-agent timeseries query', async () => {
      await controller.getPerAgentTimeseries(user, 'api_key', 'openai', '7d', 'Work');
      await controller.getPerAgentMessageTimeseries(user, 'api_key', 'openai', '7d', 'Work');
      await controller.getPerAgentCostTimeseries(user, 'api_key', 'openai', '7d', 'Work');
      const baseOptions = {
        range: '7d',
        userId: 'u1',
        hourly: false,
        tenantId: 'tenant-1',
        authType: 'api_key',
        provider: 'openai',
        label: 'Work',
        userProviderId: undefined,
      };
      expect(timeseries.getPerDimensionTimeseries).toHaveBeenCalledWith(
        'agent',
        'tokens',
        baseOptions,
      );
      expect(timeseries.getPerDimensionTimeseries).toHaveBeenCalledWith(
        'agent',
        'messages',
        baseOptions,
      );
      expect(timeseries.getPerDimensionTimeseries).toHaveBeenCalledWith(
        'agent',
        'cost',
        baseOptions,
      );
    });

    it('forwards connection_id to every per-agent timeseries query', async () => {
      await controller.getPerAgentTimeseries(user, 'api_key', 'openai', '7d', 'Work', 'conn-9');
      await controller.getPerAgentMessageTimeseries(
        user,
        'api_key',
        'openai',
        '7d',
        'Work',
        'conn-9',
      );
      await controller.getPerAgentCostTimeseries(user, 'api_key', 'openai', '7d', 'Work', 'conn-9');
      const baseOptions = {
        range: '7d',
        userId: 'u1',
        hourly: false,
        tenantId: 'tenant-1',
        authType: 'api_key',
        provider: 'openai',
        label: 'Work',
        userProviderId: 'conn-9',
      };
      expect(timeseries.getPerDimensionTimeseries).toHaveBeenCalledWith(
        'agent',
        'tokens',
        baseOptions,
      );
      expect(timeseries.getPerDimensionTimeseries).toHaveBeenCalledWith(
        'agent',
        'messages',
        baseOptions,
      );
      expect(timeseries.getPerDimensionTimeseries).toHaveBeenCalledWith(
        'agent',
        'cost',
        baseOptions,
      );
    });
  });

  describe('getConnectionDetail', () => {
    it('delegates to ConnectionDetailService with the user id and connection id', async () => {
      const detail = {
        connection: { id: 'c1' },
        agents: [],
        model_usage: [],
        recent_messages: [],
      };
      connectionDetail.getConnectionDetail.mockResolvedValue(detail);
      const out = await controller.getConnectionDetail(user, 'c1');
      expect(connectionDetail.getConnectionDetail).toHaveBeenCalledWith('u1', 'c1');
      expect(out).toBe(detail);
    });

    it('passes an undefined connection id straight through to the service', async () => {
      await controller.getConnectionDetail(user, undefined);
      expect(connectionDetail.getConnectionDetail).toHaveBeenCalledWith('u1', undefined);
    });
  });
});
