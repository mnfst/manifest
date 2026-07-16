import { ProxyMessageRecorder } from '../proxy-message-recorder';
import type { AutofixRecord } from '../../autofix/autofix.types';

describe('ProxyMessageRecorder request parents', () => {
  const ctx = {
    tenantId: 'tenant-1',
    agentId: 'agent-1',
    agentName: 'agent',
    userId: 'user-1',
  };

  function setup() {
    const requestValues = jest.fn();
    const execute = jest.fn().mockResolvedValue(undefined);
    const requestQb: Record<string, jest.Mock> = {
      insert: jest.fn(),
      into: jest.fn(),
      values: requestValues,
      orUpdate: jest.fn(),
      orIgnore: jest.fn(),
      execute,
    };
    for (const key of ['insert', 'into', 'values', 'orUpdate', 'orIgnore']) {
      requestQb[key].mockReturnValue(requestQb);
    }
    const requestRepo = { createQueryBuilder: jest.fn(() => requestQb) };
    const insert = jest.fn().mockResolvedValue(undefined);
    const messageRepo = {
      insert,
      manager: { getRepository: jest.fn(() => requestRepo) },
    };
    const recorder = new ProxyMessageRecorder(
      messageRepo as never,
      { getByModel: jest.fn() } as never,
      {} as never,
      { emit: jest.fn() } as never,
      {
        canonicalizeAgentMessageKeys: jest.fn(
          async (_tenant: string, provider: string | null, model: string | null) => ({
            provider,
            model,
          }),
        ),
      } as never,
      {} as never,
    );
    return { recorder, insert, requestValues, execute, requestQb };
  }

  it('creates a terminal request before its provider attempt', async () => {
    const { recorder, insert, requestValues, execute } = setup();
    await recorder.recordProviderError(ctx, 503, 'upstream down', {
      requestId: 'request-1',
      provider: 'openai',
      model: 'gpt-4o',
    });

    expect(execute).toHaveBeenCalledTimes(1);
    expect(requestValues).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'request-1',
        status: 'failed',
        autofix_status: null,
        error_origin: 'transport',
      }),
    );
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ request_id: 'request-1' }));
    recorder.onModuleDestroy();
  });

  it('does not overwrite the model originally requested at ingress', async () => {
    const { recorder, requestQb } = setup();
    await recorder.recordProviderError(ctx, 503, 'upstream down', {
      requestId: 'request-routed-model',
      provider: 'openai',
      model: 'routed-model',
    });

    const updatedColumns = requestQb.orUpdate.mock.calls[0][0] as string[];
    expect(updatedColumns).not.toContain('requested_model');
    recorder.onModuleDestroy();
  });

  it('finishes a locally rejected Request without inserting a Provider Attempt', async () => {
    const { recorder, insert, requestValues, execute } = setup();
    await recorder.recordProviderError(ctx, 429, 'route cooling down', {
      requestId: 'request-local-rejection',
      provider: 'openai',
      model: 'gpt-4o',
      skipAttempt: true,
    });

    expect(execute).toHaveBeenCalledTimes(1);
    expect(requestValues).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'request-local-rejection', status: 'failed' }),
    );
    expect(insert).not.toHaveBeenCalled();
    recorder.onModuleDestroy();
  });

  it('creates the Request as pending at ingress', async () => {
    const { recorder, insert, requestValues, execute } = setup();

    await recorder.recordPendingRequest(ctx, {
      requestId: 'request-pending',
      timestamp: '2026-07-16T12:00:00.000Z',
      traceId: 'trace-1',
      sessionKey: 'session-1',
      requestedModel: 'gpt-4o',
    });

    expect(execute).toHaveBeenCalledTimes(1);
    expect(requestValues).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'request-pending',
        status: 'pending',
        timestamp: '2026-07-16T12:00:00.000Z',
        requested_model: 'gpt-4o',
      }),
    );
    expect(insert).not.toHaveBeenCalled();
    recorder.onModuleDestroy();
  });

  it.each([
    [
      'no_patch',
      [
        {
          attempt: 0,
          origin: 'original',
          request: {},
          http_status: 400,
          phoenix_status: 'no_patch',
        },
      ],
    ],
    [
      'resolving',
      [
        {
          attempt: 0,
          origin: 'original',
          request: {},
          http_status: 400,
          phoenix_status: 'resolving',
        },
      ],
    ],
    ['retry_succeeded', [{ attempt: 1, origin: 'autofix', request: {}, http_status: 200 }]],
    ['retry_failed', [{ attempt: 1, origin: 'autofix', request: {}, http_status: 422 }]],
    ['service_error', []],
  ] as const)('records the %s Auto-fix outcome on the request', async (expected, chain) => {
    const { recorder, requestValues } = setup();
    const autofix: AutofixRecord = {
      groupId: 'autofix-1',
      outcome: 'exhausted',
      original_http_status: 400,
      chain: [...chain],
    } as AutofixRecord;

    await recorder.recordProviderError(ctx, 400, 'provider error', {
      requestId: `request-${expected}`,
      autofix,
    });

    expect(requestValues).toHaveBeenCalledWith(
      expect.objectContaining({ autofix_status: expected }),
    );
    recorder.onModuleDestroy();
  });

  it('records a Manifest rejection with zero provider attempts', async () => {
    const { recorder, insert, requestValues } = setup();
    await recorder.recordManifestBlockedRequest(ctx, {
      requestId: 'request-2',
      reason: 'no_provider_key',
      errorMessage: 'No provider key',
      errorCode: 'M100',
      durationMs: 42,
    });

    expect(requestValues).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'request-2',
        status: 'failed',
        error_origin: 'config',
        duration_ms: 42,
      }),
    );
    expect(insert).not.toHaveBeenCalled();
    recorder.onModuleDestroy();
  });

  it('uses the rebuilt primary response as an exhausted fallback outcome', async () => {
    const { recorder, insert, requestValues } = setup();
    await recorder.recordFailedFallbacks(
      ctx,
      'standard',
      'gpt-4o',
      [
        {
          model: 'claude-sonnet',
          provider: 'anthropic',
          status: 429,
          errorBody: 'fallback limited',
          fallbackIndex: 0,
        },
      ],
      { requestId: 'request-3', markHandled: true, lastAsError: true },
    );
    await recorder.recordPrimaryFailure(
      ctx,
      'standard',
      'gpt-4o',
      'primary unavailable',
      '2026-07-14T12:00:00.000Z',
      'api_key',
      { requestId: 'request-3', provider: 'openai', terminalHttpStatus: 503 },
    );

    expect(requestValues).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ id: 'request-3', status: 'pending' }),
    );
    expect(requestValues).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        id: 'request-3',
        status: 'failed',
        error_http_status: 503,
        error_message: 'primary unavailable',
      }),
    );
    expect(insert).toHaveBeenLastCalledWith(
      expect.objectContaining({
        request_id: 'request-3',
        status: 'failed',
        superseded: true,
        error_http_status: null,
      }),
    );
    recorder.onModuleDestroy();
  });
});
