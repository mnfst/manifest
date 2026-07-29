import { decodeRequestRecording, encodeRequestRecording } from './request-recording-codec';

describe('request recording codec', () => {
  it('round-trips versioned request and response payloads through gzip', async () => {
    const payload = {
      version: 1 as const,
      wire_format: 'openai_chat_completions',
      request_body: { model: 'test-model', messages: [{ role: 'user', content: 'hello' }] },
      response_body: { type: 'json' as const, body: { choices: [] } },
    };

    await expect(decodeRequestRecording(await encodeRequestRecording(payload))).resolves.toEqual(
      payload,
    );
  });

  it.each([
    {
      version: 2,
      wire_format: 'openai_chat_completions',
      request_body: {},
      response_body: { type: 'json', body: {} },
    },
    {
      version: 1,
      wire_format: 'openai_chat_completions',
      request_body: null,
      response_body: { type: 'json', body: {} },
    },
    {
      version: 1,
      wire_format: 'openai_chat_completions',
      request_body: 'invalid',
      response_body: { type: 'json', body: {} },
    },
    {
      version: 1,
      wire_format: 'openai_chat_completions',
      request_body: {},
    },
    {
      version: 1,
      wire_format: '',
      request_body: {},
      response_body: null,
    },
    {
      version: 1,
      request_body: {},
      response_body: null,
    },
  ])('rejects invalid recording payloads', async (payload) => {
    const encoded = await encodeRequestRecording(payload as never);

    await expect(decodeRequestRecording(encoded)).rejects.toThrow(
      'Invalid request recording object',
    );
  });

  it('accepts an attempt with no provider response', async () => {
    const payload = {
      version: 1 as const,
      wire_format: 'anthropic_messages',
      request_body: {},
      response_body: null,
    };

    await expect(decodeRequestRecording(await encodeRequestRecording(payload))).resolves.toEqual(
      payload,
    );
  });
});
