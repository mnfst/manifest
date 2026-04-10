jest.mock('../common/constants/local-mode.constants', () => ({
  LOCAL_USER_ID: 'local-user-001',
  LOCAL_EMAIL: 'local@manifest.local',
  readLocalNotificationEmail: jest.fn().mockReturnValue(null),
}));

import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { LocalAuthGuard } from './local-auth.guard';
import { readLocalNotificationEmail } from '../common/constants/local-mode.constants';

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
    expect(request['authMethod']).toBe('session');
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

  it('auto-authenticates private network IP when MANIFEST_TRUST_LAN=true', async () => {
    const origTrustLan = process.env['MANIFEST_TRUST_LAN'];
    process.env['MANIFEST_TRUST_LAN'] = 'true';
    try {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      const { context, request } = createMockContext({ ip: '192.168.1.100' });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(request['user']).toEqual({
        id: 'local-user-001',
        name: 'Local User',
        email: 'local@manifest.local',
      });
    } finally {
      if (origTrustLan === undefined) delete process.env['MANIFEST_TRUST_LAN'];
      else process.env['MANIFEST_TRUST_LAN'] = origTrustLan;
    }
  });

  it('denies private network IP by default (MANIFEST_TRUST_LAN not set)', async () => {
    const origTrustLan = process.env['MANIFEST_TRUST_LAN'];
    delete process.env['MANIFEST_TRUST_LAN'];
    try {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      const { context, request } = createMockContext({ ip: '192.168.1.100' });

      const result = await guard.canActivate(context);

      expect(result).toBe(false);
      expect(request['user']).toBeUndefined();
    } finally {
      if (origTrustLan === undefined) delete process.env['MANIFEST_TRUST_LAN'];
      else process.env['MANIFEST_TRUST_LAN'] = origTrustLan;
    }
  });

  it('denies public IP requests without API key', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    const { context, request } = createMockContext({ ip: '8.8.8.8' });

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

  it('uses notification email from config when set', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    (readLocalNotificationEmail as jest.Mock).mockReturnValue('real@user.com');
    const { context, request } = createMockContext({ ip: '127.0.0.1' });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(request['user']).toEqual({
      id: 'local-user-001',
      name: 'Local User',
      email: 'real@user.com',
    });
    (readLocalNotificationEmail as jest.Mock).mockReturnValue(null);
  });

  it('falls back to LOCAL_EMAIL when notification email not set', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    (readLocalNotificationEmail as jest.Mock).mockReturnValue(null);
    const { context, request } = createMockContext({ ip: '127.0.0.1' });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(request['user']).toEqual({
      id: 'local-user-001',
      name: 'Local User',
      email: 'local@manifest.local',
    });
  });
});
