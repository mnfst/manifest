import {
  buildMetaHeaders,
  handleProviderError,
  recordFallbackFailures,
  handleStreamResponse,
  handleNonStreamResponse,
  recordSuccess,
} from '../proxy-response-handler';
import { RoutingMeta } from '../proxy.service';
import { FailedFallback } from '../proxy-fallback.service';
import { IngestionContext } from '../../../otlp/interfaces/ingestion-context.interface';
import { StreamUsage } from '../stream-writer';

const testCtx: IngestionContext = {
  tenantId: 'tenant-1',
  agentId: 'agent-1',
  agentName: 'test-agent',
  userId: 'user-1',
};

function makeMeta(overrides: Partial<RoutingMeta> = {}): RoutingMeta {
  return {
    tier: 'standard' as any,
    model: 'gpt-4o',
    provider: 'openai',
    confidence: 0.9,
    reason: 'auto',
    ...overrides,
  };
}

function mockResponse(): {
  res: Record<string, jest.Mock>;
  headers: Record<string, string>;
} {
  const headers: Record<string, string> = {};
  const res: Record<string, jest.Mock> = {
    status: jest.fn().mockReturnThis(),
    setHeader: jest.fn((k: string, v: string) => {
      headers[k] = v;
    }),
    json: jest.fn(),
  };
  return { res, headers };
}

function mockRecorder() {
  return {
    recordProviderError: jest.fn().mockResolvedValue(undefined),
    recordFailedFallbacks: jest.fn().mockResolvedValue(undefined),
    recordPrimaryFailure: jest.fn().mockResolvedValue(undefined),
    recordFallbackSuccess: jest.fn().mockResolvedValue(undefined),
    recordSuccessMessage: jest.fn().mockResolvedValue(undefined),
  };
}

describe('proxy-response-handler', () => {
  /* ── buildMetaHeaders ── */

  describe('buildMetaHeaders', () => {
    it('should include standard routing headers', () => {
      const meta = makeMeta();
      const headers = buildMetaHeaders(meta);

      expect(headers['X-Manifest-Tier']).toBe('standard');
      expect(headers['X-Manifest-Model']).toBe('gpt-4o');
      expect(headers['X-Manifest-Provider']).toBe('openai');
      expect(headers['X-Manifest-Confidence']).toBe('0.9');
      expect(headers['X-Manifest-Reason']).toBe('auto');
    });

    it('should include fallback headers when fallbackFromModel is set', () => {
      const meta = makeMeta({
        fallbackFromModel: 'gpt-4o',
        fallbackIndex: 2,
      });
      const headers = buildMetaHeaders(meta);

      expect(headers['X-Manifest-Fallback-From']).toBe('gpt-4o');
      expect(headers['X-Manifest-Fallback-Index']).toBe('2');
    });

    it('should default fallback index to 0 when not set', () => {
      const meta = makeMeta({ fallbackFromModel: 'gpt-4o' });
      const headers = buildMetaHeaders(meta);

      expect(headers['X-Manifest-Fallback-Index']).toBe('0');
    });

    it('should not include fallback headers when no fallback', () => {
      const meta = makeMeta();
      const headers = buildMetaHeaders(meta);

      expect(headers).not.toHaveProperty('X-Manifest-Fallback-From');
      expect(headers).not.toHaveProperty('X-Manifest-Fallback-Index');
    });
  });

  /* ── handleProviderError ── */

  describe('handleProviderError', () => {
    it('should record provider error and return sanitized error for non-fallback', async () => {
      const { res } = mockResponse();
      const recorder = mockRecorder();
      const meta = makeMeta();
      const metaHeaders = buildMetaHeaders(meta);

      await handleProviderError(
        res as any,
        testCtx,
        meta,
        metaHeaders,
        500,
        'Internal Server Error',
        undefined,
        recorder as any,
        'trace-1',
      );

      expect(recorder.recordProviderError).toHaveBeenCalledWith(
        testCtx,
        500,
        'Internal Server Error',
        {
          model: 'gpt-4o',
          tier: 'standard',
          traceId: 'trace-1',
          fallbackFromModel: undefined,
          fallbackIndex: undefined,
          authType: undefined,
        },
      );
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ type: 'upstream_error', status: 500 }),
        }),
      );
    });

    it('should handle fallback exhausted when failedFallbacks present and no fallbackFromModel', async () => {
      const { res, headers } = mockResponse();
      const recorder = mockRecorder();
      const meta = makeMeta(); // no fallbackFromModel
      const metaHeaders = buildMetaHeaders(meta);
      const failedFallbacks: FailedFallback[] = [
        {
          model: 'claude-3-haiku',
          provider: 'anthropic',
          fallbackIndex: 0,
          status: 429,
          errorBody: 'rate limited',
        },
      ];

      await handleProviderError(
        res as any,
        testCtx,
        meta,
        metaHeaders,
        502,
        'Bad Gateway',
        failedFallbacks,
        recorder as any,
      );

      expect(recorder.recordFailedFallbacks).toHaveBeenCalled();
      expect(recorder.recordPrimaryFailure).toHaveBeenCalled();
      expect(res.setHeader).toHaveBeenCalledWith('X-Manifest-Fallback-Exhausted', 'true');
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            type: 'fallback_exhausted',
            primary_model: 'gpt-4o',
            attempted_fallbacks: [{ model: 'claude-3-haiku', provider: 'anthropic', status: 429 }],
          }),
        }),
      );
    });

    it('should record simple error when failedFallbacks present but meta has fallbackFromModel', async () => {
      const { res } = mockResponse();
      const recorder = mockRecorder();
      const meta = makeMeta({ fallbackFromModel: 'gpt-4o' });
      const metaHeaders = buildMetaHeaders(meta);
      const failedFallbacks: FailedFallback[] = [
        {
          model: 'claude-3-haiku',
          provider: 'anthropic',
          fallbackIndex: 0,
          status: 429,
          errorBody: '',
        },
      ];

      await handleProviderError(
        res as any,
        testCtx,
        meta,
        metaHeaders,
        500,
        'Error',
        failedFallbacks,
        recorder as any,
      );

      // Should NOT enter fallback-exhausted path since fallbackFromModel is set
      expect(recorder.recordProviderError).toHaveBeenCalled();
      expect(recorder.recordFailedFallbacks).not.toHaveBeenCalled();
    });

    it('should handle empty failedFallbacks array as non-fallback error', async () => {
      const { res } = mockResponse();
      const recorder = mockRecorder();
      const meta = makeMeta();
      const metaHeaders = buildMetaHeaders(meta);

      await handleProviderError(
        res as any,
        testCtx,
        meta,
        metaHeaders,
        404,
        'Not Found',
        [],
        recorder as any,
      );

      expect(recorder.recordProviderError).toHaveBeenCalled();
      expect(recorder.recordFailedFallbacks).not.toHaveBeenCalled();
    });

    it('should not throw when recordProviderError rejects', async () => {
      const { res } = mockResponse();
      const recorder = mockRecorder();
      recorder.recordProviderError.mockRejectedValue(new Error('DB error'));
      const meta = makeMeta();

      // Should not throw -- fire-and-forget with .catch
      await handleProviderError(
        res as any,
        testCtx,
        meta,
        buildMetaHeaders(meta),
        500,
        'Error',
        undefined,
        recorder as any,
      );

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  /* ── recordFallbackFailures ── */

  describe('recordFallbackFailures', () => {
    it('should return undefined when no fallbackFromModel', () => {
      const recorder = mockRecorder();
      const meta = makeMeta();

      const result = recordFallbackFailures(testCtx, meta, undefined, recorder as any);

      expect(result).toBeUndefined();
      expect(recorder.recordPrimaryFailure).not.toHaveBeenCalled();
    });

    it('should record primary failure and return timestamp', () => {
      const recorder = mockRecorder();
      const meta = makeMeta({
        fallbackFromModel: 'gpt-4o',
        primaryErrorBody: 'rate limited',
        primaryErrorStatus: 429,
      });

      const result = recordFallbackFailures(testCtx, meta, undefined, recorder as any);

      expect(result).toBeDefined();
      expect(recorder.recordPrimaryFailure).toHaveBeenCalled();
    });

    it('should record failed fallbacks when present', () => {
      const recorder = mockRecorder();
      const meta = makeMeta({ fallbackFromModel: 'gpt-4o' });
      const failedFallbacks: FailedFallback[] = [
        { model: 'claude', provider: 'anthropic', fallbackIndex: 0, status: 500, errorBody: '' },
      ];

      recordFallbackFailures(testCtx, meta, failedFallbacks, recorder as any);

      expect(recorder.recordFailedFallbacks).toHaveBeenCalled();
    });

    it('should not record failed fallbacks when array is empty', () => {
      const recorder = mockRecorder();
      const meta = makeMeta({ fallbackFromModel: 'gpt-4o' });

      recordFallbackFailures(testCtx, meta, [], recorder as any);

      expect(recorder.recordFailedFallbacks).not.toHaveBeenCalled();
    });

    it('should use default error message when primaryErrorBody is not set', () => {
      const recorder = mockRecorder();
      const meta = makeMeta({
        fallbackFromModel: 'gpt-4o',
        primaryErrorStatus: 503,
      });

      recordFallbackFailures(testCtx, meta, undefined, recorder as any);

      expect(recorder.recordPrimaryFailure).toHaveBeenCalledWith(
        testCtx,
        expect.anything(),
        'gpt-4o',
        'Provider returned HTTP 503',
        expect.any(String),
        undefined,
      );
    });

    it('should use default 500 status when primaryErrorStatus is not set', () => {
      const recorder = mockRecorder();
      const meta = makeMeta({ fallbackFromModel: 'gpt-4o' });

      recordFallbackFailures(testCtx, meta, undefined, recorder as any);

      expect(recorder.recordPrimaryFailure).toHaveBeenCalledWith(
        testCtx,
        expect.anything(),
        'gpt-4o',
        'Provider returned HTTP 500',
        expect.any(String),
        undefined,
      );
    });
  });

  /* ── handleStreamResponse ── */

  describe('handleStreamResponse', () => {
    function mockForward(
      flags: { isGoogle?: boolean; isAnthropic?: boolean; isChatGpt?: boolean } = {},
    ) {
      return {
        response: { body: { getReader: jest.fn() } },
        isGoogle: flags.isGoogle ?? false,
        isAnthropic: flags.isAnthropic ?? false,
        isChatGpt: flags.isChatGpt ?? false,
      };
    }

    function mockProviderClient() {
      return {
        convertGoogleStreamChunk: jest.fn(),
        createAnthropicStreamTransformer: jest.fn().mockReturnValue(jest.fn()),
        convertChatGptStreamChunk: jest.fn(),
      };
    }

    // These tests verify the branching logic (which adapter is used).
    // Full streaming is tested in stream-writer.spec.ts.
    // We mock pipeStream to avoid needing real ReadableStreams.
    let pipeStreamSpy: jest.SpyInstance;
    let initSseHeadersSpy: jest.SpyInstance;

    beforeEach(() => {
      // We need to spy on the imported functions
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const streamWriter = require('../stream-writer');
      pipeStreamSpy = jest.spyOn(streamWriter, 'pipeStream').mockResolvedValue(null);
      initSseHeadersSpy = jest.spyOn(streamWriter, 'initSseHeaders').mockImplementation(() => {});
    });

    afterEach(() => {
      pipeStreamSpy?.mockRestore();
      initSseHeadersSpy?.mockRestore();
    });

    it('should use Google adapter for Google responses', async () => {
      const { res } = mockResponse();
      const forward = mockForward({ isGoogle: true });
      const client = mockProviderClient();
      const meta = makeMeta();

      await handleStreamResponse(res as any, forward as any, meta, {}, client as any);

      expect(pipeStreamSpy).toHaveBeenCalledWith(forward.response.body, res, expect.any(Function));
    });

    it('should use Anthropic adapter for Anthropic responses', async () => {
      const { res } = mockResponse();
      const forward = mockForward({ isAnthropic: true });
      const client = mockProviderClient();
      const meta = makeMeta();

      await handleStreamResponse(res as any, forward as any, meta, {}, client as any);

      expect(client.createAnthropicStreamTransformer).toHaveBeenCalledWith('gpt-4o');
    });

    it('should use ChatGPT adapter for ChatGPT responses', async () => {
      const { res } = mockResponse();
      const forward = mockForward({ isChatGpt: true });
      const client = mockProviderClient();
      const meta = makeMeta();

      await handleStreamResponse(res as any, forward as any, meta, {}, client as any);

      expect(pipeStreamSpy).toHaveBeenCalledWith(forward.response.body, res, expect.any(Function));
    });

    it('should pipe without transformer for standard OpenAI responses', async () => {
      const { res } = mockResponse();
      const forward = mockForward();
      const client = mockProviderClient();
      const meta = makeMeta();

      await handleStreamResponse(res as any, forward as any, meta, {}, client as any);

      // Called with only 2 args (no transformer)
      expect(pipeStreamSpy).toHaveBeenCalledWith(forward.response.body, res);
    });
  });

  /* ── handleNonStreamResponse ── */

  describe('handleNonStreamResponse', () => {
    function mockProviderClient() {
      return {
        convertGoogleResponse: jest.fn().mockReturnValue({ id: 'google-converted' }),
        convertAnthropicResponse: jest.fn().mockReturnValue({ id: 'anthropic-converted' }),
        convertChatGptResponse: jest.fn().mockReturnValue({ id: 'chatgpt-converted' }),
      };
    }

    function mockForward(
      body: unknown,
      flags: { isGoogle?: boolean; isAnthropic?: boolean; isChatGpt?: boolean } = {},
    ) {
      return {
        response: { json: jest.fn().mockResolvedValue(body) },
        isGoogle: flags.isGoogle ?? false,
        isAnthropic: flags.isAnthropic ?? false,
        isChatGpt: flags.isChatGpt ?? false,
      };
    }

    it('should convert Google response and extract usage', async () => {
      const { res } = mockResponse();
      const client = mockProviderClient();
      client.convertGoogleResponse.mockReturnValue({
        usage: { prompt_tokens: 100, completion_tokens: 50 },
      });
      const forward = mockForward({}, { isGoogle: true });
      const meta = makeMeta();

      const usage = await handleNonStreamResponse(
        res as any,
        forward as any,
        meta,
        {},
        client as any,
      );

      expect(client.convertGoogleResponse).toHaveBeenCalled();
      expect(usage).toEqual({
        prompt_tokens: 100,
        completion_tokens: 50,
        cache_read_tokens: undefined,
        cache_creation_tokens: undefined,
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should convert Anthropic response', async () => {
      const { res } = mockResponse();
      const client = mockProviderClient();
      client.convertAnthropicResponse.mockReturnValue({});
      const forward = mockForward({}, { isAnthropic: true });
      const meta = makeMeta();

      const usage = await handleNonStreamResponse(
        res as any,
        forward as any,
        meta,
        {},
        client as any,
      );

      expect(client.convertAnthropicResponse).toHaveBeenCalled();
      expect(usage).toBeNull();
    });

    it('should convert ChatGPT response', async () => {
      const { res } = mockResponse();
      const client = mockProviderClient();
      const forward = mockForward({}, { isChatGpt: true });
      const meta = makeMeta();

      await handleNonStreamResponse(res as any, forward as any, meta, {}, client as any);

      expect(client.convertChatGptResponse).toHaveBeenCalled();
    });

    it('should pass through standard OpenAI response', async () => {
      const { res } = mockResponse();
      const client = mockProviderClient();
      const body = {
        id: 'chatcmpl-123',
        usage: { prompt_tokens: 50, completion_tokens: 25 },
      };
      const forward = mockForward(body);
      const meta = makeMeta();

      const usage = await handleNonStreamResponse(
        res as any,
        forward as any,
        meta,
        {},
        client as any,
      );

      expect(usage).toEqual({
        prompt_tokens: 50,
        completion_tokens: 25,
        cache_read_tokens: undefined,
        cache_creation_tokens: undefined,
      });
      expect(res.json).toHaveBeenCalledWith(body);
    });

    it('should return null usage when no usage data in response', async () => {
      const { res } = mockResponse();
      const client = mockProviderClient();
      const forward = mockForward({ id: 'chatcmpl-123' });
      const meta = makeMeta();

      const usage = await handleNonStreamResponse(
        res as any,
        forward as any,
        meta,
        {},
        client as any,
      );

      expect(usage).toBeNull();
    });

    it('should return null usage when prompt_tokens is not a number', async () => {
      const { res } = mockResponse();
      const client = mockProviderClient();
      const forward = mockForward({ usage: { prompt_tokens: 'not-a-number' } });
      const meta = makeMeta();

      const usage = await handleNonStreamResponse(
        res as any,
        forward as any,
        meta,
        {},
        client as any,
      );

      expect(usage).toBeNull();
    });

    it('should include cache tokens in usage when present', async () => {
      const { res } = mockResponse();
      const client = mockProviderClient();
      const body = {
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          cache_read_tokens: 20,
          cache_creation_tokens: 10,
        },
      };
      const forward = mockForward(body);
      const meta = makeMeta();

      const usage = await handleNonStreamResponse(
        res as any,
        forward as any,
        meta,
        {},
        client as any,
      );

      expect(usage).toEqual({
        prompt_tokens: 100,
        completion_tokens: 50,
        cache_read_tokens: 20,
        cache_creation_tokens: 10,
      });
    });

    it('should default completion_tokens to 0 when missing', async () => {
      const { res } = mockResponse();
      const client = mockProviderClient();
      const forward = mockForward({ usage: { prompt_tokens: 100 } });
      const meta = makeMeta();

      const usage = await handleNonStreamResponse(
        res as any,
        forward as any,
        meta,
        {},
        client as any,
      );

      expect(usage!.completion_tokens).toBe(0);
    });
  });

  /* ── recordSuccess ── */

  describe('recordSuccess', () => {
    it('should record fallback success when fallbackFromModel is set with timestamp', () => {
      const recorder = mockRecorder();
      const meta = makeMeta({ fallbackFromModel: 'gpt-4o', fallbackIndex: 1 });
      const usage: StreamUsage = { prompt_tokens: 100, completion_tokens: 50 };

      recordSuccess(
        testCtx,
        meta,
        usage,
        '2025-01-01T00:00:00Z',
        recorder as any,
        'trace-1',
        'session-1',
      );

      expect(recorder.recordFallbackSuccess).toHaveBeenCalledWith(testCtx, 'gpt-4o', 'standard', {
        traceId: 'trace-1',
        fallbackFromModel: 'gpt-4o',
        fallbackIndex: 1,
        timestamp: '2025-01-01T00:00:00Z',
        authType: undefined,
        usage,
      });
    });

    it('should record success message when no fallback and usage exists', () => {
      const recorder = mockRecorder();
      const meta = makeMeta();
      const usage: StreamUsage = { prompt_tokens: 100, completion_tokens: 50 };

      recordSuccess(testCtx, meta, usage, undefined, recorder as any, 'trace-1', 'session-1', 1000);

      expect(recorder.recordSuccessMessage).toHaveBeenCalledWith(
        testCtx,
        'gpt-4o',
        'standard',
        'auto',
        usage,
        {
          traceId: 'trace-1',
          authType: undefined,
          sessionKey: 'session-1',
          durationMs: expect.any(Number),
        },
      );
    });

    it('should not record anything when no fallback and no usage', () => {
      const recorder = mockRecorder();
      const meta = makeMeta();

      recordSuccess(testCtx, meta, null, undefined, recorder as any);

      expect(recorder.recordFallbackSuccess).not.toHaveBeenCalled();
      expect(recorder.recordSuccessMessage).not.toHaveBeenCalled();
    });

    it('should not record fallback success when fallbackFromModel but no timestamp', () => {
      const recorder = mockRecorder();
      const meta = makeMeta({ fallbackFromModel: 'gpt-4o' });
      const usage: StreamUsage = { prompt_tokens: 100, completion_tokens: 50 };

      recordSuccess(testCtx, meta, usage, undefined, recorder as any);

      expect(recorder.recordFallbackSuccess).not.toHaveBeenCalled();
      expect(recorder.recordSuccessMessage).toHaveBeenCalled();
    });

    it('should compute durationMs when startTime is provided', () => {
      const recorder = mockRecorder();
      const meta = makeMeta();
      const usage: StreamUsage = { prompt_tokens: 100, completion_tokens: 50 };
      const startTime = Date.now() - 500;

      recordSuccess(
        testCtx,
        meta,
        usage,
        undefined,
        recorder as any,
        undefined,
        undefined,
        startTime,
      );

      const call = recorder.recordSuccessMessage.mock.calls[0];
      const opts = call[5]; // 6th argument (opts object)
      expect(opts.durationMs).toBeGreaterThanOrEqual(400);
      expect(opts.durationMs).toBeLessThan(1000);
    });

    it('should pass undefined durationMs when startTime is not provided', () => {
      const recorder = mockRecorder();
      const meta = makeMeta();
      const usage: StreamUsage = { prompt_tokens: 100, completion_tokens: 50 };

      recordSuccess(testCtx, meta, usage, undefined, recorder as any);

      const call = recorder.recordSuccessMessage.mock.calls[0];
      const opts = call[5]; // 6th argument (opts object)
      expect(opts.durationMs).toBeUndefined();
    });

    it('should pass streamUsage as undefined when null in fallback success', () => {
      const recorder = mockRecorder();
      const meta = makeMeta({ fallbackFromModel: 'gpt-4o', fallbackIndex: 0 });

      recordSuccess(testCtx, meta, null, '2025-01-01T00:00:00Z', recorder as any);

      expect(recorder.recordFallbackSuccess).toHaveBeenCalledWith(testCtx, 'gpt-4o', 'standard', {
        traceId: undefined,
        fallbackFromModel: 'gpt-4o',
        fallbackIndex: 0,
        timestamp: '2025-01-01T00:00:00Z',
        authType: undefined,
        usage: undefined,
      });
    });
  });
});
