import { ProxyMessageRecorder } from '../proxy-message-recorder';
import { ProxyMessageDedup } from '../proxy-message-dedup';
import { ModelPricingCacheService } from '../../../model-prices/model-pricing-cache.service';
import { IngestEventBusService } from '../../../common/services/ingest-event-bus.service';
import { IngestionContext } from '../../../otlp/interfaces/ingestion-context.interface';

const ctx: IngestionContext = {
  tenantId: 'tenant-1',
  agentId: 'agent-1',
  agentName: 'test-agent',
  userId: 'user-1',
};

describe('ProxyMessageRecorder', () => {
  let recorder: ProxyMessageRecorder;
  let insertMock: jest.Mock;
  let getByModelMock: jest.Mock;
  let emitMock: jest.Mock;

  beforeEach(() => {
    insertMock = jest.fn();
    getByModelMock = jest.fn().mockReturnValue(undefined);
    emitMock = jest.fn();
    const repo = { insert: insertMock } as never;
    const pricingCache = {
      getByModel: getByModelMock,
    } as unknown as ModelPricingCacheService;
    const dedup = {} as ProxyMessageDedup;
    const eventBus = { emit: emitMock } as unknown as IngestEventBusService;
    recorder = new ProxyMessageRecorder(repo, pricingCache, dedup, eventBus);
  });

  afterEach(() => {
    recorder.onModuleDestroy();
  });

  describe('recordFallbackSuccess', () => {
    it('records with zero tokens when usage has zero tokens (fallback metadata is still valuable)', async () => {
      await recorder.recordFallbackSuccess(ctx, 'gpt-4o', 'standard', {
        fallbackFromModel: 'claude-opus',
        fallbackIndex: 0,
        timestamp: new Date().toISOString(),
        authType: 'api_key',
        usage: { prompt_tokens: 0, completion_tokens: 0 },
      });
      expect(insertMock).toHaveBeenCalledTimes(1);
      expect(insertMock.mock.calls[0][0]).toMatchObject({
        status: 'ok',
        input_tokens: 0,
        output_tokens: 0,
        fallback_from_model: 'claude-opus',
      });
    });

    it('records with zero tokens when usage is undefined (fallback chain succeeded)', async () => {
      await recorder.recordFallbackSuccess(ctx, 'gpt-4o', 'standard', {
        fallbackFromModel: 'claude-opus',
        fallbackIndex: 0,
        timestamp: new Date().toISOString(),
        authType: 'api_key',
      });
      expect(insertMock).toHaveBeenCalledTimes(1);
      expect(insertMock.mock.calls[0][0]).toMatchObject({
        status: 'ok',
        input_tokens: 0,
        output_tokens: 0,
      });
    });

    it('inserts when only prompt_tokens is non-zero', async () => {
      await recorder.recordFallbackSuccess(ctx, 'gpt-4o', 'standard', {
        traceId: 'trace-1',
        fallbackFromModel: 'claude-opus',
        fallbackIndex: 1,
        timestamp: new Date().toISOString(),
        authType: 'api_key',
        usage: { prompt_tokens: 200, completion_tokens: 0 },
      });
      expect(insertMock).toHaveBeenCalledTimes(1);
      expect(insertMock.mock.calls[0][0]).toMatchObject({
        input_tokens: 200,
        output_tokens: 0,
      });
    });

    it('inserts when only completion_tokens is non-zero', async () => {
      await recorder.recordFallbackSuccess(ctx, 'gpt-4o', 'standard', {
        fallbackFromModel: 'claude-opus',
        fallbackIndex: 0,
        timestamp: new Date().toISOString(),
        authType: 'api_key',
        usage: { prompt_tokens: 0, completion_tokens: 75 },
      });
      expect(insertMock).toHaveBeenCalledTimes(1);
      expect(insertMock.mock.calls[0][0]).toMatchObject({
        input_tokens: 0,
        output_tokens: 75,
      });
    });

    it('inserts a message with status "ok" and correct metadata', async () => {
      await recorder.recordFallbackSuccess(ctx, 'gpt-4o', 'standard', {
        traceId: 'trace-abc',
        fallbackFromModel: 'claude-opus',
        fallbackIndex: 2,
        timestamp: '2025-01-01T00:00:00.000Z',
        authType: 'api_key',
        usage: { prompt_tokens: 100, completion_tokens: 50 },
      });
      expect(insertMock).toHaveBeenCalledTimes(1);
      const inserted = insertMock.mock.calls[0][0];
      expect(inserted).toMatchObject({
        tenant_id: 'tenant-1',
        agent_id: 'agent-1',
        agent_name: 'test-agent',
        user_id: 'user-1',
        trace_id: 'trace-abc',
        status: 'ok',
        model: 'gpt-4o',
        routing_tier: 'standard',
        input_tokens: 100,
        output_tokens: 50,
        auth_type: 'api_key',
        fallback_from_model: 'claude-opus',
        fallback_index: 2,
        timestamp: '2025-01-01T00:00:00.000Z',
      });
    });

    it('computes cost_usd from pricing cache when usage has tokens', async () => {
      getByModelMock.mockReturnValue({
        model_name: 'gpt-4o',
        provider: 'OpenAI',
        input_price_per_token: 0.0000025,
        output_price_per_token: 0.00001,
        display_name: 'GPT-4o',
      });
      await recorder.recordFallbackSuccess(ctx, 'gpt-4o', 'standard', {
        authType: 'api_key',
        usage: { prompt_tokens: 1000, completion_tokens: 500 },
      });
      const inserted = insertMock.mock.calls[0][0];
      // 1000 * 0.0000025 + 500 * 0.00001 = 0.0075
      expect(inserted.cost_usd).toBeCloseTo(0.0075, 10);
    });

    it('sets cost_usd to 0 for subscription auth type', async () => {
      getByModelMock.mockReturnValue({
        model_name: 'gpt-4o',
        provider: 'OpenAI',
        input_price_per_token: 0.0000025,
        output_price_per_token: 0.00001,
        display_name: 'GPT-4o',
      });
      await recorder.recordFallbackSuccess(ctx, 'gpt-4o', 'standard', {
        authType: 'subscription',
        usage: { prompt_tokens: 1000, completion_tokens: 500 },
      });
      const inserted = insertMock.mock.calls[0][0];
      expect(inserted.cost_usd).toBe(0);
    });

    it('sets cost_usd to null when no pricing data exists', async () => {
      getByModelMock.mockReturnValue(undefined);
      await recorder.recordFallbackSuccess(ctx, 'unknown-model', 'standard', {
        authType: 'api_key',
        usage: { prompt_tokens: 100, completion_tokens: 50 },
      });
      const inserted = insertMock.mock.calls[0][0];
      expect(inserted.cost_usd).toBeNull();
    });

    it('records with defaults when optional fields are not provided', async () => {
      await recorder.recordFallbackSuccess(ctx, 'gpt-4o', 'standard');
      expect(insertMock).toHaveBeenCalledTimes(1);
      const inserted = insertMock.mock.calls[0][0];
      expect(inserted.input_tokens).toBe(0);
      expect(inserted.output_tokens).toBe(0);
      expect(inserted.trace_id).toBeNull();
      expect(inserted.fallback_from_model).toBeNull();
      expect(inserted.fallback_index).toBeNull();
      expect(inserted.auth_type).toBeNull();
    });

    it('uses current timestamp when timestamp is not provided', async () => {
      const before = new Date().toISOString();
      await recorder.recordFallbackSuccess(ctx, 'gpt-4o', 'standard', {
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      });
      const after = new Date().toISOString();
      const inserted = insertMock.mock.calls[0][0];
      expect(inserted.timestamp >= before).toBe(true);
      expect(inserted.timestamp <= after).toBe(true);
      expect(inserted.auth_type).toBeNull();
      expect(inserted.fallback_from_model).toBeNull();
      expect(inserted.fallback_index).toBeNull();
      expect(inserted.trace_id).toBeNull();
    });

    it('records cache tokens from usage', async () => {
      await recorder.recordFallbackSuccess(ctx, 'gpt-4o', 'standard', {
        authType: 'api_key',
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          cache_read_tokens: 30,
          cache_creation_tokens: 20,
        },
      });
      const inserted = insertMock.mock.calls[0][0];
      expect(inserted.cache_read_tokens).toBe(30);
      expect(inserted.cache_creation_tokens).toBe(20);
    });

    it('defaults cache tokens to 0 when not in usage', async () => {
      await recorder.recordFallbackSuccess(ctx, 'gpt-4o', 'standard', {
        authType: 'api_key',
        usage: { prompt_tokens: 100, completion_tokens: 50 },
      });
      const inserted = insertMock.mock.calls[0][0];
      expect(inserted.cache_read_tokens).toBe(0);
      expect(inserted.cache_creation_tokens).toBe(0);
    });

    it('emits SSE event after recording', async () => {
      await recorder.recordFallbackSuccess(ctx, 'gpt-4o', 'standard');
      expect(emitMock).toHaveBeenCalledWith('user-1');
    });

    it('persists the provider column when passed via opts', async () => {
      await recorder.recordFallbackSuccess(ctx, 'gemma4:31b', 'standard', {
        provider: 'ollama-cloud',
        usage: { prompt_tokens: 5, completion_tokens: 5 },
      });
      expect(insertMock.mock.calls[0][0].provider).toBe('ollama-cloud');
    });

    it('persists routing_reason when passed via opts (parity with non-fallback success)', async () => {
      await recorder.recordFallbackSuccess(ctx, 'gpt-4o', 'standard', {
        reason: 'header-match',
        usage: { prompt_tokens: 1, completion_tokens: 1 },
      });
      expect(insertMock.mock.calls[0][0].routing_reason).toBe('header-match');
    });

    it('writes null routing_reason when reason is omitted', async () => {
      await recorder.recordFallbackSuccess(ctx, 'gpt-4o', 'standard', {
        usage: { prompt_tokens: 1, completion_tokens: 1 },
      });
      expect(insertMock.mock.calls[0][0].routing_reason).toBeNull();
    });
  });

  describe('recordProviderError', () => {
    it('records error and emits SSE event', async () => {
      await recorder.recordProviderError(ctx, 500, 'Internal error', {
        model: 'gpt-4o',
        tier: 'standard',
      });
      expect(insertMock).toHaveBeenCalledTimes(1);
      expect(insertMock.mock.calls[0][0]).toMatchObject({
        status: 'error',
        error_message: 'Internal error',
        error_http_status: 500,
        model: 'gpt-4o',
      });
      expect(emitMock).toHaveBeenCalledWith('user-1');
    });

    it('stores the HTTP status code for 400 errors', async () => {
      await recorder.recordProviderError(ctx, 400, 'Bad request');
      expect(insertMock.mock.calls[0][0]).toMatchObject({
        status: 'error',
        error_http_status: 400,
      });
    });

    it('records rate_limited status for 429 and emits SSE event', async () => {
      await recorder.recordProviderError(ctx, 429, 'Rate limited');
      expect(insertMock).toHaveBeenCalledTimes(1);
      expect(insertMock.mock.calls[0][0].status).toBe('rate_limited');
      expect(emitMock).toHaveBeenCalledWith('user-1');
    });

    it('skips insert during cooldown but does not emit', async () => {
      await recorder.recordProviderError(ctx, 429, 'Rate limited');
      insertMock.mockClear();
      emitMock.mockClear();
      await recorder.recordProviderError(ctx, 429, 'Rate limited again');
      expect(insertMock).not.toHaveBeenCalled();
      expect(emitMock).not.toHaveBeenCalled();
    });

    it('persists the provider column when passed via opts', async () => {
      await recorder.recordProviderError(ctx, 500, 'Upstream error', {
        model: 'gemma4:31b',
        provider: 'ollama-cloud',
        tier: 'standard',
      });
      expect(insertMock.mock.calls[0][0].provider).toBe('ollama-cloud');
    });

    it('persists provider=null when opts omit the provider', async () => {
      await recorder.recordProviderError(ctx, 500, 'Upstream error', {
        model: 'gpt-4o',
      });
      expect(insertMock.mock.calls[0][0].provider).toBeNull();
    });

    it('scrubs provider secrets from the persisted error_message', async () => {
      const leaky = JSON.stringify({
        error: { message: 'Invalid x-api-key: sk-ant-api03-SECRETKEYVALUE12345' },
      });
      await recorder.recordProviderError(ctx, 401, leaky, { model: 'claude-3' });
      const stored: string = insertMock.mock.calls[0][0].error_message;
      expect(stored).not.toContain('SECRETKEYVALUE12345');
      expect(stored).toContain('[REDACTED]');
    });

    it('persists routing_reason when passed via opts', async () => {
      await recorder.recordProviderError(ctx, 500, 'oops', {
        model: 'gpt-4o',
        reason: 'header-match',
      });
      expect(insertMock.mock.calls[0][0].routing_reason).toBe('header-match');
    });

    it('writes null routing_reason when reason is omitted', async () => {
      await recorder.recordProviderError(ctx, 500, 'oops', { model: 'gpt-4o' });
      expect(insertMock.mock.calls[0][0].routing_reason).toBeNull();
    });
  });

  describe('recordFailedFallbacks', () => {
    it('records all failures and emits SSE event once', async () => {
      const failures = [
        { model: 'gpt-4o', provider: 'openai', status: 500, errorBody: 'fail-1', fallbackIndex: 0 },
        {
          model: 'claude-3',
          provider: 'anthropic',
          status: 500,
          errorBody: 'fail-2',
          fallbackIndex: 1,
        },
      ];
      await recorder.recordFailedFallbacks(ctx, 'standard', 'primary-model', failures);
      expect(insertMock).toHaveBeenCalledTimes(2);
      expect(emitMock).toHaveBeenCalledTimes(1);
      expect(emitMock).toHaveBeenCalledWith('user-1');
    });

    it('stores the HTTP status code for each fallback failure', async () => {
      const failures = [
        {
          model: 'gpt-4o',
          provider: 'openai',
          status: 400,
          errorBody: 'bad request',
          fallbackIndex: 0,
        },
        {
          model: 'claude-3',
          provider: 'anthropic',
          status: 503,
          errorBody: 'unavailable',
          fallbackIndex: 1,
        },
      ];
      await recorder.recordFailedFallbacks(ctx, 'standard', 'primary-model', failures);
      expect(insertMock.mock.calls[0][0].error_http_status).toBe(400);
      expect(insertMock.mock.calls[1][0].error_http_status).toBe(503);
    });

    it('persists the provider column for each fallback failure', async () => {
      const failures = [
        {
          model: 'gpt-4o',
          provider: 'openai',
          status: 500,
          errorBody: 'fail-1',
          fallbackIndex: 0,
        },
        {
          model: 'claude-3',
          provider: 'ollama-cloud',
          status: 500,
          errorBody: 'fail-2',
          fallbackIndex: 1,
        },
      ];
      await recorder.recordFailedFallbacks(ctx, 'standard', 'primary-model', failures);
      expect(insertMock.mock.calls[0][0].provider).toBe('openai');
      expect(insertMock.mock.calls[1][0].provider).toBe('ollama-cloud');
    });

    it('persists provider=null when the failure has no provider (line 164 falsy branch)', async () => {
      const failures = [
        {
          model: 'gpt-4o',
          provider: undefined as unknown as string,
          status: 500,
          errorBody: 'fail',
          fallbackIndex: 0,
        },
      ];
      await recorder.recordFailedFallbacks(ctx, 'standard', 'primary-model', failures);
      expect(insertMock.mock.calls[0][0].provider).toBeNull();
    });

    it('marks rate_limited status when the failure status is 429 (line 150 branch)', async () => {
      const failures = [
        {
          model: 'gpt-4o',
          provider: 'openai',
          status: 429,
          errorBody: 'rate limited',
          fallbackIndex: 0,
        },
      ];
      // markHandled=false is the default → the !useHandledStatus branch runs,
      // so `f.status === 429 ? 'rate_limited' : 'error'` is exercised.
      await recorder.recordFailedFallbacks(ctx, 'standard', 'primary-model', failures);
      expect(insertMock.mock.calls[0][0].status).toBe('rate_limited');
    });

    it('marks fallback_error status when markHandled=true and lastAsError=false', async () => {
      const failures = [
        {
          model: 'gpt-4o',
          provider: 'openai',
          status: 429,
          errorBody: 'rate limited',
          fallbackIndex: 0,
        },
      ];
      await recorder.recordFailedFallbacks(ctx, 'standard', 'primary-model', failures, {
        markHandled: true,
      });
      expect(insertMock.mock.calls[0][0].status).toBe('fallback_error');
    });

    it('marks the LAST failure as error when lastAsError=true and markHandled=true', async () => {
      const failures = [
        {
          model: 'gpt-4o',
          provider: 'openai',
          status: 500,
          errorBody: 'fail-1',
          fallbackIndex: 0,
        },
        {
          model: 'claude-3',
          provider: 'anthropic',
          status: 429,
          errorBody: 'fail-2',
          fallbackIndex: 1,
        },
      ];
      await recorder.recordFailedFallbacks(ctx, 'standard', 'primary-model', failures, {
        markHandled: true,
        lastAsError: true,
      });
      // First failure uses fallback_error (handled), last is the real error.
      expect(insertMock.mock.calls[0][0].status).toBe('fallback_error');
      // Last failure with status 429 → rate_limited.
      expect(insertMock.mock.calls[1][0].status).toBe('rate_limited');
    });

    it('uses baseTimeMs to stagger timestamps when provided', async () => {
      const failures = [
        {
          model: 'gpt-4o',
          provider: 'openai',
          status: 500,
          errorBody: 'fail',
          fallbackIndex: 0,
        },
      ];
      await recorder.recordFailedFallbacks(ctx, 'standard', 'primary-model', failures, {
        baseTimeMs: Date.parse('2025-01-01T00:00:00.000Z'),
      });
      // baseTimeMs + (1 - 0) * 100 = 100ms past the base.
      expect(insertMock.mock.calls[0][0].timestamp).toBe('2025-01-01T00:00:00.100Z');
    });

    it('scrubs provider secrets from each persisted fallback error_message', async () => {
      const failures = [
        {
          model: 'gpt-4o',
          provider: 'openai',
          status: 401,
          errorBody: 'Authorization: Bearer sk-proj-LEAKEDKEY1234567890',
          fallbackIndex: 0,
        },
        {
          model: 'claude-3',
          provider: 'anthropic',
          status: 401,
          errorBody: 'x-api-key: sk-ant-api03-LEAKEDKEY0987654321',
          fallbackIndex: 1,
        },
      ];
      await recorder.recordFailedFallbacks(ctx, 'standard', 'primary-model', failures);
      const first: string = insertMock.mock.calls[0][0].error_message;
      const second: string = insertMock.mock.calls[1][0].error_message;
      expect(first).not.toContain('LEAKEDKEY1234567890');
      expect(first).toContain('[REDACTED]');
      expect(second).not.toContain('LEAKEDKEY0987654321');
      expect(second).toContain('[REDACTED]');
    });

    it('persists routing_reason on every failed-fallback row when passed via opts', async () => {
      const failures = [
        { model: 'm1', provider: 'openai', status: 500, errorBody: 'oops', fallbackIndex: 0 },
        { model: 'm2', provider: 'openai', status: 502, errorBody: 'oops', fallbackIndex: 1 },
      ];
      await recorder.recordFailedFallbacks(ctx, 'standard', 'primary-model', failures, {
        reason: 'header-match',
      });
      expect(insertMock.mock.calls[0][0].routing_reason).toBe('header-match');
      expect(insertMock.mock.calls[1][0].routing_reason).toBe('header-match');
    });
  });

  describe('recordPrimaryFailure', () => {
    it('records failure and emits SSE event', async () => {
      await recorder.recordPrimaryFailure(
        ctx,
        'standard',
        'gpt-4o',
        'upstream error',
        '2025-01-01T00:00:00.000Z',
      );
      expect(insertMock).toHaveBeenCalledTimes(1);
      expect(insertMock.mock.calls[0][0]).toMatchObject({
        status: 'fallback_error',
        model: 'gpt-4o',
      });
      expect(emitMock).toHaveBeenCalledWith('user-1');
    });

    it('persists the provider column when passed a provider', async () => {
      await recorder.recordPrimaryFailure(
        ctx,
        'standard',
        'gemma4:31b',
        'upstream error',
        '2025-01-01T00:00:00.000Z',
        'api_key',
        { provider: 'ollama-cloud' },
      );
      expect(insertMock.mock.calls[0][0]).toMatchObject({
        provider: 'ollama-cloud',
        auth_type: 'api_key',
      });
    });

    it('stores provider=null when no provider argument is given', async () => {
      await recorder.recordPrimaryFailure(
        ctx,
        'standard',
        'gpt-4o',
        'upstream error',
        '2025-01-01T00:00:00.000Z',
      );
      expect(insertMock.mock.calls[0][0].provider).toBeNull();
    });

    it('persists routing_reason when passed via opts', async () => {
      await recorder.recordPrimaryFailure(
        ctx,
        'standard',
        'gpt-4o',
        'upstream error',
        '2025-01-01T00:00:00.000Z',
        undefined,
        { reason: 'header-match' },
      );
      expect(insertMock.mock.calls[0][0].routing_reason).toBe('header-match');
    });
  });

  describe('recordSuccessMessage', () => {
    let dedupWithLock: ProxyMessageDedup;

    beforeEach(() => {
      dedupWithLock = {
        normalizeSessionKey: jest.fn().mockReturnValue(undefined),
        getSuccessWriteLockKey: jest.fn().mockReturnValue('lock-key'),
        withSuccessWriteLock: jest
          .fn()
          .mockImplementation((_k: string, fn: () => Promise<void>) => fn()),
        withAgentMessageTransaction: jest
          .fn()
          .mockImplementation((_repo: unknown, _ctx: unknown, fn: (r: unknown) => Promise<void>) =>
            fn({ insert: insertMock, update: jest.fn() }),
          ),
        findExistingSuccessMessage: jest.fn().mockResolvedValue(null),
      } as unknown as ProxyMessageDedup;
      const repo = { insert: insertMock } as never;
      const pricingCache = { getByModel: getByModelMock } as unknown as ModelPricingCacheService;
      const eventBus = { emit: emitMock } as unknown as IngestEventBusService;
      recorder.onModuleDestroy();
      recorder = new ProxyMessageRecorder(repo, pricingCache, dedupWithLock, eventBus);
    });

    afterEach(() => {
      recorder.onModuleDestroy();
    });

    it('records success message and emits SSE event', async () => {
      await recorder.recordSuccessMessage(ctx, 'gpt-4o', 'standard', 'scored', {
        prompt_tokens: 100,
        completion_tokens: 50,
      });
      expect(insertMock).toHaveBeenCalledTimes(1);
      expect(emitMock).toHaveBeenCalledWith('user-1');
    });

    it('records message even when tokens are zero', async () => {
      await recorder.recordSuccessMessage(ctx, 'gpt-4o', 'standard', 'scored', {
        prompt_tokens: 0,
        completion_tokens: 0,
      });
      expect(insertMock).toHaveBeenCalledTimes(1);
      expect(insertMock.mock.calls[0][0]).toMatchObject({
        input_tokens: 0,
        output_tokens: 0,
        status: 'ok',
      });
      expect(emitMock).toHaveBeenCalledWith('user-1');
    });

    it('updates existing zero-token message and emits SSE event', async () => {
      const updateMock = jest.fn();
      (dedupWithLock.withAgentMessageTransaction as jest.Mock).mockImplementation(
        (_repo: unknown, _ctx: unknown, fn: (r: unknown) => Promise<void>) =>
          fn({ insert: insertMock, update: updateMock }),
      );
      (dedupWithLock.findExistingSuccessMessage as jest.Mock).mockResolvedValue({
        id: 'existing-msg-1',
        timestamp: new Date().toISOString(),
        input_tokens: 0,
        output_tokens: 0,
        cache_read_tokens: 0,
        cache_creation_tokens: 0,
        duration_ms: null,
      });

      await recorder.recordSuccessMessage(ctx, 'gpt-4o', 'standard', 'scored', {
        prompt_tokens: 100,
        completion_tokens: 50,
      });

      expect(updateMock).toHaveBeenCalledTimes(1);
      expect(updateMock.mock.calls[0][0]).toEqual({ id: 'existing-msg-1' });
      expect(updateMock.mock.calls[0][1]).toMatchObject({
        model: 'gpt-4o',
        routing_tier: 'standard',
        routing_reason: 'scored',
        input_tokens: 100,
        output_tokens: 50,
        cache_read_tokens: 0,
        cache_creation_tokens: 0,
        user_id: 'user-1',
      });
      expect(insertMock).not.toHaveBeenCalled();
      expect(emitMock).toHaveBeenCalledWith('user-1');
    });

    it('skips update when existing message already has recorded tokens', async () => {
      const updateMock = jest.fn();
      (dedupWithLock.withAgentMessageTransaction as jest.Mock).mockImplementation(
        (_repo: unknown, _ctx: unknown, fn: (r: unknown) => Promise<void>) =>
          fn({ insert: insertMock, update: updateMock }),
      );
      (dedupWithLock.findExistingSuccessMessage as jest.Mock).mockResolvedValue({
        id: 'existing-msg-2',
        timestamp: new Date().toISOString(),
        input_tokens: 200,
        output_tokens: 100,
        cache_read_tokens: 0,
        cache_creation_tokens: 0,
        duration_ms: 500,
      });

      await recorder.recordSuccessMessage(ctx, 'gpt-4o', 'standard', 'scored', {
        prompt_tokens: 100,
        completion_tokens: 50,
      });

      expect(updateMock).not.toHaveBeenCalled();
      expect(insertMock).not.toHaveBeenCalled();
      expect(emitMock).not.toHaveBeenCalled();
    });

    it('includes session_key in update payload when normalizeSessionKey returns a value', async () => {
      const updateMock = jest.fn();
      (dedupWithLock.normalizeSessionKey as jest.Mock).mockReturnValue('session-abc');
      (dedupWithLock.withAgentMessageTransaction as jest.Mock).mockImplementation(
        (_repo: unknown, _ctx: unknown, fn: (r: unknown) => Promise<void>) =>
          fn({ insert: insertMock, update: updateMock }),
      );
      (dedupWithLock.findExistingSuccessMessage as jest.Mock).mockResolvedValue({
        id: 'existing-msg-3',
        timestamp: new Date().toISOString(),
        input_tokens: 0,
        output_tokens: 0,
        cache_read_tokens: 0,
        cache_creation_tokens: 0,
        duration_ms: null,
      });

      await recorder.recordSuccessMessage(
        ctx,
        'gpt-4o',
        'standard',
        'scored',
        { prompt_tokens: 50, completion_tokens: 25 },
        { sessionKey: 'session-abc' },
      );

      expect(updateMock).toHaveBeenCalledTimes(1);
      expect(updateMock.mock.calls[0][1]).toMatchObject({
        session_key: 'session-abc',
      });
      expect(emitMock).toHaveBeenCalledWith('user-1');
    });

    it('skips update when existing has only output_tokens > 0 (covers short-circuit OR branch)', async () => {
      const updateMock = jest.fn();
      (dedupWithLock.withAgentMessageTransaction as jest.Mock).mockImplementation(
        (_repo: unknown, _ctx: unknown, fn: (r: unknown) => Promise<void>) =>
          fn({ insert: insertMock, update: updateMock }),
      );
      // input_tokens is 0, output_tokens > 0 — the second clause of the
      // (existing.input_tokens ?? 0) > 0 || (existing.output_tokens ?? 0) > 0
      // guard must short-circuit the write.
      (dedupWithLock.findExistingSuccessMessage as jest.Mock).mockResolvedValue({
        id: 'existing-msg-output-only',
        timestamp: new Date().toISOString(),
        input_tokens: 0,
        output_tokens: 42,
        cache_read_tokens: 0,
        cache_creation_tokens: 0,
        duration_ms: 100,
      });

      await recorder.recordSuccessMessage(ctx, 'gpt-4o', 'standard', 'scored', {
        prompt_tokens: 100,
        completion_tokens: 50,
      });

      expect(updateMock).not.toHaveBeenCalled();
      expect(insertMock).not.toHaveBeenCalled();
      expect(emitMock).not.toHaveBeenCalled();
    });

    it('handles existing rows whose token counts are null', async () => {
      const updateMock = jest.fn();
      (dedupWithLock.withAgentMessageTransaction as jest.Mock).mockImplementation(
        (_repo: unknown, _ctx: unknown, fn: (r: unknown) => Promise<void>) =>
          fn({ insert: insertMock, update: updateMock }),
      );
      // Nullish coalescing: `(input_tokens ?? 0) > 0` and likewise for output.
      (dedupWithLock.findExistingSuccessMessage as jest.Mock).mockResolvedValue({
        id: 'existing-msg-null-tokens',
        timestamp: new Date().toISOString(),
        input_tokens: null,
        output_tokens: null,
        cache_read_tokens: 0,
        cache_creation_tokens: 0,
        duration_ms: null,
      });

      await recorder.recordSuccessMessage(ctx, 'gpt-4o', 'standard', 'scored', {
        prompt_tokens: 10,
        completion_tokens: 5,
      });

      expect(updateMock).toHaveBeenCalledTimes(1);
    });

    it('persists the provider column on insert path', async () => {
      await recorder.recordSuccessMessage(
        ctx,
        'gemma4:31b',
        'standard',
        'scored',
        { prompt_tokens: 100, completion_tokens: 50 },
        { provider: 'ollama-cloud' },
      );
      expect(insertMock).toHaveBeenCalledTimes(1);
      expect(insertMock.mock.calls[0][0].provider).toBe('ollama-cloud');
    });

    it('persists the provider column on update path', async () => {
      const updateMock = jest.fn();
      (dedupWithLock.withAgentMessageTransaction as jest.Mock).mockImplementation(
        (_repo: unknown, _ctx: unknown, fn: (r: unknown) => Promise<void>) =>
          fn({ insert: insertMock, update: updateMock }),
      );
      (dedupWithLock.findExistingSuccessMessage as jest.Mock).mockResolvedValue({
        id: 'existing-msg-prov',
        timestamp: new Date().toISOString(),
        input_tokens: 0,
        output_tokens: 0,
        cache_read_tokens: 0,
        cache_creation_tokens: 0,
        duration_ms: null,
      });

      await recorder.recordSuccessMessage(
        ctx,
        'gemma4:31b',
        'standard',
        'scored',
        { prompt_tokens: 50, completion_tokens: 25 },
        { provider: 'ollama-cloud' },
      );

      expect(updateMock).toHaveBeenCalledTimes(1);
      expect(updateMock.mock.calls[0][1]).toMatchObject({
        provider: 'ollama-cloud',
      });
    });

    it('includes durationMs in update payload when provided', async () => {
      const updateMock = jest.fn();
      (dedupWithLock.withAgentMessageTransaction as jest.Mock).mockImplementation(
        (_repo: unknown, _ctx: unknown, fn: (r: unknown) => Promise<void>) =>
          fn({ insert: insertMock, update: updateMock }),
      );
      (dedupWithLock.findExistingSuccessMessage as jest.Mock).mockResolvedValue({
        id: 'existing-msg-4',
        timestamp: new Date().toISOString(),
        input_tokens: 0,
        output_tokens: 0,
        cache_read_tokens: 0,
        cache_creation_tokens: 0,
        duration_ms: null,
      });

      await recorder.recordSuccessMessage(
        ctx,
        'gpt-4o',
        'standard',
        'scored',
        { prompt_tokens: 50, completion_tokens: 25 },
        { durationMs: 1500 },
      );

      expect(updateMock.mock.calls[0][1]).toMatchObject({
        duration_ms: 1500,
      });
    });
  });

  describe('request_headers persistence', () => {
    it('recordProviderError persists request_headers', async () => {
      await recorder.recordProviderError(ctx, 500, 'boom', {
        requestHeaders: { 'x-custom': 'yes' },
      });
      expect(insertMock.mock.calls[0][0].request_headers).toEqual({ 'x-custom': 'yes' });
    });

    it('recordProviderError defaults request_headers to null when opts omit them', async () => {
      await recorder.recordProviderError(ctx, 500, 'boom');
      expect(insertMock.mock.calls[0][0].request_headers).toBeNull();
    });

    it('recordFailedFallbacks persists request_headers on each row', async () => {
      const failures = [
        { model: 'gpt-4o', provider: 'openai', status: 500, errorBody: 'fail', fallbackIndex: 0 },
        {
          model: 'claude-3',
          provider: 'anthropic',
          status: 500,
          errorBody: 'fail',
          fallbackIndex: 1,
        },
      ];
      await recorder.recordFailedFallbacks(ctx, 'standard', 'primary', failures, {
        requestHeaders: { 'x-a': '1' },
      });
      expect(insertMock.mock.calls[0][0].request_headers).toEqual({ 'x-a': '1' });
      expect(insertMock.mock.calls[1][0].request_headers).toEqual({ 'x-a': '1' });
    });

    it('recordPrimaryFailure persists request_headers', async () => {
      await recorder.recordPrimaryFailure(
        ctx,
        'standard',
        'gpt-4o',
        'boom',
        '2025-01-01T00:00:00.000Z',
        'api_key',
        { requestHeaders: { 'x-b': '2' } },
      );
      expect(insertMock.mock.calls[0][0].request_headers).toEqual({ 'x-b': '2' });
    });

    it('recordFallbackSuccess persists request_headers', async () => {
      await recorder.recordFallbackSuccess(ctx, 'gpt-4o', 'standard', {
        usage: { prompt_tokens: 1, completion_tokens: 1 },
        requestHeaders: { 'x-c': '3' },
      });
      expect(insertMock.mock.calls[0][0].request_headers).toEqual({ 'x-c': '3' });
    });

    it('recordSuccessMessage persists request_headers on insert and update paths', async () => {
      const dedupWithLock = {
        normalizeSessionKey: jest.fn().mockReturnValue(undefined),
        getSuccessWriteLockKey: jest.fn().mockReturnValue('lock-key'),
        withSuccessWriteLock: jest
          .fn()
          .mockImplementation((_k: string, fn: () => Promise<void>) => fn()),
        withAgentMessageTransaction: jest
          .fn()
          .mockImplementation((_repo: unknown, _ctx: unknown, fn: (r: unknown) => Promise<void>) =>
            fn({ insert: insertMock, update: updateMock }),
          ),
        findExistingSuccessMessage: jest.fn().mockResolvedValue(null),
      } as unknown as ProxyMessageDedup;
      const updateMock = jest.fn();
      const repo = { insert: insertMock } as never;
      const pricingCache = { getByModel: getByModelMock } as unknown as ModelPricingCacheService;
      const eventBus = { emit: emitMock } as unknown as IngestEventBusService;
      recorder.onModuleDestroy();
      recorder = new ProxyMessageRecorder(repo, pricingCache, dedupWithLock, eventBus);

      // Insert path
      await recorder.recordSuccessMessage(
        ctx,
        'gpt-4o',
        'standard',
        'scored',
        { prompt_tokens: 1, completion_tokens: 1 },
        { requestHeaders: { 'x-d': '4' } },
      );
      expect(insertMock.mock.calls.at(-1)![0].request_headers).toEqual({ 'x-d': '4' });

      // Update path — flip findExistingSuccessMessage to return a zero-token row.
      (dedupWithLock.findExistingSuccessMessage as jest.Mock).mockResolvedValue({
        id: 'existing-msg-hdr',
        timestamp: new Date().toISOString(),
        input_tokens: 0,
        output_tokens: 0,
        cache_read_tokens: 0,
        cache_creation_tokens: 0,
        duration_ms: null,
      });
      await recorder.recordSuccessMessage(
        ctx,
        'gpt-4o',
        'standard',
        'scored',
        { prompt_tokens: 5, completion_tokens: 5 },
        { requestHeaders: { 'x-e': '5' } },
      );
      expect(updateMock.mock.calls[0][1].request_headers).toEqual({ 'x-e': '5' });
    });
  });

  describe('cooldown overflow eviction', () => {
    it('evicts expired entries when cooldown map exceeds MAX_COOLDOWN_ENTRIES', async () => {
      // Fill the cooldown map to capacity by recording 429 errors for unique agents
      const maxEntries = 1_000;
      for (let i = 0; i < maxEntries; i++) {
        const agentCtx: IngestionContext = {
          tenantId: `t-${i}`,
          agentId: `a-${i}`,
          agentName: 'test',
          userId: 'user-1',
        };
        await recorder.recordProviderError(agentCtx, 429, 'rate limited');
      }
      expect(insertMock).toHaveBeenCalledTimes(maxEntries);
      insertMock.mockClear();

      // Force all existing entries to be expired by advancing time
      const realDateNow = Date.now;
      Date.now = jest.fn().mockReturnValue(realDateNow() + 120_000);

      try {
        // This 429 for a new agent pushes size above MAX_COOLDOWN_ENTRIES,
        // triggering the overflow eviction branch
        const overflowCtx: IngestionContext = {
          tenantId: 't-overflow',
          agentId: 'a-overflow',
          agentName: 'test',
          userId: 'user-1',
        };
        await recorder.recordProviderError(overflowCtx, 429, 'rate limited');
        expect(insertMock).toHaveBeenCalledTimes(1);
      } finally {
        Date.now = realDateNow;
      }
    });
  });

  describe('evictExpiredCooldowns', () => {
    it('removes expired entries from the cooldown map', async () => {
      // Record a 429 to add an entry to the cooldown map
      await recorder.recordProviderError(ctx, 429, 'rate limited');
      insertMock.mockClear();
      emitMock.mockClear();

      // Advance time past the cooldown window and invoke the private method
      const realDateNow = Date.now;
      Date.now = jest.fn().mockReturnValue(realDateNow() + 120_000);

      try {
        (recorder as unknown as { evictExpiredCooldowns: () => void }).evictExpiredCooldowns();

        // The cooldown entry should have been evicted, so a new 429 should insert
        await recorder.recordProviderError(ctx, 429, 'rate limited again');
        expect(insertMock).toHaveBeenCalledTimes(1);
      } finally {
        Date.now = realDateNow;
      }
    });

    it('keeps non-expired entries in the cooldown map', async () => {
      await recorder.recordProviderError(ctx, 429, 'rate limited');
      insertMock.mockClear();
      emitMock.mockClear();

      // Advance time but stay within the cooldown window
      const realDateNow = Date.now;
      Date.now = jest.fn().mockReturnValue(realDateNow() + 30_000);

      try {
        (recorder as unknown as { evictExpiredCooldowns: () => void }).evictExpiredCooldowns();

        // The cooldown entry should still be present, so a new 429 should be skipped
        await recorder.recordProviderError(ctx, 429, 'rate limited again');
        expect(insertMock).not.toHaveBeenCalled();
        expect(emitMock).not.toHaveBeenCalled();
      } finally {
        Date.now = realDateNow;
      }
    });
  });
});
