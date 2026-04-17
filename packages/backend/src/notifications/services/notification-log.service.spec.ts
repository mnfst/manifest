import { NotificationLogService, formatNotificationTimestamp } from './notification-log.service';
import { DataSource } from 'typeorm';

describe('NotificationLogService', () => {
  let service: NotificationLogService;
  let mockQuery: jest.Mock;

  beforeEach(() => {
    mockQuery = jest.fn().mockResolvedValue([]);
    const ds = {
      query: mockQuery,
      options: { type: 'postgres' },
    } as unknown as DataSource;

    service = new NotificationLogService(ds);
  });

  describe('hasAlreadySent', () => {
    it('returns false when no rows found', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await service.hasAlreadySent('rule-1', '2026-01-01')).toBe(false);
    });

    it('returns true when row exists', async () => {
      mockQuery.mockResolvedValue([{ 1: 1 }]);
      expect(await service.hasAlreadySent('rule-1', '2026-01-01')).toBe(true);
    });
  });

  describe('insertLog', () => {
    it('inserts a notification log record', async () => {
      await service.insertLog({
        ruleId: 'r1',
        periodStart: '2026-01-01',
        periodEnd: '2026-01-02',
        actualValue: 60000,
        thresholdValue: 50000,
        metricType: 'tokens',
        agentName: 'my-agent',
        sentAt: '2026-01-01 12:00:00',
      });

      expect(mockQuery).toHaveBeenCalledTimes(1);
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('INSERT INTO notification_logs');
      expect(params[1]).toBe('r1');
      expect(params[4]).toBe(60000);
      expect(params[5]).toBe(50000);
      expect(params[7]).toBe('my-agent');
    });
  });

  describe('getLogsForAgent', () => {
    it('queries logs joined with rules filtered by userId and agentName', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          sent_at: '2026-01-01 12:00:00',
          actual_value: 60000,
          threshold_value: 50000,
          metric_type: 'tokens',
          period_start: '2026-01-01',
          period_end: '2026-01-02',
          agent_name: 'my-agent',
        },
      ];
      mockQuery.mockResolvedValue(mockLogs);

      const result = await service.getLogsForAgent('user-1', 'my-agent');

      expect(result).toEqual(mockLogs);
      expect(mockQuery).toHaveBeenCalledTimes(1);
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('notification_logs');
      expect(sql).toContain('JOIN notification_rules');
      expect(sql).toContain('ORDER BY');
      expect(sql).toContain('LIMIT 50');
      expect(params).toEqual(['user-1', 'my-agent']);
    });

    it('returns empty array when no logs exist', async () => {
      mockQuery.mockResolvedValue([]);
      const result = await service.getLogsForAgent('user-1', 'my-agent');
      expect(result).toEqual([]);
    });
  });

  describe('resolveUserEmail', () => {
    it('returns notificationEmail when provided', async () => {
      expect(await service.resolveUserEmail('u1', 'custom@test.com')).toBe('custom@test.com');
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('queries user table when no notificationEmail', async () => {
      mockQuery.mockResolvedValue([{ email: 'user@test.com' }]);
      expect(await service.resolveUserEmail('u1')).toBe('user@test.com');
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    it('returns null when user not found', async () => {
      mockQuery.mockResolvedValue([]);
      expect(await service.resolveUserEmail('u1')).toBeNull();
    });
  });
});

describe('formatNotificationTimestamp', () => {
  it('returns a timestamp without T or Z', () => {
    const ts = formatNotificationTimestamp();
    expect(ts).not.toContain('T');
    expect(ts).not.toContain('Z');
    expect(ts).toHaveLength(19);
  });
});
