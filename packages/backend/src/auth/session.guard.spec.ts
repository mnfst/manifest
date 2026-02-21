/* Mock ESM dependencies before any imports */
const mockGetSession = jest.fn();

jest.mock('better-auth/node', () => ({
  fromNodeHeaders: jest.fn((h: unknown) => h),
}));

jest.mock('./auth.instance', () => ({
  auth: {
    api: { getSession: mockGetSession },
  },
}));

import { SessionGuard } from './session.guard';
import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';

function makeContext(headers: Record<string, string> = {}) {
  const request: Record<string, unknown> = { headers };
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    _request: request,
  } as unknown as ExecutionContext & { _request: typeof request };
}

describe('SessionGuard', () => {
  let guard: SessionGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new SessionGuard(reflector);
    mockGetSession.mockReset();
  });

  describe('public routes', () => {
    it('should return true for @Public() routes without checking session', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
      const ctx = makeContext();

      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(mockGetSession).not.toHaveBeenCalled();
    });
  });

  describe('API key passthrough', () => {
    it('should return true when x-api-key header is present', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      const ctx = makeContext({ 'x-api-key': 'test-key' });

      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(mockGetSession).not.toHaveBeenCalled();
    });
  });

  describe('session validation', () => {
    it('should attach user and session when session is valid', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      const session = {
        user: { id: 'u1', name: 'Alice', email: 'alice@test.com' },
        session: { id: 's1', token: 'tok' },
      };
      mockGetSession.mockResolvedValue(session);
      const ctx = makeContext({ cookie: 'session=abc' });

      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
      expect(ctx._request.user).toEqual(session.user);
      expect(ctx._request.session).toEqual(session.session);
    });

    it('should still return true when no session exists (delegates to ApiKeyGuard)', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      mockGetSession.mockResolvedValue(null);
      const ctx = makeContext();

      const result = await guard.canActivate(ctx);

      expect(result).toBe(true);
    });

    it('should not attach user when session is null', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      mockGetSession.mockResolvedValue(null);
      const ctx = makeContext();

      await guard.canActivate(ctx);

      expect(ctx._request.user).toBeUndefined();
      expect(ctx._request.session).toBeUndefined();
    });

    it('should call getSession with request headers', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      mockGetSession.mockResolvedValue(null);
      const headers = { cookie: 'auth=xyz', 'user-agent': 'test' };
      const ctx = makeContext(headers);

      await guard.canActivate(ctx);

      expect(mockGetSession).toHaveBeenCalledWith(
        expect.objectContaining({ headers }),
      );
    });
  });
});
