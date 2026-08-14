import { SeenHeadersController } from './seen-headers.controller';
import type { SeenHeadersService } from './seen-headers.service';
import type { TenantContext } from '../../common/decorators/tenant-context.decorator';

function makeController() {
  const service = {
    getSeenHeaders: jest.fn().mockResolvedValue([]),
  } as unknown as jest.Mocked<SeenHeadersService>;
  const controller = new SeenHeadersController(service);
  return { controller, service };
}

const ctx: TenantContext = { tenantId: 'tenant-1', userId: 'user-1' };

describe('SeenHeadersController', () => {
  it('by default filters to the requested agent', async () => {
    const { controller, service } = makeController();
    await controller.list(ctx, 'my-agent');
    expect(service.getSeenHeaders).toHaveBeenCalledWith('tenant-1', 'my-agent');
  });

  it('when scope=all, drops the agent filter', async () => {
    const { controller, service } = makeController();
    await controller.list(ctx, 'my-agent', 'all');
    expect(service.getSeenHeaders).toHaveBeenCalledWith('tenant-1', undefined);
  });

  it('returns an empty list when no tenant is resolved', async () => {
    const { controller, service } = makeController();
    const out = await controller.list({ tenantId: null, userId: 'user-1' }, 'my-agent');
    expect(out).toEqual([]);
    expect(service.getSeenHeaders).not.toHaveBeenCalled();
  });
});
