import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { NotificationRulesService } from './notification-rules.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('NotificationRulesService', () => {
  let service: NotificationRulesService;
  let mockQuery: jest.Mock;

  beforeEach(async () => {
    mockQuery = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationRulesService,
        { provide: DataSource, useValue: { query: mockQuery, options: { type: 'postgres' } } },
      ],
    }).compile();

    service = module.get(NotificationRulesService);
  });

  describe('listRules', () => {
    it('returns rules for user and agent', async () => {
      const rules = [{ id: 'r1' }];
      mockQuery.mockResolvedValue(rules);

      const result = await service.listRules('user-1', 'my-agent');
      expect(result).toEqual(rules);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('FROM notification_rules'),
        ['user-1', 'my-agent'],
      );
    });
  });

  describe('createRule', () => {
    it('creates a rule after resolving agent', async () => {
      mockQuery
        .mockResolvedValueOnce([{ id: 'agent-1', tenant_id: 'tenant-1' }]) // resolveAgent
        .mockResolvedValueOnce(undefined) // INSERT
        .mockResolvedValueOnce([{ id: 'new-rule' }]); // SELECT

      const result = await service.createRule('user-1', {
        agent_name: 'my-agent',
        metric_type: 'tokens',
        threshold: 50000,
        period: 'day',
      });

      expect(result).toEqual({ id: 'new-rule' });
      expect(mockQuery).toHaveBeenCalledTimes(3);
    });

    it('throws BadRequestException when agent not found', async () => {
      mockQuery.mockResolvedValueOnce([]);

      await expect(
        service.createRule('user-1', {
          agent_name: 'unknown',
          metric_type: 'tokens',
          threshold: 100,
          period: 'hour',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateRule', () => {
    it('updates fields and returns updated rule', async () => {
      mockQuery
        .mockResolvedValueOnce([{ id: 'r1' }]) // verifyOwnership
        .mockResolvedValueOnce(undefined) // UPDATE
        .mockResolvedValueOnce([{ id: 'r1', threshold: 200 }]); // SELECT

      const result = await service.updateRule('user-1', 'r1', { threshold: 200 });
      expect(result.threshold).toBe(200);
    });

    it('builds correct numbered params for multi-field update', async () => {
      mockQuery
        .mockResolvedValueOnce([{ id: 'r1' }]) // verifyOwnership
        .mockResolvedValueOnce(undefined) // UPDATE
        .mockResolvedValueOnce([{ id: 'r1', metric_type: 'cost', threshold: 500, period: 'week', is_active: false }]); // SELECT

      const result = await service.updateRule('user-1', 'r1', {
        metric_type: 'cost',
        threshold: 500,
        period: 'week',
        is_active: false,
      });

      // Verify the UPDATE query uses numbered PG params ($1, $2, etc.)
      const updateCall = mockQuery.mock.calls[1];
      const sql = updateCall[0] as string;
      const params = updateCall[1] as unknown[];

      expect(sql).toContain('metric_type = $1');
      expect(sql).toContain('threshold = $2');
      expect(sql).toContain('period = $3');
      expect(sql).toContain('is_active = $4');
      expect(sql).toContain('updated_at = $5');
      expect(sql).toContain('WHERE id = $6');

      // Params should be: metric_type, threshold, period, is_active, updated_at, ruleId
      expect(params[0]).toBe('cost');
      expect(params[1]).toBe(500);
      expect(params[2]).toBe('week');
      expect(params[3]).toBe(false);
      expect(typeof params[4]).toBe('string'); // timestamp
      expect(params[5]).toBe('r1');

      expect(result.metric_type).toBe('cost');
    });

    it('returns existing rule when no fields to update', async () => {
      mockQuery
        .mockResolvedValueOnce([{ id: 'r1' }]) // verifyOwnership
        .mockResolvedValueOnce([{ id: 'r1', threshold: 100 }]); // getRule (no UPDATE)

      const result = await service.updateRule('user-1', 'r1', {});
      expect(result.threshold).toBe(100);
      // Only 2 calls: verifyOwnership + getRule (no UPDATE)
      expect(mockQuery).toHaveBeenCalledTimes(2);
    });

    it('throws NotFoundException when rule not owned', async () => {
      mockQuery.mockResolvedValueOnce([]);

      await expect(
        service.updateRule('user-1', 'r-missing', { threshold: 999 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteRule', () => {
    it('deletes a rule after ownership check', async () => {
      mockQuery
        .mockResolvedValueOnce([{ id: 'r1' }]) // verifyOwnership
        .mockResolvedValueOnce(undefined); // DELETE

      await service.deleteRule('user-1', 'r1');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM notification_rules'),
        ['r1'],
      );
    });
  });

  describe('getConsumption', () => {
    it('returns token consumption for a period', async () => {
      mockQuery.mockResolvedValueOnce([{ total: 12345 }]);

      const result = await service.getConsumption(
        'tenant-1', 'my-agent', 'tokens', '2026-02-17 00:00:00', '2026-02-17 14:00:00',
      );
      expect(result).toBe(12345);
    });

    it('returns cost consumption for a period', async () => {
      mockQuery.mockResolvedValueOnce([{ total: 3.45 }]);

      const result = await service.getConsumption(
        'tenant-1', 'my-agent', 'cost', '2026-02-01 00:00:00', '2026-02-17 14:00:00',
      );
      expect(result).toBe(3.45);
    });

    it('uses SUM(input_tokens + output_tokens) for token metric type', async () => {
      mockQuery.mockResolvedValueOnce([{ total: 999 }]);

      await service.getConsumption(
        'tenant-1', 'my-agent', 'tokens', '2026-02-17 00:00:00', '2026-02-17 14:00:00',
      );

      const sql = mockQuery.mock.calls[0][0] as string;
      expect(sql).toContain('SUM(input_tokens + output_tokens)');
      expect(sql).not.toContain('SUM(cost_usd)');
    });

    it('uses SUM(cost_usd) for cost metric type', async () => {
      mockQuery.mockResolvedValueOnce([{ total: 1.23 }]);

      await service.getConsumption(
        'tenant-1', 'my-agent', 'cost', '2026-02-01 00:00:00', '2026-02-17 14:00:00',
      );

      const sql = mockQuery.mock.calls[0][0] as string;
      expect(sql).toContain('SUM(cost_usd)');
      expect(sql).not.toContain('SUM(input_tokens');
    });

    it('passes PG numbered params ($1-$4) for consumption query', async () => {
      mockQuery.mockResolvedValueOnce([{ total: 0 }]);

      await service.getConsumption(
        'tenant-1', 'my-agent', 'tokens', '2026-02-17 00:00:00', '2026-02-17 14:00:00',
      );

      const sql = mockQuery.mock.calls[0][0] as string;
      const params = mockQuery.mock.calls[0][1] as unknown[];
      expect(sql).toContain('$1');
      expect(sql).toContain('$4');
      expect(params).toEqual([
        'tenant-1', 'my-agent', '2026-02-17 00:00:00', '2026-02-17 14:00:00',
      ]);
    });

    it('returns 0 when query returns null total', async () => {
      mockQuery.mockResolvedValueOnce([{ total: null }]);

      const result = await service.getConsumption(
        'tenant-1', 'my-agent', 'tokens', '2026-02-17 00:00:00', '2026-02-17 14:00:00',
      );
      expect(result).toBe(0);
    });

    it('returns 0 when query returns empty rows', async () => {
      mockQuery.mockResolvedValueOnce([]);

      const result = await service.getConsumption(
        'tenant-1', 'my-agent', 'tokens', '2026-02-17 00:00:00', '2026-02-17 14:00:00',
      );
      expect(result).toBe(0);
    });
  });

  describe('getAllActiveRules', () => {
    it('returns all active rules', async () => {
      const rules = [{ id: 'r1', is_active: true }];
      mockQuery.mockResolvedValueOnce(rules);

      const result = await service.getAllActiveRules();
      expect(result).toEqual(rules);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('is_active = true'),
      );
    });
  });

  describe('listRules with PG params', () => {
    it('uses $1 and $2 numbered params for user and agent', async () => {
      mockQuery.mockResolvedValueOnce([]);

      await service.listRules('user-1', 'agent-x');

      const sql = mockQuery.mock.calls[0][0] as string;
      expect(sql).toContain('$1');
      expect(sql).toContain('$2');
    });
  });

  describe('createRule with PG params', () => {
    it('uses $1 through $10 numbered params in INSERT', async () => {
      mockQuery
        .mockResolvedValueOnce([{ id: 'agent-1', tenant_id: 'tenant-1' }]) // resolveAgent
        .mockResolvedValueOnce(undefined) // INSERT
        .mockResolvedValueOnce([{ id: 'new-rule' }]); // SELECT

      await service.createRule('user-1', {
        agent_name: 'my-agent',
        metric_type: 'tokens',
        threshold: 50000,
        period: 'day',
      });

      const insertCall = mockQuery.mock.calls[1];
      const sql = insertCall[0] as string;
      const params = insertCall[1] as unknown[];

      expect(sql).toContain('$1');
      expect(sql).toContain('$10');
      expect(params).toHaveLength(10);
    });
  });
});
