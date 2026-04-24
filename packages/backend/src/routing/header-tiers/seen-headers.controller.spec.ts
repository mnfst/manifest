import { SeenHeadersController } from './seen-headers.controller';
import type { SeenHeadersService } from './seen-headers.service';
import type { AuthUser } from '../../auth/auth.instance';

function makeController() {
  const service = {
    getSeenHeaders: jest.fn().mockResolvedValue([]),
  } as unknown as jest.Mocked<SeenHeadersService>;
  const controller = new SeenHeadersController(service);
  return { controller, service };
}

const user = { id: 'user-1' } as AuthUser;

describe('SeenHeadersController', () => {
  it('by default filters to the requested agent', async () => {
    const { controller, service } = makeController();
    await controller.list(user, 'my-agent');
    expect(service.getSeenHeaders).toHaveBeenCalledWith('user-1', 'my-agent');
  });

  it('when scope=all, drops the agent filter', async () => {
    const { controller, service } = makeController();
    await controller.list(user, 'my-agent', 'all');
    expect(service.getSeenHeaders).toHaveBeenCalledWith('user-1', undefined);
  });
});
