// Ensure the Reflect metadata API is initialized before we read decorator
// metadata below. NestJS normally does this transitively, but this spec
// exercises the decorator in isolation.
import 'reflect-metadata';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { TenantCtx, TenantContext } from './tenant-context.decorator';

// NestJS param decorators attach their factory via ROUTE_ARGS_METADATA. To unit-test
// the factory we apply the decorator to a fake handler and pull the factory out of
// the metadata, then invoke it against a mocked ExecutionContext.
function getDecoratorFactory(
  decorator: ReturnType<typeof TenantCtx>,
): (data: unknown, ctx: ExecutionContext) => unknown {
  class Probe {
    handler(@decorator ctx: unknown) {
      return ctx;
    }
  }
  const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, Probe, 'handler');
  const key = Object.keys(args)[0];
  return args[key].factory as (data: unknown, ctx: ExecutionContext) => unknown;
}

function createContext(tenantContext: TenantContext | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ tenantContext }) }),
  } as unknown as ExecutionContext;
}

describe('@TenantCtx()', () => {
  const factory = getDecoratorFactory(TenantCtx());

  it('returns request.tenantContext from the execution context', () => {
    const tenantContext: TenantContext = { tenantId: 'tenant-1', userId: 'user-1' };
    expect(factory(undefined, createContext(tenantContext))).toBe(tenantContext);
  });

  it('returns a context whose tenantId is null for a fresh user without a tenant', () => {
    const tenantContext: TenantContext = { tenantId: null, userId: 'fresh-user' };
    expect(factory(undefined, createContext(tenantContext))).toEqual({
      tenantId: null,
      userId: 'fresh-user',
    });
  });

  it('throws UnauthorizedException when no credential attached a tenant context', () => {
    // Fail closed with a 401 (same contract as @CurrentUser) instead of letting
    // controllers crash on `ctx.tenantId` of undefined.
    expect(() => factory(undefined, createContext(undefined))).toThrow(UnauthorizedException);
  });

  it('ignores the data argument (decorator is not field-scoped)', () => {
    const tenantContext: TenantContext = { tenantId: 't', userId: 'u' };
    expect(factory('anything', createContext(tenantContext))).toBe(tenantContext);
  });
});
