import { Test, TestingModule } from '@nestjs/testing';
import { CacheModule } from '@nestjs/cache-manager';
import { SecurityController } from './security.controller';
import { SecurityService } from './security.service';
import { CacheInvalidationService } from '../common/services/cache-invalidation.service';

describe('SecurityController', () => {
  let controller: SecurityController;
  let mockGetSecurityOverview: jest.Mock;

  beforeEach(async () => {
    mockGetSecurityOverview = jest.fn().mockResolvedValue({
      score: { value: 100, risk_level: 'low' },
      critical_events_count: 0,
      sandbox_mode: 'enabled',
      events: [],
    });

    const module: TestingModule = await Test.createTestingModule({
      imports: [CacheModule.register()],
      controllers: [SecurityController],
      providers: [
        {
          provide: SecurityService,
          useValue: { getSecurityOverview: mockGetSecurityOverview },
        },
        { provide: CacheInvalidationService, useValue: { trackKey: jest.fn() } },
      ],
    }).compile();

    controller = module.get<SecurityController>(SecurityController);
  });

  it('delegates to SecurityService with default range', async () => {
    const user = { id: 'user-1' };
    await controller.getSecurity({}, user as never);

    expect(mockGetSecurityOverview).toHaveBeenCalledWith('24h', 'user-1');
  });

  it('passes custom range from query', async () => {
    const user = { id: 'user-1' };
    await controller.getSecurity({ range: '7d' }, user as never);

    expect(mockGetSecurityOverview).toHaveBeenCalledWith('7d', 'user-1');
  });

  it('returns the service result', async () => {
    const expected = {
      score: { value: 55, risk_level: 'high' },
      critical_events_count: 3,
      sandbox_mode: 'enabled',
      events: [{ id: '1' }],
    };
    mockGetSecurityOverview.mockResolvedValue(expected);

    const user = { id: 'user-2' };
    const result = await controller.getSecurity({ range: '24h' }, user as never);

    expect(result).toEqual(expected);
  });
});
