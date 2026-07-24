import { qualifyGoogleResponse } from '../google-response-qualifier';

function sse(...payloads: Record<string, unknown>[]): Response {
  return new Response(payloads.map((payload) => `data: ${JSON.stringify(payload)}\n\n`).join(''), {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });
}

describe('qualifyGoogleResponse', () => {
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

  it('replays every original byte after the first meaningful text part', async () => {
    const original = [
      `data: ${JSON.stringify({
        response: { candidates: [{ content: { parts: [{ text: 'answer' }] } }] },
      })}\n\n`,
      `data: ${JSON.stringify({
        response: {
          candidates: [{ content: { parts: [] }, finishReason: 'STOP' }],
          usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 1 },
        },
      })}\n\n`,
    ].join('');

    const qualified = await qualifyGoogleResponse(
      new Response(original, {
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
});
