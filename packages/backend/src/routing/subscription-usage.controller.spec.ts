import type { SubscriptionUsageSummary } from './subscription-usage.service';
import { SubscriptionUsageController } from './subscription-usage.controller';

describe('SubscriptionUsageController', () => {
  it('wraps tenant-scoped usage summaries for the API response', async () => {
    const providers: SubscriptionUsageSummary[] = [
      {
        provider: 'openai',
        auth_type: 'subscription',
        status: 'ok',
        updated_at: '2026-07-01T12:00:00.000Z',
        connections: [],
      },
    ];
    const getUsage = jest.fn().mockResolvedValue(providers);
    const controller = new SubscriptionUsageController({ getUsage } as never);

    await expect(controller.getUsage({ tenantId: 'tenant-1', userId: 'user-1' })).resolves.toEqual({
      providers,
    });
    expect(getUsage).toHaveBeenCalledWith('tenant-1');
  });
});
