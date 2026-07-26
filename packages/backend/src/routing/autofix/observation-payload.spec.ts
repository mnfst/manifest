import {
  MAX_BODY_BYTES,
  isReportableStatus,
  scrubBody,
  scrubProviderUrl,
  toObservation,
  type ObservationInput,
} from './observation-payload';

const baseInput: ObservationInput = {
  traceId: 'trace-1',
  tenantId: 'tenant-1',
  agentId: 'agent-1',
  provider: 'openai',
  authType: 'api_key',
  apiMode: 'chat_completions',
  requestBody: { model: 'gpt-5.1', temperature: 5, messages: [{ role: 'user', content: 'hi' }] },
  status: 400,
  errorBody: JSON.stringify({ error: { message: 'temperature must be <= 2', code: 'bad_param' } }),
};

describe('isReportableStatus', () => {
  it.each([400, 404, 413, 422])('reports request-side %i', (status) => {
    expect(isReportableStatus(status)).toBe(true);
  });

  it.each([401, 402, 403, 429])('skips credential/quota/throttle %i', (status) => {
    expect(isReportableStatus(status)).toBe(false);
  });

  it.each([200, 302, 500, 503])('skips non-4xx %i', (status) => {
    expect(isReportableStatus(status)).toBe(false);
  });
});

describe('scrubBody', () => {
  it('keeps an ordinary body intact', () => {
    const body = { model: 'gpt-5.1', temperature: 5 };
    expect(scrubBody(body)).toEqual(body);
  });

  it('redacts a provider key pasted into message content', () => {
    const scrubbed = scrubBody({
      messages: [{ role: 'user', content: 'use sk-ant-abcdefghijklmno please' }],
    });
    expect(JSON.stringify(scrubbed)).not.toContain('sk-ant-abcdefghijklmno');
    expect(JSON.stringify(scrubbed)).toContain('[REDACTED]');
  });

  it('redacts an authorization header echoed into the body', () => {
    const scrubbed = scrubBody({ headers: { authorization: 'Bearer supersecrettoken123' } });
    expect(JSON.stringify(scrubbed)).not.toContain('supersecrettoken123');
  });

  it('redacts a credential key whatever its value type', () => {
    expect(scrubBody({ authorization: 123 })).toEqual({ authorization: '[REDACTED]' });
    expect(scrubBody({ headers: { 'X-Api-Key': { nested: 'k' } } })).toEqual({
      headers: { 'X-Api-Key': '[REDACTED]' },
    });
  });

  it.each([
    'api_key',
    'apiKey',
    'X-API-KEY',
    'clientSecret',
    'accessToken',
    'refresh_token',
    'client.secret',
    'access.token',
    'api key',
  ])('redacts the opaque credential field %s', (key) => {
    expect(scrubBody({ [key]: 'opaquevalue1234' })).toEqual({ [key]: '[REDACTED]' });
  });

  it('scrubs a secret used as a property name', () => {
    const scrubbed = scrubBody({ 'sk-ant-abcdefghijklmno': 'v' });
    expect(Object.keys(scrubbed!)).toEqual(['[REDACTED]']);
  });

  it('redacts a header-shaped secret quoted inside message content', () => {
    // Serializing first would escape these quotes and defeat the header pattern,
    // so the body is walked and each string scrubbed unescaped.
    const scrubbed = scrubBody({
      messages: [{ role: 'user', content: 'why does {"authorization":"Basic c2VjcmV0dmFs"} 401?' }],
    });
    expect(JSON.stringify(scrubbed)).not.toContain('c2VjcmV0dmFs');
    expect(JSON.stringify(scrubbed)).toContain('[REDACTED]');
  });

  it('leaves the structure intact while scrubbing', () => {
    const scrubbed = scrubBody({ model: 'gpt-5.1', tools: [{ name: 't', args: { n: 1 } }] });
    expect(scrubbed).toEqual({ model: 'gpt-5.1', tools: [{ name: 't', args: { n: 1 } }] });
  });

  it('drops a body larger than the cap rather than truncating it', () => {
    const huge = { messages: [{ role: 'user', content: 'x'.repeat(MAX_BODY_BYTES) }] };
    expect(scrubBody(huge)).toBeNull();
  });
});

describe('scrubProviderUrl', () => {
  it('keeps routing query parameters but removes credentials', () => {
    expect(scrubProviderUrl('https://provider.test/generate?alt=sse&key=secret-value')).toBe(
      'https://provider.test/generate?alt=sse&key=%5BREDACTED%5D',
    );
  });

  it('scrubs secrets even when the provider URL is malformed', () => {
    expect(scrubProviderUrl('not-a-url sk-ant-abcdefghijklmno')).toBe('not-a-url [REDACTED]');
  });
});

describe('toObservation', () => {
  it('builds the observe payload with the normalized provider error', () => {
    const obs = toObservation(baseInput);
    expect(obs).not.toBeNull();
    expect(obs!.traceId).toBe('trace-1');
    expect(obs!.tenantId).toBe('tenant-1');
    expect(obs!.provider).toBe('openai');
    expect(obs!.authType).toBe('api_key');
    expect(obs!.api).toBe('chat_completions');
    expect(obs!.request).toMatchObject({ model: 'gpt-5.1', temperature: 5 });
    expect(obs!.response.statusCode).toBe(400);
    expect(obs!.response.error.message).toContain('temperature');
  });

  it('keeps the caller messages, which the historical scrape never carried', () => {
    const obs = toObservation(baseInput);
    expect(obs!.request.messages).toEqual([{ role: 'user', content: 'hi' }]);
  });

  it('never leaks the agent id — it only resolves the consent gate', () => {
    const obs = toObservation(baseInput);
    expect(obs).not.toHaveProperty('agentId');
    expect(JSON.stringify(obs)).not.toContain('agent-1');
  });

  it('keeps the provider-facing model and body shape intact', () => {
    const obs = toObservation({
      ...baseInput,
      apiMode: 'messages',
      requestBody: {
        model: 'claude-opus-4-8',
        thinking: { type: 'adaptive', budget_tokens: 8192 },
      },
    });
    expect(obs!.api).toBe('messages');
    expect(obs!.request).toEqual({
      model: 'claude-opus-4-8',
      thinking: { type: 'adaptive', budget_tokens: 8192 },
    });
  });

  it('keeps a native Gemini provider exchange separate from Phoenix patch identity', () => {
    const wireBody = {
      generationConfig: { maxOutputTokens: 32000, topP: 1, temperature: 1 },
      contents: [{ role: 'user', parts: [{ text: 'hi' }] }],
    };
    const obs = toObservation({
      ...baseInput,
      provider: 'gemini',
      requestBody: { model: 'gemini-2.5-flash-lite', ...wireBody },
      providerWire: {
        format: 'google_generate_content',
        url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent',
        body: wireBody,
      },
    });
    expect(obs?.providerExchange).toEqual({
      format: 'google_generate_content',
      url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent',
      request: { body: wireBody, redactedFields: [] },
      response: {
        statusCode: 400,
        body: { error: { message: 'temperature must be <= 2', code: 'bad_param' } },
      },
    });
  });

  it('omits an absent provider URL from the exchange', () => {
    const obs = toObservation({
      ...baseInput,
      providerWire: {
        format: 'openai_chat_completions',
        body: { model: 'gpt-5.1', max_tokens: 128 },
      },
      errorBody: 'plain provider failure',
    });

    expect(obs?.providerExchange).toEqual({
      format: 'openai_chat_completions',
      request: {
        body: { model: 'gpt-5.1', max_tokens: 128 },
        redactedFields: [],
      },
      response: { statusCode: 400, body: 'plain provider failure' },
    });
  });

  it('returns null when the provider-native body is too large to ship', () => {
    expect(
      toObservation({
        ...baseInput,
        providerWire: {
          format: 'google_generate_content',
          body: { contents: [{ text: 'x'.repeat(MAX_BODY_BYTES) }] },
        },
      }),
    ).toBeNull();
  });

  it('carries the response time when measured', () => {
    expect(toObservation({ ...baseInput, responseTimeMs: 42 })!.responseTimeMs).toBe(42);
    expect(toObservation(baseInput)!.responseTimeMs).toBeUndefined();
  });

  it('returns null for a non-request-side failure', () => {
    expect(toObservation({ ...baseInput, status: 429 })).toBeNull();
  });

  it('returns null when the body is too large to ship', () => {
    const requestBody = { messages: [{ content: 'x'.repeat(MAX_BODY_BYTES) }] };
    expect(toObservation({ ...baseInput, requestBody })).toBeNull();
  });
});
