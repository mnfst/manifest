import { HttpException, NotFoundException } from '@nestjs/common';
import { KiroOauthController } from './kiro-oauth.controller';
import type { TenantContext } from '../../common/decorators/tenant-context.decorator';

describe('KiroOauthController', () => {
  const controller = new KiroOauthController({} as never, {} as never, {} as never);

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
