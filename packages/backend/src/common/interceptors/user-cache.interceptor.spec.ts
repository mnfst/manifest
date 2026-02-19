import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserCacheInterceptor } from './user-cache.interceptor';
import { CacheInvalidationService } from '../services/cache-invalidation.service';

function createMockContext(
  user: { id?: string } | undefined,
  originalUrl: string,
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user, originalUrl }),
      getResponse: () => ({}),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
    getArgs: () => [],
    getArgByIndex: () => ({}),
    switchToRpc: () => ({} as never),
    switchToWs: () => ({} as never),
    getType: () => 'http',
  } as unknown as ExecutionContext;
}

describe('UserCacheInterceptor', () => {
  let interceptor: UserCacheInterceptor;
  let mockTrackKey: jest.Mock;

  beforeEach(() => {
    mockTrackKey = jest.fn();
    const mockInvalidation = { trackKey: mockTrackKey } as unknown as CacheInvalidationService;
    const mockCacheManager = {} as never;
    const mockReflector = new Reflector();

    interceptor = new UserCacheInterceptor(
      mockCacheManager,
      mockReflector,
      mockInvalidation,
    );
  });

  describe('trackBy', () => {
    it('should return userId:originalUrl when user is present', () => {
      const context = createMockContext({ id: 'user-abc' }, '/api/v1/overview');

      const key = interceptor['trackBy'](context);

      expect(key).toBe('user-abc:/api/v1/overview');
    });

    it('should call trackKey on the invalidation service', () => {
      const context = createMockContext({ id: 'user-abc' }, '/api/v1/overview');

      interceptor['trackBy'](context);

      expect(mockTrackKey).toHaveBeenCalledWith('user-abc', 'user-abc:/api/v1/overview');
    });

    it('should include query parameters in the cache key', () => {
      const context = createMockContext(
        { id: 'user-1' },
        '/api/v1/tokens?range=7d&agent=demo',
      );

      const key = interceptor['trackBy'](context);

      expect(key).toBe('user-1:/api/v1/tokens?range=7d&agent=demo');
    });

    it('should return undefined when user is not present', () => {
      const context = createMockContext(undefined, '/api/v1/overview');

      const key = interceptor['trackBy'](context);

      expect(key).toBeUndefined();
    });

    it('should return undefined when user has no id', () => {
      const context = createMockContext({}, '/api/v1/overview');

      const key = interceptor['trackBy'](context);

      expect(key).toBeUndefined();
    });

    it('should not call trackKey when user is absent', () => {
      const context = createMockContext(undefined, '/api/v1/overview');

      interceptor['trackBy'](context);

      expect(mockTrackKey).not.toHaveBeenCalled();
    });

    it('should not call trackKey when user has no id', () => {
      const context = createMockContext({}, '/api/v1/overview');

      interceptor['trackBy'](context);

      expect(mockTrackKey).not.toHaveBeenCalled();
    });

    it('should generate distinct keys for different URLs', () => {
      const ctx1 = createMockContext({ id: 'user-1' }, '/api/v1/overview');
      const ctx2 = createMockContext({ id: 'user-1' }, '/api/v1/tokens');

      const key1 = interceptor['trackBy'](ctx1);
      const key2 = interceptor['trackBy'](ctx2);

      expect(key1).not.toBe(key2);
      expect(key1).toBe('user-1:/api/v1/overview');
      expect(key2).toBe('user-1:/api/v1/tokens');
    });

    it('should generate distinct keys for different users on the same URL', () => {
      const ctx1 = createMockContext({ id: 'user-1' }, '/api/v1/overview');
      const ctx2 = createMockContext({ id: 'user-2' }, '/api/v1/overview');

      const key1 = interceptor['trackBy'](ctx1);
      const key2 = interceptor['trackBy'](ctx2);

      expect(key1).toBe('user-1:/api/v1/overview');
      expect(key2).toBe('user-2:/api/v1/overview');
    });
  });
});
