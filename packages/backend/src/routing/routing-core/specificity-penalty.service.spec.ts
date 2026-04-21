import { SpecificityPenaltyService } from './specificity-penalty.service';
import type { Repository } from 'typeorm';
import type { AgentMessage } from '../../entities/agent-message.entity';

describe('SpecificityPenaltyService', () => {
  let service: SpecificityPenaltyService;
  let messageRepo: { createQueryBuilder: jest.Mock };

  function setRawMany(rows: { category: string; count: number }[]) {
    const qb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue(rows),
    };
    messageRepo.createQueryBuilder.mockReturnValueOnce(qb);
    return qb;
  }

  beforeEach(() => {
    messageRepo = { createQueryBuilder: jest.fn() };
    service = new SpecificityPenaltyService(messageRepo as unknown as Repository<AgentMessage>);
  });

  it('returns empty map when no agentId is supplied', async () => {
    const result = await service.getPenaltiesForAgent('');
    expect(result.size).toBe(0);
    expect(messageRepo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('converts flag counts into bounded per-category penalties', async () => {
    setRawMany([
      { category: 'web_browsing', count: 4 },
      { category: 'coding', count: 1 },
    ]);

    const penalties = await service.getPenaltiesForAgent('agent-1');

    // 4 * 0.75 = 3, capped at 3
    expect(penalties.get('web_browsing')).toBe(3);
    expect(penalties.get('coding')).toBeCloseTo(0.75);
  });

  it('drops rows whose category is not a known specificity category', async () => {
    setRawMany([{ category: 'mystery', count: 99 }]);

    const penalties = await service.getPenaltiesForAgent('agent-1');

    expect(penalties.size).toBe(0);
  });

  it('skips categories whose computed penalty is zero', async () => {
    setRawMany([{ category: 'web_browsing', count: 0 }]);

    const penalties = await service.getPenaltiesForAgent('agent-1');

    expect(penalties.size).toBe(0);
  });
});
