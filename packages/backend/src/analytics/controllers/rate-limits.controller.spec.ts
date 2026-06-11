import { RateLimitsController } from './rate-limits.controller';
import type { RateLimitTrackerService } from '../../routing/proxy/rate-limit-tracker.service';
import type { AuthUser } from '../../auth/auth.instance';

describe('RateLimitsController', () => {
  let tracker: { getRateLimits: jest.Mock };
  let controller: RateLimitsController;
  const user = { id: 'u1' } as AuthUser;

  beforeEach(() => {
    tracker = { getRateLimits: jest.fn() };
    controller = new RateLimitsController(tracker as unknown as RateLimitTrackerService);
  });

  it('maps snapshots and computes utilization_pct', async () => {
    tracker.getRateLimits.mockResolvedValue([
      {
        provider: 'openai',
        authType: 'api_key',
        keyLabel: 'k1',
        limits: [
          {
            limitType: 'requests',
            period: 'minute',
            limitValue: 100,
            usedValue: 33,
            remainingValue: 67,
            resetsAt: '2026-01-01T00:00:00Z',
          },
        ],
      },
    ]);

    const out = await controller.getRateLimits(user);
    expect(tracker.getRateLimits).toHaveBeenCalledWith('u1');
    expect(out.providers[0].provider).toBe('openai');
    expect(out.providers[0].key_label).toBe('k1');
    expect(out.providers[0].limits[0].utilization_pct).toBe(33);
  });

  it('returns null utilization_pct when limit is zero/unknown and null key_label', async () => {
    tracker.getRateLimits.mockResolvedValue([
      {
        provider: 'anthropic',
        authType: 'subscription',
        keyLabel: undefined,
        limits: [
          {
            limitType: 'tokens',
            period: 'minute',
            limitValue: 0,
            usedValue: 10,
            remainingValue: null,
            resetsAt: null,
          },
          {
            limitType: 'requests',
            period: 'minute',
            limitValue: null,
            usedValue: null,
            remainingValue: null,
            resetsAt: null,
          },
        ],
      },
    ]);

    const out = await controller.getRateLimits(user);
    expect(out.providers[0].key_label).toBeNull();
    expect(out.providers[0].limits[0].utilization_pct).toBeNull();
    expect(out.providers[0].limits[1].utilization_pct).toBeNull();
  });
});
