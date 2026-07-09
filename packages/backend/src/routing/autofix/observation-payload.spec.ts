import {
  MAX_BODY_BYTES,
  isReportableStatus,
  scrubBody,
  toObservation,
  type ObservationInput,
} from './observation-payload';

const baseInput: ObservationInput = {
  traceId: 'trace-1',
  tenantId: 'tenant-1',
  provider: 'openai',
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

  it('drops a body larger than the cap rather than truncating it', () => {
    const huge = { messages: [{ role: 'user', content: 'x'.repeat(MAX_BODY_BYTES) }] };
    expect(scrubBody(huge)).toBeNull();
  });

  it('drops the body rather than ship it when scrubbing breaks the JSON', () => {
    // `"authorization":123` — the header pattern eats the unquoted number and
    // substitutes a bare `[REDACTED]`, leaving invalid JSON. Fail closed: an
    // unscrubbable body is never sent.
    expect(scrubBody({ authorization: 123 })).toBeNull();
  });
});

describe('toObservation', () => {
  it('builds the observe payload with the normalized provider error', () => {
    const obs = toObservation(baseInput);
    expect(obs).not.toBeNull();
    expect(obs!.traceId).toBe('trace-1');
    expect(obs!.tenantId).toBe('tenant-1');
    expect(obs!.provider).toBe('openai');
    expect(obs!.api).toBe('chat_completions');
    expect(obs!.request).toMatchObject({ model: 'gpt-5.1', temperature: 5 });
    expect(obs!.response.statusCode).toBe(400);
    expect(obs!.response.error.message).toContain('temperature');
  });

  it('keeps the caller messages, which the historical scrape never carried', () => {
    const obs = toObservation(baseInput);
    expect(obs!.request.messages).toEqual([{ role: 'user', content: 'hi' }]);
  });

  it('substitutes the resolved model for a routing alias', () => {
    const obs = toObservation({
      ...baseInput,
      requestBody: { ...baseInput.requestBody, model: 'auto' },
      resolvedModel: 'gpt-5.1',
    });
    expect(obs!.request.model).toBe('gpt-5.1');
  });

  it('leaves the model alone when it already matches the resolved one', () => {
    const obs = toObservation({ ...baseInput, resolvedModel: 'gpt-5.1' });
    expect(obs!.request.model).toBe('gpt-5.1');
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
