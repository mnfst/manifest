import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { NotificationCronService } from './notification-cron.service';
import { NotificationRulesService } from './notification-rules.service';
import { NotificationEmailService } from './notification-email.service';

const activeRule = {
  id: 'rule-1',
  tenant_id: 'tenant-1',
  agent_name: 'my-agent',
  user_id: 'user-1',
  metric_type: 'tokens' as const,
  threshold: 100000,
  period: 'day' as const,
};

describe('NotificationCronService', () => {
  let service: NotificationCronService;
  let mockQuery: jest.Mock;
  let mockGetAllActiveRules: jest.Mock;
  let mockGetConsumption: jest.Mock;
  let mockSendThresholdAlert: jest.Mock;

  beforeEach(async () => {
    mockQuery = jest.fn();
    mockGetAllActiveRules = jest.fn();
    mockGetConsumption = jest.fn();
    mockSendThresholdAlert = jest.fn().mockResolvedValue(true);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationCronService,
        { provide: DataSource, useValue: { query: mockQuery } },
        {
          provide: NotificationRulesService,
          useValue: {
            getAllActiveRules: mockGetAllActiveRules,
            getConsumption: mockGetConsumption,
          },
        },
        {
          provide: NotificationEmailService,
          useValue: { sendThresholdAlert: mockSendThresholdAlert },
        },
      ],
    }).compile();

    service = module.get(NotificationCronService);
  });

  it('returns 0 when no active rules', async () => {
    mockGetAllActiveRules.mockResolvedValue([]);
    const result = await service.checkThresholds();
    expect(result).toBe(0);
  });

  it('skips rule when already notified for current period (dedup)', async () => {
    mockGetAllActiveRules.mockResolvedValue([activeRule]);
    mockQuery.mockResolvedValueOnce([{ 1: 1 }]); // dedup check returns existing log

    const result = await service.checkThresholds();
    expect(result).toBe(0);
    expect(mockGetConsumption).not.toHaveBeenCalled();
  });

  it('does not trigger when consumption is below threshold', async () => {
    mockGetAllActiveRules.mockResolvedValue([activeRule]);
    mockQuery.mockResolvedValueOnce([]); // no dedup
    mockGetConsumption.mockResolvedValue(50000); // below threshold

    const result = await service.checkThresholds();
    expect(result).toBe(0);
    expect(mockSendThresholdAlert).not.toHaveBeenCalled();
  });

  it('triggers notification when consumption exceeds threshold', async () => {
    mockGetAllActiveRules.mockResolvedValue([activeRule]);
    mockQuery
      .mockResolvedValueOnce([]) // no dedup
      .mockResolvedValueOnce(undefined) // INSERT notification_log
      .mockResolvedValueOnce([{ email: 'user@test.com' }]); // resolve user email
    mockGetConsumption.mockResolvedValue(150000);

    const result = await service.checkThresholds();
    expect(result).toBe(1);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO notification_logs'),
      expect.any(Array),
    );
    expect(mockSendThresholdAlert).toHaveBeenCalledWith(
      'user@test.com',
      expect.objectContaining({
        agentName: 'my-agent',
        metricType: 'tokens',
        threshold: 100000,
        actualValue: 150000,
      }),
    );
  });

  it('still records log when user email not found', async () => {
    mockGetAllActiveRules.mockResolvedValue([activeRule]);
    mockQuery
      .mockResolvedValueOnce([]) // no dedup
      .mockResolvedValueOnce(undefined) // INSERT notification_log
      .mockResolvedValueOnce([]); // no email
    mockGetConsumption.mockResolvedValue(200000);

    const result = await service.checkThresholds();
    expect(result).toBe(1);
    expect(mockSendThresholdAlert).not.toHaveBeenCalled();
  });

  it('uses PostgreSQL numbered params ($1, $2) in dedup query', async () => {
    mockGetAllActiveRules.mockResolvedValue([activeRule]);
    mockQuery.mockResolvedValueOnce([{ 1: 1 }]); // dedup hit

    await service.checkThresholds();

    const dedupCall = mockQuery.mock.calls[0];
    const sql = dedupCall[0] as string;
    expect(sql).toContain('$1');
    expect(sql).toContain('$2');
    expect(sql).toContain('notification_logs');
  });

  it('uses PostgreSQL numbered params ($1-$9) in INSERT notification_logs', async () => {
    mockGetAllActiveRules.mockResolvedValue([activeRule]);
    mockQuery
      .mockResolvedValueOnce([]) // no dedup
      .mockResolvedValueOnce(undefined) // INSERT
      .mockResolvedValueOnce([{ email: 'a@b.com' }]); // email
    mockGetConsumption.mockResolvedValue(200000);

    await service.checkThresholds();

    const insertCall = mockQuery.mock.calls[1];
    const sql = insertCall[0] as string;
    const params = insertCall[1] as unknown[];

    expect(sql).toContain('INSERT INTO notification_logs');
    expect(sql).toContain('$1');
    expect(sql).toContain('$9');
    expect(params).toHaveLength(9);
  });

  it('uses PostgreSQL $1 in user email lookup', async () => {
    mockGetAllActiveRules.mockResolvedValue([activeRule]);
    mockQuery
      .mockResolvedValueOnce([]) // no dedup
      .mockResolvedValueOnce(undefined) // INSERT
      .mockResolvedValueOnce([{ email: 'user@test.com' }]); // email
    mockGetConsumption.mockResolvedValue(200000);

    await service.checkThresholds();

    const emailCall = mockQuery.mock.calls[2];
    const sql = emailCall[0] as string;
    expect(sql).toContain('SELECT email FROM "user" WHERE id = $1');
    expect(emailCall[1]).toEqual(['user-1']);
  });

  it('handles multiple rules and counts only triggered ones', async () => {
    const rule2 = { ...activeRule, id: 'rule-2', threshold: 500000 };
    mockGetAllActiveRules.mockResolvedValue([activeRule, rule2]);

    // Rule 1: triggers
    mockQuery
      .mockResolvedValueOnce([]) // no dedup rule-1
      .mockResolvedValueOnce(undefined) // INSERT rule-1
      .mockResolvedValueOnce([{ email: 'user@test.com' }]); // email rule-1
    mockGetConsumption.mockResolvedValueOnce(150000); // above 100k

    // Rule 2: does not trigger
    mockQuery.mockResolvedValueOnce([]); // no dedup rule-2
    mockGetConsumption.mockResolvedValueOnce(100000); // below 500k

    const result = await service.checkThresholds();
    expect(result).toBe(1);
  });

  it('continues processing remaining rules when one throws', async () => {
    const rule2 = { ...activeRule, id: 'rule-2' };
    mockGetAllActiveRules.mockResolvedValue([activeRule, rule2]);

    // Rule 1: throws
    mockQuery.mockRejectedValueOnce(new Error('DB down'));

    // Rule 2: triggers
    mockQuery
      .mockResolvedValueOnce([]) // no dedup
      .mockResolvedValueOnce(undefined) // INSERT
      .mockResolvedValueOnce([{ email: 'user@test.com' }]); // email
    mockGetConsumption.mockResolvedValueOnce(200000);

    const result = await service.checkThresholds();
    expect(result).toBe(1);
  });
});
