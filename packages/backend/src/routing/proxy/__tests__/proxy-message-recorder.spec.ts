import { ProxyMessageRecorder } from '../proxy-message-recorder';
import { ProxyMessageDedup } from '../proxy-message-dedup';
import { ModelPricingCacheService } from '../../../model-prices/model-pricing-cache.service';
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

  beforeEach(() => {
    insertMock = jest.fn();
    getByModelMock = jest.fn().mockReturnValue(undefined);
    const repo = { insert: insertMock } as never;
    const pricingCache = {
      getByModel: getByModelMock,
    } as unknown as ModelPricingCacheService;
    const dedup = {} as ProxyMessageDedup;
    recorder = new ProxyMessageRecorder(repo, pricingCache, dedup);
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
  });
});
