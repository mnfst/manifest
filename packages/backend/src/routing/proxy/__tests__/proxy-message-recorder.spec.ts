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
      await recorder.recordFallbackSuccess(
        ctx,
        'gpt-4o',
        'standard',
        undefined,
        'claude-opus',
        0,
        new Date().toISOString(),
        'api_key',
        { prompt_tokens: 0, completion_tokens: 0 },
      );
      expect(insertMock).toHaveBeenCalledTimes(1);
      expect(insertMock.mock.calls[0][0]).toMatchObject({
        status: 'ok',
        input_tokens: 0,
        output_tokens: 0,
        fallback_from_model: 'claude-opus',
      });
    });

    it('records with zero tokens when usage is undefined (fallback chain succeeded)', async () => {
      await recorder.recordFallbackSuccess(
        ctx,
        'gpt-4o',
        'standard',
        undefined,
        'claude-opus',
        0,
        new Date().toISOString(),
        'api_key',
        undefined,
      );
      expect(insertMock).toHaveBeenCalledTimes(1);
      expect(insertMock.mock.calls[0][0]).toMatchObject({
        status: 'ok',
        input_tokens: 0,
        output_tokens: 0,
      });
    });

    it('inserts when only prompt_tokens is non-zero', async () => {
      await recorder.recordFallbackSuccess(
        ctx,
        'gpt-4o',
        'standard',
        'trace-1',
        'claude-opus',
        1,
        new Date().toISOString(),
        'api_key',
        { prompt_tokens: 200, completion_tokens: 0 },
      );
      expect(insertMock).toHaveBeenCalledTimes(1);
      expect(insertMock.mock.calls[0][0]).toMatchObject({
        input_tokens: 200,
        output_tokens: 0,
      });
    });

    it('inserts when only completion_tokens is non-zero', async () => {
      await recorder.recordFallbackSuccess(
        ctx,
        'gpt-4o',
        'standard',
        undefined,
        'claude-opus',
        0,
        new Date().toISOString(),
        'api_key',
        { prompt_tokens: 0, completion_tokens: 75 },
      );
      expect(insertMock).toHaveBeenCalledTimes(1);
      expect(insertMock.mock.calls[0][0]).toMatchObject({
        input_tokens: 0,
        output_tokens: 75,
      });
    });

    it('inserts a message with status "ok" and correct metadata', async () => {
      await recorder.recordFallbackSuccess(
        ctx,
        'gpt-4o',
        'standard',
        'trace-abc',
        'claude-opus',
        2,
        '2025-01-01T00:00:00.000Z',
        'api_key',
        { prompt_tokens: 100, completion_tokens: 50 },
      );
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
      await recorder.recordFallbackSuccess(
        ctx,
        'gpt-4o',
        'standard',
        undefined,
        undefined,
        undefined,
        undefined,
        'api_key',
        { prompt_tokens: 1000, completion_tokens: 500 },
      );
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
      await recorder.recordFallbackSuccess(
        ctx,
        'gpt-4o',
        'standard',
        undefined,
        undefined,
        undefined,
        undefined,
        'subscription',
        { prompt_tokens: 1000, completion_tokens: 500 },
      );
      const inserted = insertMock.mock.calls[0][0];
      expect(inserted.cost_usd).toBe(0);
    });

    it('sets cost_usd to null when no pricing data exists', async () => {
      getByModelMock.mockReturnValue(undefined);
      await recorder.recordFallbackSuccess(
        ctx,
        'unknown-model',
        'standard',
        undefined,
        undefined,
        undefined,
        undefined,
        'api_key',
        { prompt_tokens: 100, completion_tokens: 50 },
      );
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
      await recorder.recordFallbackSuccess(
        ctx,
        'gpt-4o',
        'standard',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        { prompt_tokens: 10, completion_tokens: 5 },
      );
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
      await recorder.recordFallbackSuccess(
        ctx,
        'gpt-4o',
        'standard',
        undefined,
        undefined,
        undefined,
        undefined,
        'api_key',
        {
          prompt_tokens: 100,
          completion_tokens: 50,
          cache_read_tokens: 30,
          cache_creation_tokens: 20,
        },
      );
      const inserted = insertMock.mock.calls[0][0];
      expect(inserted.cache_read_tokens).toBe(30);
      expect(inserted.cache_creation_tokens).toBe(20);
    });

    it('defaults cache tokens to 0 when not in usage', async () => {
      await recorder.recordFallbackSuccess(
        ctx,
        'gpt-4o',
        'standard',
        undefined,
        undefined,
        undefined,
        undefined,
        'api_key',
        { prompt_tokens: 100, completion_tokens: 50 },
      );
      const inserted = insertMock.mock.calls[0][0];
      expect(inserted.cache_read_tokens).toBe(0);
      expect(inserted.cache_creation_tokens).toBe(0);
    });

    it('emits SSE event after recording', async () => {
      await recorder.recordFallbackSuccess(ctx, 'gpt-4o', 'standard');
      expect(emitMock).toHaveBeenCalledWith('user-1');
    });
  });

  describe('recordProviderError', () => {
    it('records error and emits SSE event', async () => {
      await recorder.recordProviderError(ctx, 500, 'Internal error', 'gpt-4o', 'standard');
      expect(insertMock).toHaveBeenCalledTimes(1);
      expect(insertMock.mock.calls[0][0]).toMatchObject({
        status: 'error',
        error_message: 'Internal error',
        model: 'gpt-4o',
      });
      expect(emitMock).toHaveBeenCalledWith('user-1');
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

    it('does not insert or emit when tokens are zero', async () => {
      await recorder.recordSuccessMessage(ctx, 'gpt-4o', 'standard', 'scored', {
        prompt_tokens: 0,
        completion_tokens: 0,
      });
      expect(insertMock).not.toHaveBeenCalled();
      expect(emitMock).not.toHaveBeenCalled();
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
        undefined,
        undefined,
        'session-abc',
      );

      expect(updateMock).toHaveBeenCalledTimes(1);
      expect(updateMock.mock.calls[0][1]).toMatchObject({
        session_key: 'session-abc',
      });
      expect(emitMock).toHaveBeenCalledWith('user-1');
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
        undefined,
        undefined,
        undefined,
        1500,
      );

      expect(updateMock.mock.calls[0][1]).toMatchObject({
        duration_ms: 1500,
      });
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
