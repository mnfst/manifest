import {
  attachCostToResponseBody,
  attachCostToUsageObject,
  createResponseCostState,
  injectCostIntoSseChunk,
  injectCostIntoSseEvent,
  resolveResponseCostUsd,
  type ResponseCostContext,
} from '../response-cost';
import type { StreamUsage } from '../stream-writer';

const pricingCtx: ResponseCostContext = {
  model: 'gpt-4o',
  authType: 'api_key',
  pricing: {
    model_name: 'gpt-4o',
    provider: 'openai',
    input_price_per_token: 0.000005,
    output_price_per_token: 0.00002,
    display_name: 'GPT-4o',
  },
};

describe('response-cost', () => {
  describe('resolveResponseCostUsd', () => {
    it('computes cost from pricing for api_key usage', () => {
      const usage: StreamUsage = { prompt_tokens: 100, completion_tokens: 50 };
      // 100 * 0.000005 + 50 * 0.00002 = 0.0005 + 0.001 = 0.0015
      expect(resolveResponseCostUsd(usage, pricingCtx)).toBeCloseTo(0.0015, 10);
    });

    it('returns 0 for flat subscription auth', () => {
      const usage: StreamUsage = { prompt_tokens: 100, completion_tokens: 50 };
      expect(
        resolveResponseCostUsd(usage, {
          ...pricingCtx,
          authType: 'subscription',
        }),
      ).toBe(0);
    });

    it('prefers per-request subscription cost when set', () => {
      const usage: StreamUsage = { prompt_tokens: 100, completion_tokens: 50 };
      expect(
        resolveResponseCostUsd(usage, {
          ...pricingCtx,
          authType: 'subscription',
          perRequestCostUsd: 0.0136,
        }),
      ).toBe(0.0136);
    });
  });

  describe('attachCostToUsageObject', () => {
    it('sets usage.cost when cost is finite', () => {
      const usage = { prompt_tokens: 10, completion_tokens: 5 };
      attachCostToUsageObject(usage, 0.0015);
      expect(usage).toMatchObject({ cost: 0.0015 });
    });

    it('leaves usage untouched when cost is null', () => {
      const usage = { prompt_tokens: 10, completion_tokens: 5, cost: 0.99 };
      attachCostToUsageObject(usage, null);
      expect(usage.cost).toBe(0.99);
    });

    it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
      'leaves usage untouched when cost is non-finite (%s)',
      (cost) => {
        const usage = { prompt_tokens: 10, completion_tokens: 5, cost: 0.99 };
        attachCostToUsageObject(usage, cost);
        expect(usage.cost).toBe(0.99);
      },
    );
  });

  describe('attachCostToResponseBody', () => {
    it('injects cost on OpenAI chat completions usage', () => {
      const body = {
        id: 'chatcmpl-1',
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      };
      const usage = attachCostToResponseBody(body, pricingCtx);
      expect(usage?.prompt_tokens).toBe(100);
      expect((body.usage as Record<string, unknown>).cost).toBeCloseTo(0.0015, 10);
    });

    it('injects cost on Anthropic-native usage', () => {
      const body = {
        type: 'message',
        usage: { input_tokens: 100, output_tokens: 50 } as Record<string, unknown>,
      };
      attachCostToResponseBody(body, pricingCtx);
      expect(body.usage.cost).toBeCloseTo(0.0015, 10);
    });

    it('injects cost on nested Responses API usage', () => {
      const body = {
        type: 'response.completed',
        response: {
          usage: { input_tokens: 100, output_tokens: 50 } as Record<string, unknown>,
        },
      };
      attachCostToResponseBody(body, pricingCtx);
      expect(body.response.usage.cost).toBeCloseTo(0.0015, 10);
    });

    it('preserves a provider-reported subscription cost', () => {
      const body = {
        usage: { prompt_tokens: 100, completion_tokens: 50, cost: 0.42 },
      };

      attachCostToResponseBody(body, { ...pricingCtx, authType: 'subscription' });

      expect(body.usage.cost).toBe(0.42);
    });

    it.each([null, 'invalid', []])('returns null for invalid response bodies', (body) => {
      expect(attachCostToResponseBody(body, pricingCtx)).toBeNull();
    });

    it('ignores output-only usage until prompt usage has been observed', () => {
      expect(
        attachCostToResponseBody(
          { usage: { completion_tokens: 5 } },
          pricingCtx,
          createResponseCostState(),
        ),
      ).toBeNull();
      expect(
        attachCostToResponseBody(
          { usage: { output_tokens: 5 } },
          pricingCtx,
          createResponseCostState(),
        ),
      ).toBeNull();
      expect(
        attachCostToResponseBody(
          { usage: { total_tokens: 5 } },
          pricingCtx,
          createResponseCostState(),
        ),
      ).toBeNull();
    });
  });

  describe('injectCostIntoSseEvent', () => {
    it('rewrites data: usage chunks with cost', () => {
      const event = `data: ${JSON.stringify({
        id: 'chatcmpl-1',
        choices: [],
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      })}`;
      const { text, usage } = injectCostIntoSseEvent(event, pricingCtx);
      expect(usage?.prompt_tokens).toBe(100);
      expect(text.startsWith('data: ')).toBe(true);
      const payload = JSON.parse(text.slice('data: '.length));
      expect(payload.usage.cost).toBeCloseTo(0.0015, 10);
    });

    it('preserves Anthropic event: lines while injecting cost', () => {
      const event = [
        'event: message_delta',
        JSON.stringify({
          type: 'message_delta',
          usage: { input_tokens: 100, output_tokens: 50 },
        }),
      ].join('\n');
      const { text, usage } = injectCostIntoSseEvent(event, pricingCtx);
      expect(usage?.prompt_tokens).toBe(100);
      expect(text).toContain('event: message_delta');
      expect(text).toContain('data: ');
      const dataLine = text
        .split('\n')
        .find((l) => l.startsWith('data: '))!
        .slice('data: '.length);
      expect(JSON.parse(dataLine).usage.cost).toBeCloseTo(0.0015, 10);
    });

    it('restores data framing for parsed events without usage', () => {
      const event = [
        'event: content_block_delta',
        JSON.stringify({
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'text_delta', text: 'hello' },
        }),
      ].join('\n');

      expect(injectCostIntoSseEvent(event, pricingCtx)).toEqual({
        text:
          'event: content_block_delta\n' +
          'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"hello"}}',
        usage: null,
      });
    });

    it('preserves metadata-only and malformed events with valid framing', () => {
      expect(injectCostIntoSseEvent('\nevent: ping\n', pricingCtx)).toEqual({
        text: 'event: ping',
        usage: null,
      });
      expect(injectCostIntoSseEvent('event: custom\nnot-json', pricingCtx)).toEqual({
        text: 'event: custom\ndata: not-json',
        usage: null,
      });
    });

    it('accumulates Anthropic input and output usage before pricing message_delta', () => {
      const state = createResponseCostState();
      const start = injectCostIntoSseEvent(
        [
          'event: message_start',
          JSON.stringify({
            type: 'message_start',
            message: {
              usage: {
                input_tokens: 100,
                output_tokens: 1,
                cache_read_input_tokens: 20,
                cache_creation_input_tokens: 5,
              },
            },
          }),
        ].join('\n'),
        pricingCtx,
        state,
      );
      const delta = injectCostIntoSseEvent(
        [
          'event: message_delta',
          JSON.stringify({
            type: 'message_delta',
            usage: { output_tokens: 50 },
          }),
        ].join('\n'),
        pricingCtx,
        state,
      );

      expect(start.text).not.toContain('"cost"');
      expect(delta.usage).toMatchObject({
        prompt_tokens: 125,
        completion_tokens: 50,
        cache_read_tokens: 20,
        cache_creation_tokens: 5,
      });
      const data = delta.text
        .split('\n')
        .find((line) => line.startsWith('data: '))!
        .slice('data: '.length);
      expect(JSON.parse(data).usage.cost).toBeCloseTo(0.001625, 10);
    });

    it('passes through [DONE] unchanged', () => {
      expect(injectCostIntoSseEvent('data: [DONE]', pricingCtx)).toEqual({
        text: 'data: [DONE]',
        usage: null,
      });
    });
  });

  describe('injectCostIntoSseChunk', () => {
    it('rewrites each event in a multi-event finalizer independently', () => {
      const chunk =
        'event: response.output_item.done\n' +
        'data: {"type":"response.output_item.done"}\n\n' +
        'event: response.completed\n' +
        'data: {"type":"response.completed","response":{"usage":{"input_tokens":100,"output_tokens":50}}}\n\n' +
        'data: [DONE]\n\n';

      const result = injectCostIntoSseChunk(chunk, pricingCtx);

      expect(result.text).toContain(
        'event: response.output_item.done\ndata: {"type":"response.output_item.done"}\n\n',
      );
      expect(result.text).toContain('event: response.completed\n');
      expect(result.text).toContain('"cost":0.0015');
      expect(result.text.endsWith('data: [DONE]\n\n')).toBe(true);
      expect(result.usage).toMatchObject({ prompt_tokens: 100, completion_tokens: 50 });
    });
  });
});
