import { ProxyMessageRecorder } from '../proxy-message-recorder';

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
    return { recorder, insert, requestValues, execute };
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
      expect.objectContaining({ id: 'request-1', status: 'error', error_origin: 'transport' }),
    );
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ request_id: 'request-1' }));
    recorder.onModuleDestroy();
  });

  it('records a Manifest rejection with zero provider attempts', async () => {
    const { recorder, insert, requestValues } = setup();
    await recorder.recordManifestBlockedRequest(ctx, {
      requestId: 'request-2',
      reason: 'no_provider_key',
      errorMessage: 'No provider key',
      errorCode: 'M100',
    });

    expect(requestValues).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'request-2', status: 'error', error_origin: 'config' }),
    );
    expect(insert).not.toHaveBeenCalled();
    recorder.onModuleDestroy();
  });

  it('uses the rebuilt primary response as an exhausted fallback outcome', async () => {
    const { recorder, requestValues } = setup();
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
        status: 'error',
        error_http_status: 503,
        error_message: 'primary unavailable',
      }),
    );
    recorder.onModuleDestroy();
  });
});
