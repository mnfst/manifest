jest.mock('better-auth/node', () => ({
  fromNodeHeaders: jest.fn((headers: Record<string, string>) => headers),
}));

jest.mock('./auth.instance', () => ({
  auth: {
    api: {
      getSession: jest.fn(),
    },
  },
}));

import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SessionGuard } from './session.guard';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { auth } = require('./auth.instance');

function createMockContext(overrides: { ip?: string; headers?: Record<string, string> }): {
  context: ExecutionContext;
  request: Record<string, unknown>;
} {
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

describe('SessionGuard', () => {
  let guard: SessionGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new SessionGuard(reflector);
    jest.clearAllMocks();
  });

  it('allows public routes', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    const { context } = createMockContext({});

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(auth.api.getSession).not.toHaveBeenCalled();
  });

  it('passes through when X-API-Key header is present', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    const { context } = createMockContext({
      headers: { 'x-api-key': 'some-key' },
    });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(auth.api.getSession).not.toHaveBeenCalled();
  });

  it('attaches user when session is valid', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    const mockSession = {
      user: { id: 'user-1', name: 'Test', email: 'test@test.com' },
      session: { id: 'session-1' },
    };
    (auth.api.getSession as jest.Mock).mockResolvedValue(mockSession);
    const { context, request } = createMockContext({});

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(request['user']).toEqual(mockSession.user);
    expect(request['session']).toEqual(mockSession.session);
    expect(request['authMethod']).toBe('session');
  });

  it('returns true even when no session found (non-local mode)', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    (auth.api.getSession as jest.Mock).mockResolvedValue(null);
    const { context, request } = createMockContext({ ip: '203.0.113.1' });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(request['user']).toBeUndefined();
    expect(request['authMethod']).toBeUndefined();
  });

  it('returns true and leaves user undefined when getSession throws (non-local mode)', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    (auth.api.getSession as jest.Mock).mockRejectedValue(new Error('DB connection lost'));
    const { context, request } = createMockContext({ ip: '203.0.113.1' });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(request['user']).toBeUndefined();
    expect(request['authMethod']).toBeUndefined();
  });

  describe('cloud mode (default) — no loopback fallback', () => {
    const originalEnv = process.env['MANIFEST_MODE'];

    beforeEach(() => {
      delete process.env['MANIFEST_MODE'];
    });

    afterEach(() => {
      if (originalEnv === undefined) delete process.env['MANIFEST_MODE'];
      else process.env['MANIFEST_MODE'] = originalEnv;
    });

    it('does NOT inject synthetic user for loopback IP without session', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      (auth.api.getSession as jest.Mock).mockResolvedValue(null);
      const { context, request } = createMockContext({ ip: '127.0.0.1' });

      await guard.canActivate(context);

      expect(request['user']).toBeUndefined();
      expect(request['authMethod']).toBeUndefined();
    });

    it('does NOT inject synthetic user for loopback IP when getSession throws', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      (auth.api.getSession as jest.Mock).mockRejectedValue(new Error('DB error'));
      const { context, request } = createMockContext({ ip: '127.0.0.1' });

      await guard.canActivate(context);

      expect(request['user']).toBeUndefined();
      expect(request['authMethod']).toBeUndefined();
    });

    it('attaches real user when Better Auth session is valid (loopback IP)', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      const mockSession = {
        user: { id: 'cloud-user-1', name: 'Cloud User', email: 'cloud@example.com' },
        session: { id: 'session-cloud' },
      };
      (auth.api.getSession as jest.Mock).mockResolvedValue(mockSession);
      const { context, request } = createMockContext({ ip: '127.0.0.1' });

      await guard.canActivate(context);

      expect(request['user']).toEqual(mockSession.user);
      expect(request['authMethod']).toBe('session');
    });

    it('does NOT inject synthetic user when MANIFEST_MODE is "cloud"', async () => {
      process.env['MANIFEST_MODE'] = 'cloud';
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      (auth.api.getSession as jest.Mock).mockResolvedValue(null);
      const { context, request } = createMockContext({ ip: '127.0.0.1' });

      await guard.canActivate(context);

      expect(request['user']).toBeUndefined();
      expect(request['authMethod']).toBeUndefined();
    });
  });

  describe('local mode loopback fallback', () => {
    const originalEnv = process.env['MANIFEST_MODE'];

    beforeEach(() => {
      process.env['MANIFEST_MODE'] = 'local';
    });

    afterEach(() => {
      if (originalEnv === undefined) delete process.env['MANIFEST_MODE'];
      else process.env['MANIFEST_MODE'] = originalEnv;
    });

    it('uses real session when Better Auth session exists (preserves per-user isolation)', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      const mockSession = {
        user: { id: 'real-user-1', name: 'Real User', email: 'real@test.com' },
        session: { id: 'session-1' },
      };
      (auth.api.getSession as jest.Mock).mockResolvedValue(mockSession);
      const { context, request } = createMockContext({ ip: '127.0.0.1' });

      await guard.canActivate(context);

      expect(request['user']).toEqual(mockSession.user);
      expect(request['authMethod']).toBe('session');
    });

    it('falls back to synthetic local user when no session on loopback', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      (auth.api.getSession as jest.Mock).mockResolvedValue(null);
      const { context, request } = createMockContext({ ip: '127.0.0.1' });

      await guard.canActivate(context);

      expect(request['user']).toEqual({
        id: 'local',
        name: 'Local User',
        email: 'local@localhost',
      });
      expect(request['authMethod']).toBe('session');
    });

    it('falls back to synthetic local user when getSession throws on loopback', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      (auth.api.getSession as jest.Mock).mockRejectedValue(new Error('DB error'));
      const { context, request } = createMockContext({ ip: '127.0.0.1' });

      await guard.canActivate(context);

      expect(request['user']).toEqual({
        id: 'local',
        name: 'Local User',
        email: 'local@localhost',
      });
      expect(request['authMethod']).toBe('session');
    });

    it('does not apply loopback fallback for non-loopback IPs', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      (auth.api.getSession as jest.Mock).mockResolvedValue(null);
      const { context, request } = createMockContext({ ip: '203.0.113.1' });

      await guard.canActivate(context);

      expect(request['user']).toBeUndefined();
      expect(request['authMethod']).toBeUndefined();
    });
  });
});
