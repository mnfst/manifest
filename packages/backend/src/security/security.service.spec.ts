import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SecurityService } from './security.service';
import { SecurityEvent } from '../entities/security-event.entity';

describe('SecurityService', () => {
  let service: SecurityService;
  let mockGetRawMany: jest.Mock;
  let mockGetMany: jest.Mock;

  beforeEach(async () => {
    mockGetRawMany = jest.fn().mockResolvedValue([]);
    mockGetMany = jest.fn().mockResolvedValue([]);

    const mockQb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getRawMany: mockGetRawMany,
      getMany: mockGetMany,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SecurityService,
        {
          provide: getRepositoryToken(SecurityEvent),
          useValue: { createQueryBuilder: jest.fn().mockReturnValue(mockQb) },
        },
      ],
    }).compile();

    service = module.get<SecurityService>(SecurityService);
  });

  it('computes risk score correctly with critical and warning events', async () => {
    mockGetRawMany.mockResolvedValueOnce([
      { severity: 'critical', cnt: 2 },
      { severity: 'warning', cnt: 3 },
    ]);
    mockGetMany.mockResolvedValueOnce([]);

    const result = await service.getSecurityOverview('24h', 'test-user');
    // 100 - 2*15 - 3*5 = 55
    expect(result.score.value).toBe(55);
    expect(result.score.risk_level).toBe('high');
    expect(result.critical_events_count).toBe(2);
    expect(result.sandbox_mode).toBe('enabled');
  });

  it('returns low risk for no events', async () => {
    mockGetRawMany.mockResolvedValueOnce([]);
    mockGetMany.mockResolvedValueOnce([]);

    const result = await service.getSecurityOverview('24h', 'test-user');
    expect(result.score.value).toBe(100);
    expect(result.score.risk_level).toBe('low');
    expect(result.critical_events_count).toBe(0);
  });

  it('returns events from query', async () => {
    const fakeEvents = [
      { id: '1', timestamp: '2026-01-01', severity: 'critical', category: 'test', description: 'desc' },
    ];
    mockGetRawMany.mockResolvedValueOnce([{ severity: 'critical', cnt: 1 }]);
    mockGetMany.mockResolvedValueOnce(fakeEvents);

    const result = await service.getSecurityOverview('24h', 'test-user');
    expect(result.events).toEqual(fakeEvents);
  });
});
