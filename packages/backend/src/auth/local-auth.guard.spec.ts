import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { LocalAuthGuard } from './local-auth.guard';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';

function createMockContext(overrides: {
  ip?: string;
  headers?: Record<string, string>;
  isPublic?: boolean;
}): { context: ExecutionContext; request: Record<string, unknown> } {
  const request: Record<string, unknown> = {
    ip: overrides.ip ?? '127.0.0.1',
    headers: overrides.headers ?? {},
  };

  const context = {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;

  return { context, request };
}

describe('LocalAuthGuard', () => {
  let guard: LocalAuthGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new LocalAuthGuard(reflector);
  });

  it('allows public routes without injecting user', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    const { context, request } = createMockContext({ isPublic: true });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(request['user']).toBeUndefined();
  });

  it('auto-authenticates loopback IPv4 (127.0.0.1)', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    const { context, request } = createMockContext({ ip: '127.0.0.1' });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(request['user']).toEqual({
      id: 'local-user-001',
      name: 'Local User',
      email: 'local@manifest.local',
    });
  });

  it('auto-authenticates loopback IPv6 (::1)', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    const { context, request } = createMockContext({ ip: '::1' });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(request['user']).toEqual({
      id: 'local-user-001',
      name: 'Local User',
      email: 'local@manifest.local',
    });
  });

  it('auto-authenticates IPv4-mapped IPv6 (::ffff:127.0.0.1)', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    const { context, request } = createMockContext({
      ip: '::ffff:127.0.0.1',
    });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(request['user']).toEqual({
      id: 'local-user-001',
      name: 'Local User',
      email: 'local@manifest.local',
    });
  });

  it('passes through when X-API-Key header is present', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    const { context, request } = createMockContext({
      ip: '127.0.0.1',
      headers: { 'x-api-key': 'some-key' },
    });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    // Should NOT inject user — let ApiKeyGuard handle
    expect(request['user']).toBeUndefined();
  });

  it('denies non-loopback requests without API key', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    const { context, request } = createMockContext({ ip: '192.168.1.100' });

    const result = await guard.canActivate(context);

    expect(result).toBe(false);
    expect(request['user']).toBeUndefined();
  });

  it('denies requests with undefined IP', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    const { context, request } = createMockContext({});
    // Simulate undefined IP
    (request as Record<string, unknown>)['ip'] = undefined;

    const result = await guard.canActivate(context);

    expect(result).toBe(false);
    expect(request['user']).toBeUndefined();
  });
});
