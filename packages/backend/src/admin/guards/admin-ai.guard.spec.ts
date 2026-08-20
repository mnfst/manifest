import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AdminAiGuard } from './admin-ai.guard';

function makeContext(authScope?: string): ExecutionContext {
  const request: Record<string, unknown> = {};
  if (authScope !== undefined) request.authScope = authScope;
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('AdminAiGuard', () => {
  const guard = new AdminAiGuard();

  it('allows requests whose resolved scope is ai_admin', () => {
    expect(guard.canActivate(makeContext('ai_admin'))).toBe(true);
  });

  it('throws ForbiddenException for an owner (non-admin) key', () => {
    expect(() => guard.canActivate(makeContext('owner'))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(makeContext('owner'))).toThrow(
      'not authorized for the admin surface',
    );
  });

  it('throws UnauthorizedException when no key scope was resolved', () => {
    expect(() => guard.canActivate(makeContext(undefined))).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(makeContext(undefined))).toThrow('requires an AI-admin key');
  });
});
