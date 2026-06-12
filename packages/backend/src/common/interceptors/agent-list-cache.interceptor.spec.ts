import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AgentListCacheInterceptor } from './agent-list-cache.interceptor';

function createMockContext(
  tenantContext: { tenantId?: string } | undefined,
  query: Record<string, string> | undefined,
  method = 'GET',
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ tenantContext, query, method, originalUrl: '/api/v1/agents' }),
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

describe('AgentListCacheInterceptor', () => {
  let interceptor: AgentListCacheInterceptor;

  beforeEach(() => {
    const mockCacheManager = {} as never;
    interceptor = new AgentListCacheInterceptor(mockCacheManager, new Reflector());
  });

  describe('trackBy', () => {
    it('keys on the system=true canonical variant for ?includeSystem=true', () => {
      const key = interceptor['trackBy'](
        createMockContext({ tenantId: 't1' }, { includeSystem: 'true' }),
      );
      expect(key).toBe('t1:/api/v1/agents:system=true');
    });

    it('keys on the system=false canonical variant when no query param is present', () => {
      const key = interceptor['trackBy'](createMockContext({ tenantId: 't1' }, undefined));
      expect(key).toBe('t1:/api/v1/agents:system=false');
    });

    it('collapses ?includeSystem=false onto the same system=false key (no stranded variant)', () => {
      const key = interceptor['trackBy'](
        createMockContext({ tenantId: 't1' }, { includeSystem: 'false' }),
      );
      expect(key).toBe('t1:/api/v1/agents:system=false');
    });

    it('collapses any non-"true" value onto the system=false key', () => {
      const key = interceptor['trackBy'](
        createMockContext({ tenantId: 't1' }, { includeSystem: '1' }),
      );
      expect(key).toBe('t1:/api/v1/agents:system=false');
    });

    it('returns undefined for non-GET requests', () => {
      const key = interceptor['trackBy'](
        createMockContext({ tenantId: 't1' }, { includeSystem: 'true' }, 'POST'),
      );
      expect(key).toBeUndefined();
    });

    it('returns undefined when tenant context is not present', () => {
      const key = interceptor['trackBy'](createMockContext(undefined, undefined));
      expect(key).toBeUndefined();
    });

    it('returns undefined when tenant context has no tenantId', () => {
      const key = interceptor['trackBy'](createMockContext({}, undefined));
      expect(key).toBeUndefined();
    });
  });
});
