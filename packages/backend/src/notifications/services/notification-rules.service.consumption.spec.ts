import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotificationRulesService } from './notification-rules.service';
import { NotificationRule } from '../../entities/notification-rule.entity';
import { NotificationLog } from '../../entities/notification-log.entity';
import { AgentMessage } from '../../entities/agent-message.entity';
import { Agent } from '../../entities/agent.entity';
import { Tenant } from '../../entities/tenant.entity';

describe('NotificationRulesService.getConsumption', () => {
  let service: NotificationRulesService;
  let messageRepo: { createQueryBuilder: jest.Mock };

  const makeQb = <T>(rawOne: T | null = null) => {
    const qb: Record<string, jest.Mock> = {};
    qb.select = jest.fn().mockReturnValue(qb);
    qb.addSelect = jest.fn().mockReturnValue(qb);
    qb.where = jest.fn().mockReturnValue(qb);
    qb.andWhere = jest.fn().mockReturnValue(qb);
    qb.groupBy = jest.fn().mockReturnValue(qb);
    qb.innerJoin = jest.fn().mockReturnValue(qb);
    qb.getRawOne = jest.fn().mockResolvedValue(rawOne);
    qb.getRawMany = jest.fn().mockResolvedValue([]);
    qb.getOne = jest.fn().mockResolvedValue(rawOne);
    return qb;
  };

  beforeEach(async () => {
    messageRepo = { createQueryBuilder: jest.fn().mockReturnValue(makeQb()) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationRulesService,
        {
          provide: getRepositoryToken(NotificationRule),
          useValue: {
            find: jest.fn(),
            findOneBy: jest.fn(),
            insert: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            count: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(NotificationLog),
          useValue: { createQueryBuilder: jest.fn().mockReturnValue(makeQb()) },
        },
        { provide: getRepositoryToken(AgentMessage), useValue: messageRepo },
        {
          provide: getRepositoryToken(Agent),
          useValue: { createQueryBuilder: jest.fn().mockReturnValue(makeQb()) },
        },
        { provide: getRepositoryToken(Tenant), useValue: {} },
      ],
    }).compile();

    service = module.get(NotificationRulesService);
  });

  it('sums input+output tokens for tokens metric', async () => {
    const qb = makeQb({ total: '12345' });
    messageRepo.createQueryBuilder.mockReturnValueOnce(qb);

    const result = await service.getConsumption(
      't1',
      'a1',
      'tokens',
      '2026-02-17 00:00:00',
      '2026-02-17 14:00:00',
    );

    expect(result).toBe(12345);
    expect(qb.select).toHaveBeenCalledWith(
      expect.stringContaining('SUM(at.input_tokens + at.output_tokens)'),
      'total',
    );
  });

  it('sums cost_usd for cost metric', async () => {
    const qb = makeQb({ total: '3.45' });
    messageRepo.createQueryBuilder.mockReturnValueOnce(qb);

    const result = await service.getConsumption(
      't1',
      'a1',
      'cost',
      '2026-02-01 00:00:00',
      '2026-02-17 14:00:00',
    );

    expect(result).toBe(3.45);
    expect(qb.select).toHaveBeenCalledWith(expect.stringContaining('SUM(at.cost_usd)'), 'total');
  });

  it('returns 0 when no rows match', async () => {
    messageRepo.createQueryBuilder.mockReturnValueOnce(makeQb(null));

    const result = await service.getConsumption('t1', 'a1', 'tokens', '', '');
    expect(result).toBe(0);
  });

  it('returns exact cost value for cost metric (boundary equality)', async () => {
    const qb = makeQb({ total: '50.00' });
    messageRepo.createQueryBuilder.mockReturnValueOnce(qb);

    const result = await service.getConsumption(
      't1',
      'a1',
      'cost',
      '2026-02-01 00:00:00',
      '2026-02-17 14:00:00',
    );

    expect(result).toBe(50);
    expect(qb.select).toHaveBeenCalledWith(expect.stringContaining('SUM(at.cost_usd)'), 'total');
  });

  it('returns exact cost value when SUM returns a numeric (not string) at threshold boundary', async () => {
    const qb = makeQb({ total: 10 });
    messageRepo.createQueryBuilder.mockReturnValueOnce(qb);

    const result = await service.getConsumption(
      't1',
      'a1',
      'cost',
      '2026-02-01 00:00:00',
      '2026-02-17 14:00:00',
    );

    expect(result).toBe(10);
    expect(Number.isFinite(result)).toBe(true);
  });

  it('does not round sub-cent floating-point values away from the threshold', async () => {
    // 10.000001 is just above a $10 threshold; ensure we return exactly that, not 10.
    const qb = makeQb({ total: '10.000001' });
    messageRepo.createQueryBuilder.mockReturnValueOnce(qb);

    const result = await service.getConsumption(
      't1',
      'a1',
      'cost',
      '2026-02-01 00:00:00',
      '2026-02-17 14:00:00',
    );

    expect(result).toBe(10.000001);
    expect(result > 10).toBe(true);
  });

  it('returns a value just under threshold without snapping to it', async () => {
    // 9.999999 is just below $10; must NOT round up to 10 (would falsely trigger an alert).
    const qb = makeQb({ total: '9.999999' });
    messageRepo.createQueryBuilder.mockReturnValueOnce(qb);

    const result = await service.getConsumption(
      't1',
      'a1',
      'cost',
      '2026-02-01 00:00:00',
      '2026-02-17 14:00:00',
    );

    expect(result).toBe(9.999999);
    expect(result < 10).toBe(true);
  });

  it('enforces tenant isolation in the WHERE clause', async () => {
    const qb = makeQb({ total: '0' });
    messageRepo.createQueryBuilder.mockReturnValueOnce(qb);

    await service.getConsumption(
      'tenant-A',
      'agent-1',
      'cost',
      '2026-02-01 00:00:00',
      '2026-02-17 14:00:00',
    );

    expect(qb.where).toHaveBeenCalledWith('at.tenant_id = :tenantId', { tenantId: 'tenant-A' });
    // The agent subquery must also be filtered by the same tenant_id (preventing cross-tenant access).
    const andWhereCalls = qb.andWhere.mock.calls.map((c) => String(c[0]));
    expect(andWhereCalls.some((sql) => sql.includes('tenant_id = at.tenant_id'))).toBe(true);
    expect(andWhereCalls.some((sql) => sql.includes('deleted_at IS NULL'))).toBe(true);
  });

  it('passes the period boundaries as inclusive-start, exclusive-end', async () => {
    const qb = makeQb({ total: '0' });
    messageRepo.createQueryBuilder.mockReturnValueOnce(qb);

    await service.getConsumption('t1', 'a1', 'cost', '2026-02-01 00:00:00', '2026-02-17 14:00:00');

    expect(qb.andWhere).toHaveBeenCalledWith('at.timestamp >= :periodStart', {
      periodStart: '2026-02-01 00:00:00',
    });
    expect(qb.andWhere).toHaveBeenCalledWith('at.timestamp < :periodEnd', {
      periodEnd: '2026-02-17 14:00:00',
    });
  });
});
