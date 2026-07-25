import { qualifyGoogleResponse } from '../google-response-qualifier';

function sse(...payloads: Record<string, unknown>[]): Response {
  return new Response(payloads.map((payload) => `data: ${JSON.stringify(payload)}\n\n`).join(''), {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });
}

describe('qualifyGoogleResponse', () => {
  it('leaves non-success HTTP responses untouched', async () => {
    const response = new Response('rate limited', { status: 429 });

    await expect(
      qualifyGoogleResponse(response, {
        codeAssistEnvelope: false,
        timeoutMs: 1_000,
      }),
    ).resolves.toBe(response);
  });

  it('rejects a successful response with no body', async () => {
    const qualified = await qualifyGoogleResponse(new Response(null, { status: 200 }), {
      codeAssistEnvelope: false,
      timeoutMs: 1_000,
    });

    expect(qualified.status).toBe(502);
    await expect(qualified.json()).resolves.toMatchObject({
      error: { code: 'empty_response' },
    });
  });

  it('turns an empty CodeAssist MAX_TOKENS stream into a retryable provider failure', async () => {
    const response = sse({
      response: {
        candidates: [{ content: { parts: [] }, finishReason: 'MAX_TOKENS' }],
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 0 },
      },
    });

    const qualified = await qualifyGoogleResponse(response, {
      codeAssistEnvelope: true,
      timeoutMs: 1_000,
    });

    expect(qualified.status).toBe(502);
    await expect(qualified.json()).resolves.toMatchObject({
      error: {
        code: 'empty_response',
        type: 'upstream_response_error',
      },
    });
  });

  it('turns an HTTP 200 Google error event into its provider status', async () => {
    const response = sse({
      error: {
        code: 429,
        message: 'quota exhausted',
        status: 'RESOURCE_EXHAUSTED',
      },
    });

    const qualified = await qualifyGoogleResponse(response, {
      codeAssistEnvelope: false,
      timeoutMs: 1_000,
    });

    expect(qualified.status).toBe(429);
    await expect(qualified.json()).resolves.toMatchObject({
      error: {
        code: 'upstream_stream_error',
        type: 'upstream_response_error',
      },
    });
  });

  it('normalizes an HTTP 200 Google error event with unusable details', async () => {
    const qualified = await qualifyGoogleResponse(
      sse({ error: { code: 'unknown', message: '' } }),
      {
        codeAssistEnvelope: false,
        timeoutMs: 1_000,
      },
    );

    expect(qualified.status).toBe(502);
    await expect(qualified.json()).resolves.toMatchObject({
      error: {
        code: 'upstream_stream_error',
        message: 'Google provider stream failed',
      },
    });
  });

  it('ignores malformed events and rejects a later empty terminal event', async () => {
    const response = new Response(
      [
        'event: message\ndata: {not-json}\n\n',
        `data: ${JSON.stringify({
          candidates: [{ content: { parts: [] }, finishReason: 'STOP' }],
        })}\n\n`,
      ].join(''),
      {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      },
    );

    const qualified = await qualifyGoogleResponse(response, {
      codeAssistEnvelope: false,
      timeoutMs: 1_000,
    });

    expect(qualified.status).toBe(502);
  });

  it('replays every original byte across later upstream reads', async () => {
    const encoder = new TextEncoder();
    const chunks = [
      `data: ${JSON.stringify({
        response: { candidates: [{ content: { parts: [{ text: 'answer' }] } }] },
      })}\n\n`,
      `data: ${JSON.stringify({
        response: {
          candidates: [{ content: { parts: [] }, finishReason: 'STOP' }],
          usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 1 },
        },
      })}\n\n`,
    ];
    let index = 0;
    const original = chunks.join('');
    const source = new ReadableStream<Uint8Array>({
      pull(controller) {
        const chunk = chunks[index++];
        if (chunk) controller.enqueue(encoder.encode(chunk));
        else controller.close();
      },
    });

    const qualified = await qualifyGoogleResponse(
      new Response(source, {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      }),
      {
        codeAssistEnvelope: true,
        timeoutMs: 1_000,
      },
    );

    expect(qualified.status).toBe(200);
    await expect(qualified.text()).resolves.toBe(original);
  });

  it('propagates a source failure after meaningful output starts', async () => {
    const encoder = new TextEncoder();
    let failSource!: () => void;
    const failureGate = new Promise<void>((resolve) => {
      failSource = resolve;
    });
    const source = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              candidates: [{ content: { parts: [{ text: 'answer' }] } }],
            })}\n\n`,
          ),
        );
      },
      async pull(controller) {
        await failureGate;
        controller.error(new Error('late socket reset'));
      },
    });

    const qualified = await qualifyGoogleResponse(new Response(source), {
      codeAssistEnvelope: false,
      timeoutMs: 1_000,
    });
    const body = qualified.text();
    failSource();

    await expect(body).rejects.toThrow('late socket reset');
  });

  it('cancels the original stream when the replay body is canceled', async () => {
    const encoder = new TextEncoder();
    let canceledWith: unknown;
    const source = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              candidates: [{ content: { parts: [{ text: 'answer' }] } }],
            })}\n\n`,
          ),
        );
      },
      cancel(reason) {
        canceledWith = reason;
      },
    });

    const qualified = await qualifyGoogleResponse(new Response(source), {
      codeAssistEnvelope: false,
      timeoutMs: 1_000,
    });
    await qualified.body?.cancel('caller stopped');

    expect(canceledWith).toBe('caller stopped');
  });

  it('accepts a function call as meaningful output', async () => {
    const response = sse({
      candidates: [
        {
          content: {
            parts: [{ functionCall: { name: 'read_file', args: { path: 'README.md' } } }],
          },
        },
      ],
    });

    const qualified = await qualifyGoogleResponse(response, {
      codeAssistEnvelope: false,
      timeoutMs: 1_000,
    });

    expect(qualified.status).toBe(200);
  });

  it('does not expose thought-only output as a meaningful completion', async () => {
    const qualified = await qualifyGoogleResponse(
      sse({
        candidates: [
          {
            content: { parts: [{ text: 'private reasoning', thought: true }] },
            finishReason: 'MAX_TOKENS',
          },
        ],
      }),
      {
        codeAssistEnvelope: false,
        timeoutMs: 1_000,
      },
    );

    expect(qualified.status).toBe(502);
  });

  it('rejects an EOF before meaningful output', async () => {
    const qualified = await qualifyGoogleResponse(new Response(''), {
      codeAssistEnvelope: false,
      timeoutMs: 1_000,
    });

    expect(qualified.status).toBe(502);
    await expect(qualified.json()).resolves.toMatchObject({
      error: { code: 'empty_response' },
    });
  });

  it('times out a stream that never produces an event', async () => {
    const source = new ReadableStream<Uint8Array>({
      pull() {
        // Keep the provider read pending until the qualifier cancels it.
      },
    });
    const qualified = await qualifyGoogleResponse(new Response(source), {
      codeAssistEnvelope: false,
      timeoutMs: 5,
    });

    expect(qualified.status).toBe(504);
    await expect(qualified.json()).resolves.toMatchObject({
      error: { code: 'stream_timeout' },
    });
  });

  it('bounds the buffered non-output prefix', async () => {
    const qualified = await qualifyGoogleResponse(
      sse({ usageMetadata: { promptTokenCount: 100 } }),
      {
        codeAssistEnvelope: false,
        timeoutMs: 1_000,
        maxBufferSize: 8,
      },
    );

    expect(qualified.status).toBe(502);
    await expect(qualified.json()).resolves.toMatchObject({
      error: { code: 'stream_buffer_overflow' },
    });
  });

  it('turns a source read failure into a provider error', async () => {
    const source = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.error(new Error('socket reset'));
      },
    });
    const qualified = await qualifyGoogleResponse(new Response(source), {
      codeAssistEnvelope: false,
      timeoutMs: 1_000,
    });

    expect(qualified.status).toBe(502);
    await expect(qualified.json()).resolves.toMatchObject({
      error: { code: 'upstream_stream_error' },
    });
  });
});
