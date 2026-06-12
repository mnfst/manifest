import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AgentListCacheInterceptor } from './agent-list-cache.interceptor';

function createMockContext(
  user: { id?: string } | undefined,
  query: Record<string, string> | undefined,
  method = 'GET',
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user, query, method, originalUrl: '/api/v1/agents' }),
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
    it('keys on the playground=true canonical variant for ?includePlayground=true', () => {
      const key = interceptor['trackBy'](
        createMockContext({ id: 'u1' }, { includePlayground: 'true' }),
      );
      expect(key).toBe('u1:/api/v1/agents:playground=true');
    });

    it('keys on the playground=false canonical variant when no query param is present', () => {
      const key = interceptor['trackBy'](createMockContext({ id: 'u1' }, undefined));
      expect(key).toBe('u1:/api/v1/agents:playground=false');
    });

    it('collapses ?includePlayground=false onto the same playground=false key (no stranded variant)', () => {
      const key = interceptor['trackBy'](
        createMockContext({ id: 'u1' }, { includePlayground: 'false' }),
      );
      expect(key).toBe('u1:/api/v1/agents:playground=false');
    });

    it('collapses any non-"true" value onto the playground=false key', () => {
      const key = interceptor['trackBy'](
        createMockContext({ id: 'u1' }, { includePlayground: '1' }),
      );
      expect(key).toBe('u1:/api/v1/agents:playground=false');
    });

    it('returns undefined for non-GET requests', () => {
      const key = interceptor['trackBy'](
        createMockContext({ id: 'u1' }, { includePlayground: 'true' }, 'POST'),
      );
      expect(key).toBeUndefined();
    });

    it('returns undefined when user is not present', () => {
      const key = interceptor['trackBy'](createMockContext(undefined, undefined));
      expect(key).toBeUndefined();
    });

    it('returns undefined when user has no id', () => {
      const key = interceptor['trackBy'](createMockContext({}, undefined));
      expect(key).toBeUndefined();
    });
  });
});
