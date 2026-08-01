import { MeController } from './me.controller';
import { Request } from 'express';

describe('MeController', () => {
  const controller = new MeController();

  it('returns tenant, user, and auth method from the request', () => {
    const request = { authMethod: 'api_key' } as Request & { authMethod: string };
    expect(controller.me({ tenantId: 't1', userId: 'u1' }, request)).toEqual({
      tenantId: 't1',
      userId: 'u1',
      authMethod: 'api_key',
    });
  });

  it('reports a null auth method when no guard stamped one', () => {
    expect(controller.me({ tenantId: 't1', userId: null }, {} as Request)).toEqual({
      tenantId: 't1',
      userId: null,
      authMethod: null,
    });
  });
});
