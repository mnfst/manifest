import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { SessionOnlyGuard } from './session-only.guard';

function contextFor(authMethod?: string): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ authMethod }) }),
  } as unknown as ExecutionContext;
}

describe('SessionOnlyGuard', () => {
  const guard = new SessionOnlyGuard();

  it('allows an authenticated user session', () => {
    expect(guard.canActivate(contextFor('session'))).toBe(true);
  });

  it.each(['api_key', 'env_api_key', undefined])('rejects non-session auth method %s', (method) => {
    expect(() => guard.canActivate(contextFor(method))).toThrow(UnauthorizedException);
  });
});
