import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Cache } from 'cache-manager';
import { AgentListCacheInterceptor } from './agent-list-cache.interceptor';
import { AgentListCacheService } from '../services/agent-list-cache.service';

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
  let keys: AgentListCacheService;
  let cacheManager: { get: jest.Mock; set: jest.Mock; del: jest.Mock };

  beforeEach(() => {
    cacheManager = {
      get: jest.fn().mockResolvedValue(undefined),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(true),
    };
    keys = new AgentListCacheService(cacheManager as unknown as Cache);
    interceptor = new AgentListCacheInterceptor(cacheManager as never, new Reflector(), keys);
  });

  it('keys on the current generation, so a request that started earlier cannot be served again', async () => {
    const context = createMockContext({ tenantId: 't1' }, undefined);
    const before = interceptor['trackBy'](context);

    await keys.invalidate('t1');

    expect(interceptor['trackBy'](context)).not.toBe(before);
    expect(interceptor['trackBy'](context)).toBe('t1:/api/v1/agents:playground=false:g1');
  });

  describe('trackBy', () => {
    it('keys on the playground=true canonical variant for ?includePlayground=true', () => {
      const key = interceptor['trackBy'](
        createMockContext({ tenantId: 't1' }, { includePlayground: 'true' }),
      );
      expect(key).toBe('t1:/api/v1/agents:playground=true:g0');
    });

    it('keys on the playground=false canonical variant when no query param is present', () => {
      const key = interceptor['trackBy'](createMockContext({ tenantId: 't1' }, undefined));
      expect(key).toBe('t1:/api/v1/agents:playground=false:g0');
    });

    it('collapses ?includePlayground=false onto the same playground=false key (no stranded variant)', () => {
      const key = interceptor['trackBy'](
        createMockContext({ tenantId: 't1' }, { includePlayground: 'false' }),
      );
      expect(key).toBe('t1:/api/v1/agents:playground=false:g0');
    });

    it('collapses any non-"true" value onto the playground=false key', () => {
      const key = interceptor['trackBy'](
        createMockContext({ tenantId: 't1' }, { includePlayground: '1' }),
      );
      expect(key).toBe('t1:/api/v1/agents:playground=false:g0');
    });

    it('returns undefined for non-GET requests', () => {
      const key = interceptor['trackBy'](
        createMockContext({ tenantId: 't1' }, { includePlayground: 'true' }, 'POST'),
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
