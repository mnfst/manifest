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

function createMockContext(overrides: {
  ip?: string;
  headers?: Record<string, string>;
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
  });

  it('returns true even when no session found', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    (auth.api.getSession as jest.Mock).mockResolvedValue(null);
    const { context, request } = createMockContext({});

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(request['user']).toBeUndefined();
  });
});
