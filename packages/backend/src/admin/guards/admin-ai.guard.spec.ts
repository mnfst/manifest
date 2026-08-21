import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminAiGuard } from './admin-ai.guard';
import { ADMIN_BOOTSTRAP_KEY } from '../decorators/admin-bootstrap.decorator';

type MetadataReader = { getAllAndOverride: (key: symbol | string) => unknown };

function makeContext(
  authScope?: string,
  metadata?: Partial<Record<symbol | string, unknown>>,
): ExecutionContext {
  const request: Record<string, unknown> = {};
  if (authScope !== undefined) request.authScope = authScope;
  const reflector = {
    getAllAndOverride: (key: symbol | string) => (metadata ? metadata[key] : undefined),
  } as unknown as Reflector;
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
    reflector,
  } as unknown as ExecutionContext;
}

describe('AdminAiGuard', () => {
  const noBootstrap: Partial<Record<symbol | string, unknown>> = {
    [ADMIN_BOOTSTRAP_KEY]: false,
  };

  it('allows requests whose resolved scope is ai_admin', () => {
    const guard = new AdminAiGuard(new Reflector());
    expect(guard.canActivate(makeContext('ai_admin'))).toBe(true);
  });

  it('throws ForbiddenException for an owner (non-admin) key on regular routes', () => {
    const guard = new AdminAiGuard(new Reflector());
    expect(() => guard.canActivate(makeContext('owner'))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(makeContext('owner'))).toThrow(
      'not authorized for the admin surface',
    );
  });

  it('throws UnauthorizedException when no key scope was resolved', () => {
    const guard = new AdminAiGuard(new Reflector());
    expect(() => guard.canActivate(makeContext(undefined))).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(makeContext(undefined))).toThrow('requires an AI-admin key');
  });

  it('admits an owner key only on @AdminBootstrap() routes', () => {
    const bootstrapMeta: Partial<Record<symbol | string, unknown>> = {
      [ADMIN_BOOTSTRAP_KEY]: true,
    };
    // Route-level metadata wins over class-level absence.
    const guard = new AdminAiGuard({
      getAllAndOverride: (_key: symbol | string, _handlers?: unknown) =>
        bootstrapMeta[ADMIN_BOOTSTRAP_KEY],
    } as unknown as Reflector);
    expect(guard.canActivate(makeContext('owner'))).toBe(true);

    // Without the flag the same owner key stays forbidden.
    const plainGuard = new AdminAiGuard(new Reflector());
    expect(() => plainGuard.canActivate(makeContext('owner'))).toThrow(ForbiddenException);
  });
});
