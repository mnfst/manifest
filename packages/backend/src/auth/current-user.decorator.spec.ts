import { CurrentUser } from './current-user.decorator';
import { ExecutionContext } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';

describe('CurrentUser decorator', () => {
  it('extracts user from the request object', () => {
    class TestController {
      handler(@CurrentUser() _user: unknown) {
        return _user;
      }
    }

    const metadata = Reflect.getMetadata(ROUTE_ARGS_METADATA, TestController, 'handler');
    expect(metadata).toBeDefined();

    const key = Object.keys(metadata)[0];
    const factory = metadata[key].factory;

    const mockUser = { id: 'u1', name: 'Test' };
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({ user: mockUser }),
      }),
    } as unknown as ExecutionContext;

    const result = factory(null, mockContext);
    expect(result).toEqual(mockUser);
  });

  it('returns undefined when no user on request', () => {
    class TestController2 {
      handler(@CurrentUser() _user: unknown) {
        return _user;
      }
    }

    const metadata = Reflect.getMetadata(ROUTE_ARGS_METADATA, TestController2, 'handler');
    const key = Object.keys(metadata)[0];
    const factory = metadata[key].factory;

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({}),
      }),
    } as unknown as ExecutionContext;

    const result = factory(null, mockContext);
    expect(result).toBeUndefined();
  });
});
