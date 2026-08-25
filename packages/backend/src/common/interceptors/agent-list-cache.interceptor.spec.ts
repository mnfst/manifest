import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { firstValueFrom, ReplaySubject } from 'rxjs';
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
  let cacheManager: { get: jest.Mock; set: jest.Mock; del: jest.Mock };

  beforeEach(() => {
    cacheManager = {
      get: jest.fn().mockResolvedValue(undefined),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(true),
    };
    interceptor = new AgentListCacheInterceptor(cacheManager as never, new Reflector());
  });

  it('waits for an older response cache write before deleting both variants', async () => {
    const context = createMockContext({ tenantId: 't1' }, undefined);
    const source = new ReplaySubject<{ agents: unknown[] }>(1);
    const next: CallHandler = { handle: jest.fn(() => source) };
    let finishWrite!: () => void;
    const writeFinished = new Promise<void>((resolve) => {
      finishWrite = resolve;
    });
    cacheManager.set.mockReturnValue(writeFinished);

    const response = await interceptor.intercept(context, next);
    const responseFinished = firstValueFrom(response);
    const invalidation = interceptor.invalidate('t1');

    await Promise.resolve();
    expect(cacheManager.del).not.toHaveBeenCalled();

    source.next({ agents: [] });
    source.complete();
    await responseFinished;
    await Promise.resolve();

    expect(cacheManager.set).toHaveBeenCalledWith('t1:/api/v1/agents:playground=false', {
      agents: [],
    });
    expect(cacheManager.del).not.toHaveBeenCalled();

    finishWrite();
    await invalidation;

    expect(cacheManager.del).toHaveBeenCalledTimes(2);
    expect(cacheManager.del).toHaveBeenCalledWith('t1:/api/v1/agents:playground=false');
    expect(cacheManager.del).toHaveBeenCalledWith('t1:/api/v1/agents:playground=true');
  });

  describe('trackBy', () => {
    it('keys on the playground=true canonical variant for ?includePlayground=true', () => {
      const key = interceptor['trackBy'](
        createMockContext({ tenantId: 't1' }, { includePlayground: 'true' }),
      );
      expect(key).toBe('t1:/api/v1/agents:playground=true');
    });

    it('keys on the playground=false canonical variant when no query param is present', () => {
      const key = interceptor['trackBy'](createMockContext({ tenantId: 't1' }, undefined));
      expect(key).toBe('t1:/api/v1/agents:playground=false');
    });

    it('collapses ?includePlayground=false onto the same playground=false key (no stranded variant)', () => {
      const key = interceptor['trackBy'](
        createMockContext({ tenantId: 't1' }, { includePlayground: 'false' }),
      );
      expect(key).toBe('t1:/api/v1/agents:playground=false');
    });

    it('collapses any non-"true" value onto the playground=false key', () => {
      const key = interceptor['trackBy'](
        createMockContext({ tenantId: 't1' }, { includePlayground: '1' }),
      );
      expect(key).toBe('t1:/api/v1/agents:playground=false');
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
