import { ProxyMessageRecorder } from '../proxy-message-recorder';
import { ProxyMessageDedup } from '../proxy-message-dedup';
import { ModelPricingCacheService } from '../../../model-prices/model-pricing-cache.service';
import { IngestEventBusService } from '../../../common/services/ingest-event-bus.service';
import { IngestionContext } from '../../../otlp/interfaces/ingestion-context.interface';
import type { AutofixRecord } from '../../autofix/autofix.types';
import type { ProviderAttemptRef } from '../proxy-types';

const sampleAutofix: AutofixRecord = {
  groupId: 'grp-1',
  outcome: 'healed',
  original_http_status: 400,
  chain: [
    {
      attempt: 0,
      origin: 'original',
      request: { max_tokens: 5 },
      http_status: 400,
      error: {
        message: 'Unknown parameter',
        type: 'invalid_request_error',
        param: 'max_tokens',
        code: 'unknown_parameter',
      },
      operations: [{ type: 'rename_param', from: 'max_tokens', to: 'max_output_tokens' }],
      heal_attempt_id: 'heal-1',
      patch_worked: true,
    },
    { attempt: 1, origin: 'autofix', request: { max_output_tokens: 5 }, http_status: 200 },
  ],
};

const ctx: IngestionContext = {
  tenantId: 'tenant-1',
  agentId: 'agent-1',
  agentName: 'test-agent',
  userId: 'user-1',
};

describe('ProxyMessageRecorder', () => {
  let recorder: ProxyMessageRecorder;
  let insertMock: jest.Mock;
  let updateMock: jest.Mock;
  let getByModelMock: jest.Mock;
  let emitMock: jest.Mock;

  beforeEach(() => {
    insertMock = jest.fn();
    updateMock = jest.fn();
    getByModelMock = jest.fn().mockReturnValue(undefined);
    emitMock = jest.fn();
    const repo = {
      insert: insertMock,
      update: updateMock,
      manager: { getRepository: jest.fn(() => ({})) },
    } as never;
    const pricingCache = {
      getByModel: getByModelMock,
    } as unknown as ModelPricingCacheService;
    const dedup = {
      normalizeSessionKey: jest.fn((sessionKey: string | undefined) => sessionKey),
    } as unknown as ProxyMessageDedup;
    const eventBus = { emit: emitMock } as unknown as IngestEventBusService;
    const customProviders = {
      canonicalizeAgentMessageKeys: jest
        .fn()
        .mockImplementation(
          async (_agentId: string, provider: string | null, model: string | null) => ({
            provider: provider ?? null,
            model: model ?? null,
          }),
        ),
    } as never;
    const opencodeGoCatalog = {
      getCostPerRequest: jest.fn().mockReturnValue(null),
      resolveCostPerRequest: jest.fn().mockResolvedValue(null),
    } as never;
    recorder = new ProxyMessageRecorder(
      repo,
      pricingCache,
      dedup,
      eventBus,
      customProviders,
      opencodeGoCatalog,
    );
  });

  afterEach(() => {
    recorder.onModuleDestroy();
  });

  describe('pending Attempt lifecycle', () => {
    it('inserts pending connection metadata and completes the same row', async () => {
      const attempt: ProviderAttemptRef = {
        id: 'attempt-pending',
        attemptNumber: 2,
        startedAtMs: 1_000,
        startedAt: '1970-01-01T00:00:01.000Z',
        completedAtMs: 1_125,
        pendingWrite: Promise.resolve(true),
      };

      await expect(
        recorder.recordPendingProviderAttempt(ctx, 'request-1', attempt, {
          provider: 'openai',
          model: 'gpt-4o',
          authType: 'api_key',
          tenantProviderId: 'connection-1',
        }),
      ).resolves.toBe(true);
      await recorder.completePendingProviderFailure(attempt, 429, 'rate limited', true);

      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'attempt-pending',
          request_id: 'request-1',
          attempt_number: 2,
          status: 'pending',
          auth_type: 'api_key',
          tenant_provider_id: 'connection-1',
        }),
      );
      expect(updateMock).toHaveBeenCalledWith(
        { id: 'attempt-pending' },
        expect.objectContaining({ status: 'failed', duration_ms: 125, superseded: true }),
      );
    });

    it('does not complete an attempt whose pending insert failed', async () => {
      const attempt: ProviderAttemptRef = {
        id: 'attempt-missing',
        attemptNumber: 1,
        startedAtMs: 1_000,
        startedAt: '1970-01-01T00:00:01.000Z',
        pendingWrite: Promise.reject(new Error('insert failed')),
      };

      await recorder.completePendingProviderFailure(attempt, 500, 'failed', false);

      expect(updateMock).not.toHaveBeenCalled();
    });

    it('updates the same pending row with terminal status and measured duration', async () => {
      const attempt: ProviderAttemptRef = {
        id: 'attempt-1',
        attemptNumber: 1,
        startedAtMs: 1_000,
        startedAt: '1970-01-01T00:00:01.000Z',
        completedAtMs: 1_125,
        pendingWrite: Promise.resolve(true),
      };

      await recorder.recordProviderError(ctx, 500, 'upstream failed', {
        requestId: 'request-1',
        attempt,
        model: 'gpt-4o',
        provider: 'openai',
      });

      expect(insertMock).not.toHaveBeenCalled();
      expect(updateMock).toHaveBeenCalledWith(
        { id: 'attempt-1' },
        expect.objectContaining({
          request_id: 'request-1',
          attempt_number: 1,
          timestamp: '1970-01-01T00:00:01.000Z',
          duration_ms: 125,
          status: 'failed',
        }),
      );
    });

    it('finishes a successful request by updating its pending attempt', async () => {
      const attempt: ProviderAttemptRef = {
        id: 'attempt-success',
        attemptNumber: 1,
        startedAtMs: 1_000,
        startedAt: '1970-01-01T00:00:01.000Z',
        completedAtMs: 1_050,
        pendingWrite: Promise.resolve(true),
      };

      await recorder.recordSuccessMessage(
        ctx,
        'gpt-4o',
        'standard',
        'scored',
        { prompt_tokens: 2, completion_tokens: 1 },
        { requestId: 'request-success', provider: 'openai', attempt },
      );

      expect(updateMock).toHaveBeenCalledWith(
        { id: 'attempt-success' },
        expect.objectContaining({ status: 'success', duration_ms: 50 }),
      );
      expect(emitMock).toHaveBeenCalledWith('tenant-1', 'message', 'user-1');
    });
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
        status: 'success',
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
        status: 'success',
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

    it('inserts a fallback success with correct metadata', async () => {
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
        status: 'success',
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

    it('computes cost_usd with cache-read pricing when usage has cached tokens', async () => {
      getByModelMock.mockReturnValue({
        model_name: 'deepseek-v4-pro',
        provider: 'DeepSeek',
        input_price_per_token: 0.435 / 1_000_000,
        output_price_per_token: 0.87 / 1_000_000,
        cache_read_price_per_token: 0.003625 / 1_000_000,
        display_name: 'DeepSeek V4 Pro',
      });

      await recorder.recordFallbackSuccess(ctx, 'deepseek-v4-pro', 'standard', {
        authType: 'api_key',
        usage: {
          prompt_tokens: 36_100,
          completion_tokens: 1_200,
          cache_read_tokens: 21_600,
        },
      });

      const inserted = insertMock.mock.calls[0][0];
      expect(inserted.cache_read_tokens).toBe(21_600);
      expect(inserted.cost_usd).toBeCloseTo(0.0074298, 10);
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

    it('uses provider-reported cost for subscription fallback success', async () => {
      await recorder.recordFallbackSuccess(ctx, 'stepfun/step-3.7-flash:free', 'default', {
        provider: 'nous',
        authType: 'subscription',
        usage: {
          prompt_tokens: 16,
          completion_tokens: 1,
          reported_cost_usd: 0.00005,
        },
      });

      const inserted = insertMock.mock.calls[0][0];
      expect(inserted).toMatchObject({
        provider: 'nous',
        auth_type: 'subscription',
        input_tokens: 16,
        output_tokens: 1,
        cost_usd: 0.00005,
      });
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
      expect(emitMock).toHaveBeenCalledWith('tenant-1', 'message', 'user-1');
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
        status: 'failed',
        error_message: 'Internal error',
        error_http_status: 500,
        model: 'gpt-4o',
      });
      expect(emitMock).toHaveBeenCalledWith('tenant-1', 'message', 'user-1');
    });

    it('stores the HTTP status code for 400 errors', async () => {
      await recorder.recordProviderError(ctx, 400, 'Bad request');
      expect(insertMock.mock.calls[0][0]).toMatchObject({
        status: 'failed',
        error_http_status: 400,
      });
    });

    it('records rate_limited status for 429 and emits SSE event', async () => {
      await recorder.recordProviderError(ctx, 429, 'Rate limited');
      expect(insertMock).toHaveBeenCalledTimes(1);
      expect(insertMock.mock.calls[0][0].status).toBe('failed');
      expect(insertMock.mock.calls[0][0].error_class).toBe('rate_limit');
      expect(emitMock).toHaveBeenCalledWith('tenant-1', 'message', 'user-1');
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

    describe('error classification axes', () => {
      it.each([
        [500, 'provider', 'server_error'],
        [402, 'provider', 'billing'],
        [401, 'provider', 'auth'],
        [404, 'provider', 'not_found'],
        [400, 'provider', 'invalid_request'],
        [429, 'provider', 'rate_limit'],
        [503, 'transport', 'network'],
        [504, 'transport', 'timeout'],
      ])('classifies HTTP %s as %s/%s (never superseded)', async (http, origin, klass) => {
        await recorder.recordProviderError(ctx, http as number, 'boom', { model: 'gpt-4o' });
        expect(insertMock.mock.calls[0][0]).toMatchObject({
          error_origin: origin,
          error_class: klass,
          superseded: false,
        });
      });
    });
  });

  describe('recordManifestBlockedRequest', () => {
    it('persists the error code and the rendered message a user can act on', async () => {
      await recorder.recordManifestBlockedRequest(ctx, {
        errorMessage:
          '[🦚 Manifest M100] No anthropic API key yet. Add one here: https://x/routing',
        errorCode: 'M100',
        reason: 'no_provider_key',
        model: 'auto',
      });

      expect(insertMock.mock.calls[0][0]).toMatchObject({
        status: 'failed',
        error_code: 'M100',
        error_message:
          '[🦚 Manifest M100] No anthropic API key yet. Add one here: https://x/routing',
        error_origin: 'config',
        error_class: 'no_provider_key',
        // No provider was contacted and no tier chosen — the row must not claim
        // otherwise (this used to say provider='manifest', routing_tier='simple').
        provider: null,
        routing_tier: null,
        error_http_status: null,
      });
    });

    it('leaves error_code null when a Manifest row carries no documented code', async () => {
      await recorder.recordManifestBlockedRequest(ctx, {
        errorMessage: 'something went sideways',
        reason: 'manifest_internal_error',
      });
      expect(insertMock.mock.calls[0][0].error_code).toBeNull();
    });

    it('records a malformed caller body on the request origin', async () => {
      await recorder.recordManifestBlockedRequest(ctx, {
        httpStatus: 400,
        errorMessage: '[🦚 Manifest M300] `messages` array is required.',
        errorCode: 'M300',
        reason: 'manifest_invalid_request',
      });

      expect(insertMock.mock.calls[0][0]).toMatchObject({
        status: 'failed',
        error_code: 'M300',
        error_http_status: 400,
        error_origin: 'request',
        error_class: 'invalid_request',
      });
    });

    it('records an expired key as a setup error against its agent', async () => {
      await recorder.recordManifestBlockedRequest(ctx, {
        httpStatus: 401,
        errorMessage: '[🦚 Manifest M004] This key has expired.',
        errorCode: 'M004',
        reason: 'key_expired',
      });

      expect(insertMock.mock.calls[0][0]).toMatchObject({
        error_code: 'M004',
        error_origin: 'config',
        error_class: 'auth',
      });
    });

    it('keeps the three rate limits on separate cooldowns', async () => {
      await recorder.recordManifestBlockedRequest(ctx, {
        httpStatus: 429,
        errorMessage: 'per-user',
        reason: 'manifest_rate_limited',
      });
      await recorder.recordManifestBlockedRequest(ctx, {
        httpStatus: 429,
        errorMessage: 'per-ip',
        reason: 'manifest_ip_rate_limited',
      });
      await recorder.recordManifestBlockedRequest(ctx, {
        httpStatus: 429,
        errorMessage: 'concurrency',
        reason: 'manifest_concurrency_limited',
      });

      // Three distinct limits fired, so three rows. One shared cooldown would
      // have swallowed the second and third.
      expect(insertMock).toHaveBeenCalledTimes(3);
      expect(insertMock.mock.calls.map((c) => c[0].routing_reason)).toEqual([
        'manifest_rate_limited',
        'manifest_ip_rate_limited',
        'manifest_concurrency_limited',
      ]);
    });

    it('records plan-limit blocks as Manifest policy rows', async () => {
      await recorder.recordManifestBlockedRequest(ctx, {
        httpStatus: 402,
        errorMessage: 'Free plan request limit reached',
        reason: 'plan_request_limit_exceeded',
        model: 'auto',
        traceId: 'trace-1',
        sessionKey: 'session-1',
      });

      expect(insertMock).toHaveBeenCalledTimes(1);
      expect(insertMock.mock.calls[0][0]).toMatchObject({
        tenant_id: 'tenant-1',
        agent_id: 'agent-1',
        agent_name: 'test-agent',
        trace_id: 'trace-1',
        session_key: 'session-1',
        status: 'failed',
        error_message: 'Free plan request limit reached',
        error_http_status: 402,
        routing_reason: 'plan_request_limit_exceeded',
        error_origin: 'policy',
        error_class: 'plan_request_limit_exceeded',
        superseded: false,
        model: 'auto',
        provider: null,
      });
      expect(emitMock).toHaveBeenCalledWith('tenant-1', 'message', 'user-1');
    });

    it('records local proxy rate limits as Manifest policy rate-limit rows', async () => {
      await recorder.recordManifestBlockedRequest(ctx, {
        httpStatus: 429,
        errorMessage: 'Too many requests',
        reason: 'manifest_rate_limited',
      });

      expect(insertMock).toHaveBeenCalledTimes(1);
      expect(insertMock.mock.calls[0][0]).toMatchObject({
        status: 'failed',
        error_message: 'Too many requests',
        error_http_status: 429,
        routing_reason: 'manifest_rate_limited',
        error_origin: 'policy',
        error_class: 'rate_limit',
        superseded: false,
      });
    });

    it('records each rate-limited Manifest Request independently', async () => {
      await recorder.recordManifestBlockedRequest(ctx, {
        httpStatus: 429,
        errorMessage: 'Too many requests',
        reason: 'manifest_rate_limited',
      });
      insertMock.mockClear();
      emitMock.mockClear();

      await recorder.recordManifestBlockedRequest(ctx, {
        httpStatus: 429,
        errorMessage: 'Too many requests again',
        reason: 'manifest_rate_limited',
      });

      expect(insertMock).toHaveBeenCalledTimes(1);
      expect(emitMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('recordFailedFallbacks', () => {
    it('updates the measured pending rows when fallback attempts are available', async () => {
      const attempts: ProviderAttemptRef[] = [0, 1].map((index) => ({
        id: `fallback-attempt-${index + 1}`,
        attemptNumber: index + 2,
        startedAtMs: 1_000 + index * 100,
        startedAt: new Date(1_000 + index * 100).toISOString(),
        completedAtMs: 1_050 + index * 100,
        pendingWrite: Promise.resolve(true),
      }));
      const failures = attempts.map((attempt, index) => ({
        model: `fallback-${index + 1}`,
        provider: 'openai',
        status: 500,
        errorBody: 'failed',
        fallbackIndex: index,
        attempt,
      }));

      await recorder.recordFailedFallbacks(ctx, 'standard', 'primary-model', failures, {
        requestId: 'request-fallbacks',
      });

      expect(insertMock).not.toHaveBeenCalled();
      expect(updateMock).toHaveBeenCalledTimes(2);
      expect(updateMock).toHaveBeenNthCalledWith(
        1,
        { id: 'fallback-attempt-1' },
        expect.objectContaining({ request_id: 'request-fallbacks', attempt_number: 2 }),
      );
      expect(updateMock).toHaveBeenNthCalledWith(
        2,
        { id: 'fallback-attempt-2' },
        expect.objectContaining({ request_id: 'request-fallbacks', attempt_number: 3 }),
      );
    });

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
      expect(insertMock).toHaveBeenCalledTimes(1);
      expect((insertMock.mock.calls[0][0] as unknown[]).length).toBe(2);
      expect(emitMock).toHaveBeenCalledTimes(1);
      expect(emitMock).toHaveBeenCalledWith('tenant-1', 'message', 'user-1');
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
      const rows = insertMock.mock.calls[0][0] as Array<{ error_http_status: number }>;
      expect(rows[0].error_http_status).toBe(400);
      expect(rows[1].error_http_status).toBe(503);
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
      const rows = insertMock.mock.calls[0][0] as Array<{ provider: string | null }>;
      expect(rows[0].provider).toBe('openai');
      expect(rows[1].provider).toBe('ollama-cloud');
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
      const rows = insertMock.mock.calls[0][0] as Array<{ provider: string | null }>;
      expect(rows[0].provider).toBeNull();
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
      const rows = insertMock.mock.calls[0][0] as Array<{ status: string; error_class: string }>;
      expect(rows[0].status).toBe('failed');
      expect(rows[0].error_class).toBe('rate_limit');
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
      const rows = insertMock.mock.calls[0][0] as Array<{ status: string; superseded: boolean }>;
      expect(rows[0].status).toBe('failed');
      expect(rows[0].superseded).toBe(true);
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
      const rows = insertMock.mock.calls[0][0] as Array<{
        status: string;
        superseded: boolean;
        error_class: string;
      }>;
      // First failure uses fallback_error (handled) → superseded.
      expect(rows[0].status).toBe('failed');
      expect(rows[0].superseded).toBe(true);
      // Last failure with status 429 → rate-limit error class.
      expect(rows[1].status).toBe('failed');
      expect(rows[1].error_class).toBe('rate_limit');
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
      const rows = insertMock.mock.calls[0][0] as Array<{ timestamp: string }>;
      // baseTimeMs + (1 - 0) * 100 = 100ms past the base.
      expect(rows[0].timestamp).toBe('2025-01-01T00:00:00.100Z');
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
      const rows = insertMock.mock.calls[0][0] as Array<{ error_message: string }>;
      const first: string = rows[0].error_message;
      const second: string = rows[1].error_message;
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
      const rows = insertMock.mock.calls[0][0] as Array<{ routing_reason: string }>;
      expect(rows[0].routing_reason).toBe('header-match');
      expect(rows[1].routing_reason).toBe('header-match');
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
        status: 'failed',
        model: 'gpt-4o',
        // A recovered primary is a superseded attempt, classified by its cause
        // (no HTTP status here ⇒ transport/network), not a terminal outcome.
        superseded: true,
        error_origin: 'transport',
        error_class: 'network',
      });
      expect(emitMock).toHaveBeenCalledWith('tenant-1', 'message', 'user-1');
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

    it('does not persist an HTML error page when no HTTP status was captured', async () => {
      await recorder.recordPrimaryFailure(
        ctx,
        'standard',
        'gpt-4o',
        '<html><body>Tunnel failed</body></html>',
        '2025-01-01T00:00:00.000Z',
      );

      expect(insertMock.mock.calls[0][0].error_message).toBe(
        'Upstream endpoint returned an HTML error page',
      );
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

    it('records the superseded patched retry when heal-then-fallback ran', async () => {
      await recorder.recordPrimaryFailure(
        ctx,
        'standard',
        'gpt-4o',
        'Unknown parameter',
        '2025-01-01T00:00:00.000Z',
        'api_key',
        { provider: 'openai', autofix: sampleAutofix, httpStatus: 400 },
      );
      const row = insertMock.mock.calls[0][0];
      expect(row.status).toBe('failed');
      expect(row.superseded).toBe(true);
      expect(row.autofix_applied).toBe(true);
      expect(row.autofix_group_id).toBe('grp-1');
      expect(row.autofix_role).toBe('retry');
      expect(row.error_http_status).toBe(400);
      expect(row.autofix_operations).toEqual([
        { type: 'rename_param', from: 'max_tokens', to: 'max_output_tokens' },
      ]);
    });

    it('leaves autofix columns unset on a plain primary failure (no autofix)', async () => {
      await recorder.recordPrimaryFailure(
        ctx,
        'standard',
        'gpt-4o',
        'upstream error',
        '2025-01-01T00:00:00.000Z',
      );
      const row = insertMock.mock.calls[0][0];
      expect(row.autofix_applied).toBeUndefined();
      expect(row.autofix_group_id).toBeUndefined();
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
      const passthroughCustomProviders = {
        canonicalizeAgentMessageKeys: jest
          .fn()
          .mockImplementation(
            async (_agentId: string, provider: string | null, model: string | null) => ({
              provider: provider ?? null,
              model: model ?? null,
            }),
          ),
      } as never;
      const opencodeGoCatalog = {
        getCostPerRequest: jest.fn().mockReturnValue(null),
        resolveCostPerRequest: jest.fn().mockResolvedValue(null),
      } as never;
      recorder = new ProxyMessageRecorder(
        repo,
        pricingCache,
        dedupWithLock,
        eventBus,
        passthroughCustomProviders,
        opencodeGoCatalog,
      );
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
      expect(emitMock).toHaveBeenCalledWith('tenant-1', 'message', 'user-1');
    });

    it('uses provider-reported cost for subscription success messages', async () => {
      await recorder.recordSuccessMessage(
        ctx,
        'stepfun/step-3.7-flash:free',
        'default',
        'default',
        {
          prompt_tokens: 16,
          completion_tokens: 1,
          reported_cost_usd: 0.00005,
        },
        { provider: 'nous', authType: 'subscription' },
      );

      expect(insertMock).toHaveBeenCalledTimes(1);
      expect(insertMock.mock.calls[0][0]).toMatchObject({
        provider: 'nous',
        auth_type: 'subscription',
        input_tokens: 16,
        output_tokens: 1,
        cost_usd: 0.00005,
      });
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
        status: 'success',
      });
      expect(emitMock).toHaveBeenCalledWith('tenant-1', 'message', 'user-1');
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
      expect(emitMock).toHaveBeenCalledWith('tenant-1', 'message', 'user-1');
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
      expect(emitMock).toHaveBeenCalledWith('tenant-1', 'message', 'user-1');
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

    it('keeps status=ok and no error axes for every reason — Manifest stubs never reach here', async () => {
      await recorder.recordSuccessMessage(ctx, 'gpt-4o', 'standard', 'scored', {
        prompt_tokens: 1,
        completion_tokens: 1,
      });
      expect(insertMock).toHaveBeenCalledTimes(1);
      expect(insertMock.mock.calls[0][0]).toMatchObject({
        status: 'success',
        error_message: null,
        routing_reason: 'scored',
        error_origin: null,
        error_class: null,
        superseded: false,
      });
    });

    // The canned-stub detour through recordSuccessMessage is gone: a Manifest
    // failure is written by recordManifestBlockedRequest, never by the success
    // path flipping its own status to 'error'. A reason like `no_provider` that
    // somehow arrives here is a routing reason, not a failure signal.
    it('does not resurrect the canned-response branch for a Manifest reason', async () => {
      await recorder.recordSuccessMessage(ctx, 'gpt-4o', 'simple', 'no_provider', {
        prompt_tokens: 0,
        completion_tokens: 0,
      });
      expect(insertMock.mock.calls[0][0]).toMatchObject({
        status: 'success',
        error_message: null,
        error_origin: null,
      });
    });

    it('normalizes success status on the dedup-update path', async () => {
      const updateMock = jest.fn();
      (dedupWithLock.withAgentMessageTransaction as jest.Mock).mockImplementation(
        (_repo: unknown, _ctx: unknown, fn: (r: unknown) => Promise<void>) =>
          fn({ insert: insertMock, update: updateMock }),
      );
      (dedupWithLock.findExistingSuccessMessage as jest.Mock).mockResolvedValue({
        id: 'existing-row',
        timestamp: new Date().toISOString(),
        input_tokens: 0,
        output_tokens: 0,
        cache_read_tokens: 0,
        cache_creation_tokens: 0,
        duration_ms: null,
      });

      await recorder.recordSuccessMessage(ctx, 'gpt-4o', 'simple', 'scored', {
        prompt_tokens: 3,
        completion_tokens: 4,
      });

      expect(updateMock).toHaveBeenCalledTimes(1);
      expect(updateMock.mock.calls[0][0]).toEqual({ id: 'existing-row' });
      expect(updateMock.mock.calls[0][1]).toMatchObject({
        status: 'success',
        error_message: null,
        error_origin: null,
        error_class: null,
        superseded: false,
      });
      expect(insertMock).not.toHaveBeenCalled();
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
      const rows = insertMock.mock.calls[0][0] as Array<{ request_headers: unknown }>;
      expect(rows[0].request_headers).toEqual({ 'x-a': '1' });
      expect(rows[1].request_headers).toEqual({ 'x-a': '1' });
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
      const passthroughCustomProviders = {
        canonicalizeAgentMessageKeys: jest
          .fn()
          .mockImplementation(
            async (_agentId: string, provider: string | null, model: string | null) => ({
              provider: provider ?? null,
              model: model ?? null,
            }),
          ),
      } as never;
      const opencodeGoCatalog = {
        getCostPerRequest: jest.fn().mockReturnValue(null),
        resolveCostPerRequest: jest.fn().mockResolvedValue(null),
      } as never;
      recorder = new ProxyMessageRecorder(
        repo,
        pricingCache,
        dedupWithLock,
        eventBus,
        passthroughCustomProviders,
        opencodeGoCatalog,
      );

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

  describe('autofix persistence', () => {
    const operations = [{ type: 'rename_param', from: 'max_tokens', to: 'max_output_tokens' }];
    const failedRetryAutofix: AutofixRecord = {
      ...sampleAutofix,
      outcome: 'exhausted',
      chain: [
        sampleAutofix.chain[0],
        {
          attempt: 1,
          origin: 'autofix',
          request: { max_output_tokens: 5 },
          http_status: 400,
          error: { message: 'Retry also failed' },
        },
      ],
    };

    it('recordProviderError records a failed patched request as the retry', async () => {
      await recorder.recordProviderError(ctx, 400, 'Retry also failed', {
        autofix: failedRetryAutofix,
      });
      const row = insertMock.mock.calls.at(-1)![0];
      expect(row.autofix_applied).toBe(true);
      expect(row.autofix_group_id).toBe('grp-1');
      expect(row.autofix_role).toBe('retry');
      expect(row.autofix_operations).toEqual(operations);
    });

    it('recordProviderError keeps a no-patch Phoenix audit without claiming Auto-fix', async () => {
      const noPatch: AutofixRecord = {
        groupId: 'grp-no-patch',
        outcome: 'unfixable',
        original_http_status: 400,
        chain: [
          {
            attempt: 0,
            origin: 'original',
            request: {},
            http_status: 400,
            error: { message: 'Unknown parameter' },
            phoenix_status: 'no_patch',
            issue_id: 'issue-no-patch',
            patch_id: null,
            heal_attempt_id: null,
          },
        ],
      };

      await recorder.recordProviderError(ctx, 400, 'Unknown parameter', { autofix: noPatch });

      const row = insertMock.mock.calls.at(-1)![0];
      expect(row.autofix_applied).toBeUndefined();
      expect(row.autofix_group_id).toBeUndefined();
      expect(row.autofix_role).toBeUndefined();
      expect(row.autofix_decision).toEqual({
        status: 'no_patch',
        issueId: 'issue-no-patch',
        patchId: null,
        healAttemptId: null,
        explanation: null,
      });
    });

    it('recordPrimaryFailure keeps a failed retry identity through fallback', async () => {
      await recorder.recordPrimaryFailure(
        ctx,
        'standard',
        'gpt-4o',
        'Retry also failed',
        '2026-07-15T12:00:00.000Z',
        'api_key',
        { autofix: failedRetryAutofix, httpStatus: 400 },
      );

      const row = insertMock.mock.calls.at(-1)![0];
      expect(row.status).toBe('failed');
      expect(row.superseded).toBe(true);
      expect(row.error_http_status).toBe(400);
      expect(row.autofix_applied).toBe(true);
      expect(row.autofix_role).toBe('retry');
      expect(row.autofix_group_id).toBe('grp-1');
    });

    it('recordProviderError leaves autofix columns unset when omitted', async () => {
      await recorder.recordProviderError(ctx, 400, 'boom');
      const row = insertMock.mock.calls.at(-1)![0];
      expect(row.autofix_applied).toBeUndefined();
      expect(row.autofix_group_id).toBeUndefined();
    });

    it('recordAutofixOriginal writes a linked auto_fixed original row', async () => {
      await recorder.recordAutofixOriginal(ctx, 'gpt-4o', 'default', sampleAutofix, {
        provider: 'openai',
        reason: 'default',
        authType: 'api_key',
        traceId: 'trace-af',
      });
      const row = insertMock.mock.calls.at(-1)![0] as Record<string, unknown>;
      expect(row.status).toBe('failed');
      expect(row.superseded).toBe(true);
      expect(row.error_http_status).toBe(400);
      // The full provider envelope, like every other error row. Storing the bare message
      // would drop type/param/code — the dimensions that identify the error downstream.
      expect(JSON.parse(row.error_message as string)).toEqual({
        error: {
          message: 'Unknown parameter',
          type: 'invalid_request_error',
          param: 'max_tokens',
          code: 'unknown_parameter',
        },
      });
      expect(row.autofix_applied).toBe(true);
      expect(row.autofix_group_id).toBe('grp-1');
      expect(row.autofix_role).toBe('original');
      expect(row.autofix_operations).toEqual(operations);
      // Persist Phoenix's own identifiers for the heal decision. sampleAutofix's
      // failed entry carries only heal_attempt_id, so issueId/patchId fall to
      // null while healAttemptId is preserved (covers the non-null branch).
      expect(row.autofix_decision).toEqual({
        status: null,
        issueId: null,
        patchId: null,
        healAttemptId: 'heal-1',
        explanation: null,
      });
    });

    it('recordAutofixOriginal falls each absent Phoenix id to null while keeping the present one', async () => {
      // The ternary is entered via patch_id alone, so issueId + healAttemptId
      // exercise the `?? null` fallback (covers the null side of each field).
      await recorder.recordAutofixOriginal(ctx, 'gpt-4o', 'default', {
        ...sampleAutofix,
        chain: [
          {
            attempt: 0,
            origin: 'original',
            request: { max_tokens: 5 },
            http_status: 400,
            error: { message: 'Unknown parameter' },
            patch_id: 'patch-xyz',
          },
          { attempt: 1, origin: 'autofix', request: { max_output_tokens: 5 }, http_status: 200 },
        ],
      });
      const row = insertMock.mock.calls.at(-1)![0] as Record<string, unknown>;
      expect(row.autofix_decision).toEqual({
        status: null,
        issueId: null,
        patchId: 'patch-xyz',
        healAttemptId: null,
        explanation: null,
      });
    });

    it('recordAutofixOriginal carries the Phoenix explanation onto autofix_decision', async () => {
      // Phoenix's human-readable "why" is persisted alongside the ids so the
      // dashboard Auto-fix card can render it (not re-derive it locally).
      const explanation = {
        summary: 'Renamed the "max_tokens" parameter to "max_output_tokens".',
        operations: [
          {
            type: 'rename_param',
            detail: 'Renamed the "max_tokens" parameter to "max_output_tokens".',
          },
        ],
        source: 'deterministic' as const,
      };
      await recorder.recordAutofixOriginal(ctx, 'gpt-4o', 'default', {
        ...sampleAutofix,
        chain: [
          {
            attempt: 0,
            origin: 'original',
            request: { max_tokens: 5 },
            http_status: 400,
            error: { message: 'Unknown parameter' },
            issue_id: 'issue-9',
            heal_attempt_id: 'heal-9',
            explanation,
          },
          { attempt: 1, origin: 'autofix', request: { max_output_tokens: 5 }, http_status: 200 },
        ],
      });
      const row = insertMock.mock.calls.at(-1)![0] as Record<string, unknown>;
      expect(row.autofix_decision).toEqual({
        status: null,
        issueId: 'issue-9',
        patchId: null,
        healAttemptId: 'heal-9',
        explanation,
      });
    });

    it('recordAutofixOriginal sets autofix_decision to null when the failed entry has no Phoenix ids', async () => {
      // A failed chain entry with none of issue_id/patch_id/heal_attempt_id must
      // leave autofix_decision null (covers the `: null` branch of the ternary).
      await recorder.recordAutofixOriginal(ctx, 'gpt-4o', 'default', {
        ...sampleAutofix,
        chain: [
          {
            attempt: 0,
            origin: 'original',
            request: { max_tokens: 5 },
            http_status: 400,
            error: { message: 'Unknown parameter' },
          },
          { attempt: 1, origin: 'autofix', request: { max_output_tokens: 5 }, http_status: 200 },
        ],
      });
      const row = insertMock.mock.calls.at(-1)![0] as Record<string, unknown>;
      expect(row.autofix_decision).toBeNull();
    });

    it('recordAutofixOriginal is a no-op when the chain has no failed original', async () => {
      await recorder.recordAutofixOriginal(ctx, 'gpt-4o', 'default', {
        ...sampleAutofix,
        chain: [{ attempt: 1, origin: 'autofix', request: {}, http_status: 200 }],
      });
      expect(insertMock).not.toHaveBeenCalled();
    });

    it('recordAutofixOriginal is a no-op when Phoenix supplied no patch', async () => {
      await recorder.recordAutofixOriginal(ctx, 'gpt-4o', 'default', {
        ...sampleAutofix,
        outcome: 'unfixable',
        chain: [sampleAutofix.chain[0]],
      });
      expect(insertMock).not.toHaveBeenCalled();
    });

    it('recordSuccessMessage persists the autofix audit on insert and update paths', async () => {
      const updateMock = jest.fn();
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
      const repo = { insert: insertMock } as never;
      const pricingCache = { getByModel: getByModelMock } as unknown as ModelPricingCacheService;
      const eventBus = { emit: emitMock } as unknown as IngestEventBusService;
      recorder.onModuleDestroy();
      const passthroughCustomProviders = {
        canonicalizeAgentMessageKeys: jest
          .fn()
          .mockImplementation(
            async (_agentId: string, provider: string | null, model: string | null) => ({
              provider: provider ?? null,
              model: model ?? null,
            }),
          ),
      } as never;
      const opencodeGoCatalog = {
        getCostPerRequest: jest.fn().mockReturnValue(null),
        resolveCostPerRequest: jest.fn().mockResolvedValue(null),
      } as never;
      recorder = new ProxyMessageRecorder(
        repo,
        pricingCache,
        dedupWithLock,
        eventBus,
        passthroughCustomProviders,
        opencodeGoCatalog,
      );

      await recorder.recordSuccessMessage(
        ctx,
        'gpt-4o',
        'standard',
        'scored',
        { prompt_tokens: 1, completion_tokens: 1 },
        { autofix: sampleAutofix },
      );
      const inserted = insertMock.mock.calls.at(-1)![0];
      expect(inserted.autofix_applied).toBe(true);
      expect(inserted.autofix_role).toBe('retry');
      expect(inserted.autofix_group_id).toBe('grp-1');

      (dedupWithLock.findExistingSuccessMessage as jest.Mock).mockResolvedValue({
        id: 'existing-autofix',
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
        { autofix: sampleAutofix },
      );
      expect(updateMock.mock.calls[0][1].autofix_applied).toBe(true);
      expect(updateMock.mock.calls[0][1].autofix_role).toBe('retry');
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

  describe('request_params persistence', () => {
    const params = { thinking: { type: 'disabled' as const } };

    it('recordProviderError persists requestParams when supplied', async () => {
      await recorder.recordProviderError(ctx, 500, 'oops', { requestParams: params });
      expect(insertMock.mock.calls[0][0]).toMatchObject({ request_params: params });
    });

    it('recordProviderError leaves request_params null when omitted (back-compat)', async () => {
      await recorder.recordProviderError(ctx, 500, 'oops');
      expect(insertMock.mock.calls[0][0]).toMatchObject({ request_params: null });
    });

    it('recordPrimaryFailure persists requestParams when supplied', async () => {
      await recorder.recordPrimaryFailure(
        ctx,
        'standard',
        'gpt-4o',
        'err',
        new Date().toISOString(),
        'api_key',
        { requestParams: params },
      );
      expect(insertMock.mock.calls[0][0]).toMatchObject({ request_params: params });
    });

    it('recordPrimaryFailure leaves request_params null when omitted (back-compat)', async () => {
      await recorder.recordPrimaryFailure(
        ctx,
        'standard',
        'gpt-4o',
        'err',
        new Date().toISOString(),
        'api_key',
      );
      expect(insertMock.mock.calls[0][0]).toMatchObject({ request_params: null });
    });

    it('recordFailedFallbacks persists requestParams on every row in the batch', async () => {
      const failures = [
        { model: 'a', provider: 'p', fallbackIndex: 0, status: 500, errorBody: 'e1' },
        { model: 'b', provider: 'p', fallbackIndex: 1, status: 502, errorBody: 'e2' },
      ];
      await recorder.recordFailedFallbacks(ctx, 'standard', 'gpt-4o', failures, {
        requestParams: params,
      });
      const rows = insertMock.mock.calls[0][0] as Array<{ request_params: unknown }>;
      expect(rows).toHaveLength(2);
      expect(rows[0].request_params).toEqual(params);
      expect(rows[1].request_params).toEqual(params);
    });

    it('recordFallbackSuccess persists requestParams when supplied', async () => {
      await recorder.recordFallbackSuccess(ctx, 'gpt-4o', 'standard', {
        fallbackFromModel: 'claude-opus',
        fallbackIndex: 0,
        requestParams: params,
      });
      expect(insertMock.mock.calls[0][0]).toMatchObject({ request_params: params });
    });

    it('arbitrary param shapes round-trip — forward-compat for future provider knobs and user-defined custom params', async () => {
      const future = {
        thinking: { type: 'enabled' },
        reasoning_effort: 'high',
        custom_safety: { mode: 'permissive', threshold: 0.8 },
      } as never;
      await recorder.recordProviderError(ctx, 500, 'oops', { requestParams: future });
      expect(insertMock.mock.calls[0][0]).toMatchObject({ request_params: future });
    });
  });
});

describe('ProxyMessageRecorder with real CustomProviderService', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { CustomProviderService } = require('../../custom-provider/custom-provider.service');

  function wire(customProviderRow: { id: string; name: string; agent_id: string }) {
    const insertMock = jest.fn();
    const messageRepo = { insert: insertMock } as never;
    const pricingCache = {
      getByModel: jest.fn().mockReturnValue(undefined),
      reload: jest.fn(),
    } as never;
    const dedup = {} as ProxyMessageDedup;
    const eventBus = { emit: jest.fn() } as never;

    const customProviderRepo = {
      find: jest.fn().mockResolvedValue([customProviderRow]),
    } as never;
    const providerService = {
      upsertProvider: jest.fn(),
      removeProvider: jest.fn(),
    } as never;
    const routingCache = {
      getCustomProviders: jest.fn().mockReturnValue(null),
      setCustomProviders: jest.fn(),
      invalidateAgent: jest.fn(),
    } as never;

    const customProviders = new CustomProviderService(
      customProviderRepo,
      providerService,
      routingCache,
      pricingCache,
      eventBus,
    );

    const mockOpencodeGoCatalog = {
      getCostPerRequest: jest.fn().mockReturnValue(null),
      resolveCostPerRequest: jest.fn().mockResolvedValue(null),
    } as never;
    const recorder = new ProxyMessageRecorder(
      messageRepo,
      pricingCache,
      dedup,
      eventBus,
      customProviders,
      mockOpencodeGoCatalog,
    );
    return { recorder, insertMock };
  }

  it('rewrites a llama.cpp row end-to-end: provider + model land canonical in the DB', async () => {
    const { recorder, insertMock } = wire({
      id: 'cp-llamacpp',
      name: 'llama.cpp',
      agent_id: 'agent-1',
    });
    try {
      await recorder.recordProviderError(ctx, 500, 'upstream error', {
        provider: 'custom:cp-llamacpp',
        model: 'custom:cp-llamacpp/qwen2.5-0.5b-q4.gguf',
        tier: 'default',
      });

      expect(insertMock).toHaveBeenCalledTimes(1);
      expect(insertMock.mock.calls[0][0]).toMatchObject({
        provider: 'llamacpp',
        model: 'llamacpp/qwen2.5-0.5b-q4.gguf',
      });
    } finally {
      recorder.onModuleDestroy();
    }
  });

  it('leaves a user-defined custom provider unchanged (no tileOnly match)', async () => {
    const { recorder, insertMock } = wire({
      id: 'cp-my-groq',
      name: 'My Groq',
      agent_id: 'agent-1',
    });
    try {
      await recorder.recordProviderError(ctx, 500, 'upstream error', {
        provider: 'custom:cp-my-groq',
        model: 'custom:cp-my-groq/llama-3.1-70b',
        tier: 'default',
      });

      expect(insertMock).toHaveBeenCalledTimes(1);
      expect(insertMock.mock.calls[0][0]).toMatchObject({
        provider: 'custom:cp-my-groq',
        model: 'custom:cp-my-groq/llama-3.1-70b',
      });
    } finally {
      recorder.onModuleDestroy();
    }
  });
});

describe('ProxyMessageRecorder OpenCode Go subscription cost', () => {
  let recorder: ProxyMessageRecorder;
  let insertMock: jest.Mock;
  let dedupWithLock: ProxyMessageDedup;
  let getCostPerRequestMock: jest.Mock;

  beforeEach(() => {
    insertMock = jest.fn();
    const repo = { insert: insertMock } as never;
    const pricingCache = {
      getByModel: jest.fn().mockReturnValue(undefined),
    } as unknown as ModelPricingCacheService;
    dedupWithLock = {
      normalizeSessionKey: jest.fn().mockReturnValue(null),
      getSuccessWriteLockKey: jest.fn().mockReturnValue('lock'),
      withSuccessWriteLock: jest
        .fn()
        .mockImplementation(async (_key: string, fn: () => Promise<void>) => fn()),
      withAgentMessageTransaction: jest
        .fn()
        .mockImplementation((_repo: unknown, _ctx: unknown, fn: (r: unknown) => Promise<void>) =>
          fn({ insert: insertMock }),
        ),
      findExistingSuccessMessage: jest.fn().mockResolvedValue(null),
    } as unknown as ProxyMessageDedup;
    const eventBus = { emit: jest.fn() } as unknown as IngestEventBusService;
    const customProviders = {
      canonicalizeAgentMessageKeys: jest
        .fn()
        .mockImplementation(
          async (_agentId: string, provider: string | null, model: string | null) => ({
            provider: provider ?? null,
            model: model ?? null,
          }),
        ),
    } as never;
    getCostPerRequestMock = jest.fn().mockResolvedValue(0.01364);
    const opencodeGoCatalog = {
      getCostPerRequest: jest.fn().mockReturnValue(0.01364),
      resolveCostPerRequest: getCostPerRequestMock,
    } as never;
    recorder = new ProxyMessageRecorder(
      repo,
      pricingCache,
      dedupWithLock,
      eventBus,
      customProviders,
      opencodeGoCatalog,
    );
  });

  afterEach(() => {
    recorder.onModuleDestroy();
  });

  it('records the catalog per-request cost for an opencode-go subscription success', async () => {
    await recorder.recordSuccessMessage(
      ctx,
      'glm-5.1',
      'standard',
      'scored',
      { prompt_tokens: 700, completion_tokens: 150 },
      { provider: 'opencode-go', authType: 'subscription' },
    );

    expect(getCostPerRequestMock).toHaveBeenCalledWith('glm-5.1');
    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(insertMock.mock.calls[0][0]).toMatchObject({
      model: 'glm-5.1',
      provider: 'opencode-go',
      auth_type: 'subscription',
      cost_usd: 0.01364,
    });
  });

  it('records the catalog per-request cost for an opencode-go subscription fallback success', async () => {
    await recorder.recordFallbackSuccess(ctx, 'glm-5.1', 'standard', {
      provider: 'opencode-go',
      authType: 'subscription',
      fallbackFromModel: 'kimi-k2.5',
      fallbackIndex: 0,
      usage: { prompt_tokens: 700, completion_tokens: 150 },
    });

    expect(getCostPerRequestMock).toHaveBeenCalledWith('glm-5.1');
    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(insertMock.mock.calls[0][0]).toMatchObject({
      model: 'glm-5.1',
      provider: 'opencode-go',
      auth_type: 'subscription',
      cost_usd: 0.01364,
      fallback_from_model: 'kimi-k2.5',
    });
  });

  it('falls back to $0 when the catalog has no cost for the model (cold-start safety)', async () => {
    getCostPerRequestMock.mockResolvedValueOnce(null);
    await recorder.recordSuccessMessage(
      ctx,
      'glm-5.1',
      'standard',
      'scored',
      { prompt_tokens: 100, completion_tokens: 50 },
      { provider: 'opencode-go', authType: 'subscription' },
    );

    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(insertMock.mock.calls[0][0]).toMatchObject({
      cost_usd: 0,
      auth_type: 'subscription',
    });
  });

  it('does not consult the catalog for non-subscription opencode-go calls', async () => {
    await recorder.recordSuccessMessage(
      ctx,
      'glm-5.1',
      'standard',
      'scored',
      { prompt_tokens: 100, completion_tokens: 50 },
      { provider: 'opencode-go', authType: 'api_key' },
    );

    expect(getCostPerRequestMock).not.toHaveBeenCalled();
  });

  it('records the catalog cost when the provider is stored under an alias (e.g. "opencodego")', async () => {
    await recorder.recordSuccessMessage(
      ctx,
      'glm-5.1',
      'standard',
      'scored',
      { prompt_tokens: 700, completion_tokens: 150 },
      { provider: 'opencodego', authType: 'subscription' },
    );

    expect(getCostPerRequestMock).toHaveBeenCalledWith('glm-5.1');
    expect(insertMock.mock.calls[0][0]).toMatchObject({
      cost_usd: 0.01364,
      auth_type: 'subscription',
    });
  });

  it('records $0 when provider is null and authType is subscription (defensive)', async () => {
    await recorder.recordSuccessMessage(
      ctx,
      'glm-5.1',
      'standard',
      'scored',
      { prompt_tokens: 100, completion_tokens: 50 },
      { provider: undefined, authType: 'subscription' },
    );

    expect(getCostPerRequestMock).not.toHaveBeenCalled();
    expect(insertMock.mock.calls[0][0]).toMatchObject({ cost_usd: 0 });
  });

  it('does not consult the catalog for other providers on subscription auth', async () => {
    await recorder.recordSuccessMessage(
      ctx,
      'claude-opus-4',
      'reasoning',
      'scored',
      { prompt_tokens: 100, completion_tokens: 50 },
      { provider: 'anthropic', authType: 'subscription' },
    );

    expect(getCostPerRequestMock).not.toHaveBeenCalled();
    // Flat-fee subscription path: cost stays 0, not derived from token math.
    expect(insertMock.mock.calls[0][0]).toMatchObject({ cost_usd: 0 });
  });
});
