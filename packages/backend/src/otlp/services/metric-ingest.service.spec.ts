import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MetricIngestService } from './metric-ingest.service';
import { TokenUsageSnapshot } from '../../entities/token-usage-snapshot.entity';
import { CostSnapshot } from '../../entities/cost-snapshot.entity';
import { IngestionContext } from '../interfaces/ingestion-context.interface';

const testCtx: IngestionContext = { tenantId: 'test-tenant', agentId: 'test-agent', agentName: 'test-agent', userId: 'test-user' };

describe('MetricIngestService', () => {
  let service: MetricIngestService;
  let mockTokenInsert: jest.Mock;
  let mockCostInsert: jest.Mock;

  beforeEach(async () => {
    mockTokenInsert = jest.fn().mockResolvedValue({});
    mockCostInsert = jest.fn().mockResolvedValue({});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MetricIngestService,
        { provide: getRepositoryToken(TokenUsageSnapshot), useValue: { insert: mockTokenInsert } },
        { provide: getRepositoryToken(CostSnapshot), useValue: { insert: mockCostInsert } },
      ],
    }).compile();

    service = module.get<MetricIngestService>(MetricIngestService);
  });

  it('returns accepted count of 0 for empty request', async () => {
    const result = await service.ingest({ resourceMetrics: [] }, testCtx);
    expect(result.accepted).toBe(0);
  });

  it('ingests token metric data points as token snapshots', async () => {
    const request = {
      resourceMetrics: [{
        resource: {
          attributes: [{ key: 'agent.name', value: { stringValue: 'bot-1' } }],
        },
        scopeMetrics: [{
          scope: { name: 'test' },
          metrics: [{
            name: 'gen_ai.usage.input_tokens',
            gauge: {
              dataPoints: [{
                timeUnixNano: '1708000000000000000',
                asInt: 500,
              }],
            },
          }],
        }],
      }],
    };

    const result = await service.ingest(request, testCtx);
    expect(result.accepted).toBe(1);
    expect(mockTokenInsert).toHaveBeenCalledTimes(1);
    expect(mockTokenInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: 'test-tenant',
        agent_id: 'test-agent',
        input_tokens: 500,
      }),
    );
  });

  it('ingests cost metric data points as cost snapshots', async () => {
    const request = {
      resourceMetrics: [{
        resource: {
          attributes: [{ key: 'agent.name', value: { stringValue: 'bot-1' } }],
        },
        scopeMetrics: [{
          scope: { name: 'test' },
          metrics: [{
            name: 'gen_ai.usage.cost',
            gauge: {
              dataPoints: [{
                timeUnixNano: '1708000000000000000',
                asDouble: 0.025,
                attributes: [
                  { key: 'gen_ai.request.model', value: { stringValue: 'claude-opus-4-6' } },
                ],
              }],
            },
          }],
        }],
      }],
    };

    const result = await service.ingest(request, testCtx);
    expect(result.accepted).toBe(1);
    expect(mockCostInsert).toHaveBeenCalledTimes(1);
    expect(mockCostInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: 'test-tenant',
        agent_id: 'test-agent',
        cost_usd: 0.025,
        model: 'claude-opus-4-6',
      }),
    );
  });

  it('ignores metrics that are not token or cost metrics', async () => {
    const request = {
      resourceMetrics: [{
        resource: { attributes: [] },
        scopeMetrics: [{
          scope: { name: 'test' },
          metrics: [{
            name: 'http.server.request.duration',
            gauge: {
              dataPoints: [{
                timeUnixNano: '1708000000000000000',
                asDouble: 150.5,
              }],
            },
          }],
        }],
      }],
    };

    const result = await service.ingest(request, testCtx);
    expect(result.accepted).toBe(0);
    expect(mockTokenInsert).not.toHaveBeenCalled();
    expect(mockCostInsert).not.toHaveBeenCalled();
  });

  it('handles sum-type metrics (not just gauges)', async () => {
    const request = {
      resourceMetrics: [{
        resource: { attributes: [] },
        scopeMetrics: [{
          scope: { name: 'test' },
          metrics: [{
            name: 'gen_ai.usage.output_tokens',
            sum: {
              dataPoints: [{
                timeUnixNano: '1708000000000000000',
                asInt: 300,
              }],
              aggregationTemporality: 1,
              isMonotonic: true,
            },
          }],
        }],
      }],
    };

    const result = await service.ingest(request, testCtx);
    expect(result.accepted).toBe(1);
    expect(mockTokenInsert).toHaveBeenCalledTimes(1);
    expect(mockTokenInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        output_tokens: 300,
      }),
    );
  });

  it('handles multiple data points in a single metric', async () => {
    const request = {
      resourceMetrics: [{
        resource: { attributes: [] },
        scopeMetrics: [{
          scope: { name: 'test' },
          metrics: [{
            name: 'gen_ai.usage.total_tokens',
            gauge: {
              dataPoints: [
                { timeUnixNano: '1708000000000000000', asInt: 100 },
                { timeUnixNano: '1708000001000000000', asInt: 200 },
                { timeUnixNano: '1708000002000000000', asInt: 300 },
              ],
            },
          }],
        }],
      }],
    };

    const result = await service.ingest(request, testCtx);
    expect(result.accepted).toBe(3);
    expect(mockTokenInsert).toHaveBeenCalledTimes(3);
  });

  it('handles missing resourceMetrics', async () => {
    const request = { resourceMetrics: undefined as never };
    const result = await service.ingest(request, testCtx);
    expect(result.accepted).toBe(0);
  });

  it('recognizes all token metric names', async () => {
    const tokenMetrics = [
      'gen_ai.usage.input_tokens',
      'gen_ai.usage.output_tokens',
      'gen_ai.usage.total_tokens',
      'gen_ai.usage.cache_read_tokens',
      'gen_ai.usage.cache_creation_tokens',
    ];

    for (const name of tokenMetrics) {
      mockTokenInsert.mockClear();
      mockCostInsert.mockClear();
      const request = {
        resourceMetrics: [{
          resource: { attributes: [] },
          scopeMetrics: [{
            scope: { name: 'test' },
            metrics: [{
              name,
              gauge: { dataPoints: [{ timeUnixNano: '1708000000000000000', asInt: 1 }] },
            }],
          }],
        }],
      };

      const result = await service.ingest(request, testCtx);
      expect(result.accepted).toBe(1);
      expect(mockTokenInsert).toHaveBeenCalledTimes(1);
      expect(mockCostInsert).not.toHaveBeenCalled();
    }
  });

  it('recognizes all cost metric names', async () => {
    const costMetrics = ['gen_ai.usage.cost', 'gen_ai.cost.usd'];

    for (const name of costMetrics) {
      mockTokenInsert.mockClear();
      mockCostInsert.mockClear();
      const request = {
        resourceMetrics: [{
          resource: { attributes: [] },
          scopeMetrics: [{
            scope: { name: 'test' },
            metrics: [{
              name,
              gauge: { dataPoints: [{ timeUnixNano: '1708000000000000000', asDouble: 0.01 }] },
            }],
          }],
        }],
      };

      const result = await service.ingest(request, testCtx);
      expect(result.accepted).toBe(1);
      expect(mockCostInsert).toHaveBeenCalledTimes(1);
      expect(mockTokenInsert).not.toHaveBeenCalled();
    }
  });
});
