import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Brackets } from 'typeorm';
import { AggregationService } from './aggregation.service';
import { AgentMessage } from '../../entities/agent-message.entity';
import { TenantCacheService } from '../../common/services/tenant-cache.service';

describe('AggregationService', () => {
  let service: AggregationService;
  let mockGetRawOne: jest.Mock;

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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AggregationService,
        {
          provide: getRepositoryToken(AgentMessage),
          useValue: { createQueryBuilder: jest.fn().mockReturnValue(mockQb) },
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

    it('passes agentName to tenant filter when provided', async () => {
      mockGetRawOne.mockResolvedValueOnce({ '?column?': 1 });
      const result = await service.hasAnyData('test-user', 'my-agent');
      expect(result).toBe(true);
    });
  });

  describe('getPreviousTokenTotal', () => {
    it('returns previous period token total', async () => {
      mockGetRawOne.mockResolvedValueOnce({ total: 4000 });
      const result = await service.getPreviousTokenTotal('24h', 'test-user');
      expect(result).toBe(4000);
    });

    it('returns 0 when no previous data', async () => {
      mockGetRawOne.mockResolvedValueOnce(null);
      const result = await service.getPreviousTokenTotal('24h', 'test-user');
      expect(result).toBe(0);
    });

    it('passes agentName to tenant filter', async () => {
      mockGetRawOne.mockResolvedValueOnce({ total: 500 });
      const result = await service.getPreviousTokenTotal('7d', 'test-user', 'my-agent');
      expect(result).toBe(500);
    });
  });

  describe('getPreviousCostTotal', () => {
    it('returns previous period cost total', async () => {
      mockGetRawOne.mockResolvedValueOnce({ total: 2.5 });
      const result = await service.getPreviousCostTotal('7d', 'test-user');
      expect(result).toBe(2.5);
    });

    it('returns 0 when no previous data', async () => {
      mockGetRawOne.mockResolvedValueOnce(null);
      const result = await service.getPreviousCostTotal('7d', 'test-user');
      expect(result).toBe(0);
    });

    it('passes agentName to tenant filter', async () => {
      mockGetRawOne.mockResolvedValueOnce({ total: 1.0 });
      const result = await service.getPreviousCostTotal('30d', 'test-user', 'my-agent');
      expect(result).toBe(1.0);
    });
  });

  describe('getSummaryMetrics', () => {
    it('returns merged token, cost, and message metrics with trends', async () => {
      mockGetRawOne
        .mockResolvedValueOnce({ msg_count: 50, inp: 3000, out: 2000, cost: 5.5 })
        .mockResolvedValueOnce({ msg_count: 40, tokens: 4000, cost: 4.0 });

      const result = await service.getSummaryMetrics('24h', 'u1', 'tenant-123');
      expect(result.tokens.tokens_today.value).toBe(5000);
      expect(result.tokens.tokens_today.trend_pct).toBe(25);
      expect(result.tokens.tokens_today.sub_values).toEqual({ input: 3000, output: 2000 });
      expect(result.tokens.input_tokens).toBe(3000);
      expect(result.tokens.output_tokens).toBe(2000);
      expect(result.cost.value).toBe(5.5);
      expect(result.cost.trend_pct).toBeGreaterThan(0);
      expect(result.messages.value).toBe(50);
      expect(result.messages.trend_pct).toBe(25);
    });

    it('handles null query results gracefully', async () => {
      mockGetRawOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

      const result = await service.getSummaryMetrics('24h', 'u1', 'tenant-123');
      expect(result.tokens.tokens_today.value).toBe(0);
      expect(result.tokens.input_tokens).toBe(0);
      expect(result.tokens.output_tokens).toBe(0);
      expect(result.cost.value).toBe(0);
      expect(result.messages.value).toBe(0);
    });

    it('passes agentName to tenant filter', async () => {
      mockGetRawOne
        .mockResolvedValueOnce({ msg_count: 10, inp: 100, out: 50, cost: 1.0 })
        .mockResolvedValueOnce({ msg_count: 8, tokens: 120, cost: 0.8 });

      const result = await service.getSummaryMetrics('7d', 'u1', 'tenant-123', 'bot-1');
      expect(result.messages.value).toBe(10);
    });

    it('returns zero trends when no previous data', async () => {
      mockGetRawOne
        .mockResolvedValueOnce({ msg_count: 10, inp: 100, out: 50, cost: 1.0 })
        .mockResolvedValueOnce({ msg_count: 0, tokens: 0, cost: 0 });

      const result = await service.getSummaryMetrics('24h', 'u1');
      expect(result.tokens.tokens_today.trend_pct).toBe(0);
      expect(result.cost.trend_pct).toBe(0);
      expect(result.messages.trend_pct).toBe(0);
    });
  });
});
