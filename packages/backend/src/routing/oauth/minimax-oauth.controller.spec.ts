import { HttpException, NotFoundException } from '@nestjs/common';
import { MinimaxOauthController } from './minimax-oauth.controller';
import type { TenantContext } from '../../common/decorators/tenant-context.decorator';

describe('MinimaxOauthController', () => {
  const controller = new MinimaxOauthController({} as never, {} as never, {} as never);

  it('poll rejects with BadRequest when flowId is missing', async () => {
    await expect(
      controller.poll('', { tenantId: 't1', userId: 'u1' } as TenantContext),
    ).rejects.toBeInstanceOf(HttpException);
  });

  it('poll rejects with NotFound when the tenant context is missing', async () => {
    await expect(
      controller.poll('flow-1', { tenantId: '', userId: 'u1' } as TenantContext),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
