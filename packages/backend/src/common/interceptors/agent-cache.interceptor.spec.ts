import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AgentCacheInterceptor } from './agent-cache.interceptor';

function createMockContext(
  ingestionContext: { agentId?: string } | undefined,
  originalUrl: string,
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ ingestionContext, originalUrl }),
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

describe('AgentCacheInterceptor', () => {
  let interceptor: AgentCacheInterceptor;

  beforeEach(() => {
    interceptor = new AgentCacheInterceptor({} as never, new Reflector());
  });

  describe('trackBy', () => {
    it('returns agent-scoped key when ingestionContext has agentId', () => {
      const ctx = createMockContext({ agentId: 'a1' }, '/api/v1/agent/usage?range=24h');

      expect(interceptor['trackBy'](ctx)).toBe('agent:a1:/api/v1/agent/usage?range=24h');
    });

    it('returns undefined when ingestionContext is missing', () => {
      const ctx = createMockContext(undefined, '/api/v1/agent/usage');

      expect(interceptor['trackBy'](ctx)).toBeUndefined();
    });

    it('returns undefined when agentId is missing', () => {
      const ctx = createMockContext({}, '/api/v1/agent/usage');

      expect(interceptor['trackBy'](ctx)).toBeUndefined();
    });

    it('generates distinct keys for different agents', () => {
      const ctx1 = createMockContext({ agentId: 'a1' }, '/api/v1/agent/usage');
      const ctx2 = createMockContext({ agentId: 'a2' }, '/api/v1/agent/usage');

      expect(interceptor['trackBy'](ctx1)).toBe('agent:a1:/api/v1/agent/usage');
      expect(interceptor['trackBy'](ctx2)).toBe('agent:a2:/api/v1/agent/usage');
    });

    it('generates distinct keys for different URLs', () => {
      const ctx1 = createMockContext({ agentId: 'a1' }, '/api/v1/agent/usage');
      const ctx2 = createMockContext({ agentId: 'a1' }, '/api/v1/agent/costs');

      expect(interceptor['trackBy'](ctx1)).not.toBe(interceptor['trackBy'](ctx2));
    });
  });
});
