// Ensure the Reflect metadata API is initialized before we read decorator
// metadata below. NestJS normally does this transitively, but this spec
// exercises the decorator in isolation.
import 'reflect-metadata';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { CurrentUser } from './current-user.decorator';

// NestJS param decorators attach their factory via ROUTE_ARGS_METADATA. To unit-test
// the factory we apply the decorator to a fake handler and pull the factory out of
// the metadata, then invoke it against a mocked ExecutionContext.
function getDecoratorFactory(
  decorator: ReturnType<typeof CurrentUser>,
): (data: unknown, ctx: ExecutionContext) => unknown {
  class Probe {
    handler(@decorator user: unknown) {
      return user;
    }
  }
  const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, Probe, 'handler');
  const key = Object.keys(args)[0];
  return args[key].factory as (data: unknown, ctx: ExecutionContext) => unknown;
}

function createContext(user: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('@CurrentUser()', () => {
  const factory = getDecoratorFactory(CurrentUser());

  it('returns request.user from the execution context', () => {
    const user = { id: 'user_123', email: 'alice@example.com' };
    expect(factory(undefined, createContext(user))).toBe(user);
  });

  it('throws UnauthorizedException when no user is attached to the request', () => {
    // Without a user we can't filter analytics by tenant — fail closed with
    // a 401 instead of letting controllers crash on `user.id`.
    expect(() => factory(undefined, createContext(undefined))).toThrow(UnauthorizedException);
  });

  it('ignores the data argument (decorator is not field-scoped)', () => {
    const user = { id: 'u' };
    expect(factory('anything', createContext(user))).toBe(user);
  });
});
