import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserCacheInterceptor } from './user-cache.interceptor';

function createMockContext(
  tenantContext: { tenantId?: string } | undefined,
  originalUrl: string,
  method = 'GET',
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ tenantContext, originalUrl, method }),
      getResponse: () => ({}),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
    getArgs: () => [],
    getArgByIndex: () => ({}),
    switchToRpc: () => ({}) as never,
    switchToWs: () => ({}) as never,
    getType: () => 'http',
  } as unknown as ExecutionContext;
}

describe('UserCacheInterceptor', () => {
  let interceptor: UserCacheInterceptor;

  beforeEach(() => {
    const mockCacheManager = {} as never;
    const mockReflector = new Reflector();

    interceptor = new UserCacheInterceptor(mockCacheManager, mockReflector);
  });

  describe('trackBy', () => {
    it('should return tenantId:originalUrl when tenant context is present', () => {
      const context = createMockContext({ tenantId: 'tenant-abc' }, '/api/v1/overview');

      const key = interceptor['trackBy'](context);

      expect(key).toBe('tenant-abc:/api/v1/overview');
    });

    it('should include query parameters in the cache key', () => {
      const context = createMockContext(
        { tenantId: 'tenant-1' },
        '/api/v1/tokens?range=7d&agent=demo',
      );

      const key = interceptor['trackBy'](context);

      expect(key).toBe('tenant-1:/api/v1/tokens?range=7d&agent=demo');
    });

    it('should return undefined for non-GET requests', () => {
      const context = createMockContext({ tenantId: 'tenant-abc' }, '/api/v1/overview', 'POST');

      const key = interceptor['trackBy'](context);

      expect(key).toBeUndefined();
    });

    it('should return undefined when tenant context is not present', () => {
      const context = createMockContext(undefined, '/api/v1/overview');

      const key = interceptor['trackBy'](context);

      expect(key).toBeUndefined();
    });

    it('should return undefined when tenant context has no tenantId', () => {
      const context = createMockContext({}, '/api/v1/overview');

      const key = interceptor['trackBy'](context);

      expect(key).toBeUndefined();
    });

    it('should generate distinct keys for different URLs', () => {
      const ctx1 = createMockContext({ tenantId: 'tenant-1' }, '/api/v1/overview');
      const ctx2 = createMockContext({ tenantId: 'tenant-1' }, '/api/v1/tokens');

      const key1 = interceptor['trackBy'](ctx1);
      const key2 = interceptor['trackBy'](ctx2);

      expect(key1).not.toBe(key2);
      expect(key1).toBe('tenant-1:/api/v1/overview');
      expect(key2).toBe('tenant-1:/api/v1/tokens');
    });

    it('should generate distinct keys for different tenants on the same URL', () => {
      const ctx1 = createMockContext({ tenantId: 'tenant-1' }, '/api/v1/overview');
      const ctx2 = createMockContext({ tenantId: 'tenant-2' }, '/api/v1/overview');

      const key1 = interceptor['trackBy'](ctx1);
      const key2 = interceptor['trackBy'](ctx2);

      expect(key1).toBe('tenant-1:/api/v1/overview');
      expect(key2).toBe('tenant-2:/api/v1/overview');
    });
  });
});
