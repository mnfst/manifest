'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DEFAULT_MARKER, runCanary, failureReport } = require('./gateway-response-canary');

const TRACE_ID = '0123456789abcdef0123456789abcdef';

function sseResponse(text = DEFAULT_MARKER, options = {}) {
  const events = [
    `event: message_start\ndata: ${JSON.stringify({
      type: 'message_start',
      message: { model: 'canary-model' },
    })}\n\n`,
    `event: content_block_start\ndata: ${JSON.stringify({
      type: 'content_block_start',
      index: 0,
      content_block: { type: 'text', text: '' },
    })}\n\n`,
    `event: content_block_delta\ndata: ${JSON.stringify({
      type: 'content_block_delta',
      index: 0,
      delta: { type: 'text_delta', text },
    })}\n\n`,
    `event: content_block_stop\ndata: ${JSON.stringify({
      type: 'content_block_stop',
      index: 0,
    })}\n\n`,
    `event: message_delta\ndata: ${JSON.stringify({
      type: 'message_delta',
      delta: { stop_reason: 'end_turn' },
      usage: { output_tokens: 8 },
    })}\n\n`,
  ];
  if (!options.truncated) {
    events.push('event: message_stop\ndata: {"type":"message_stop"}\n\n');
  }

  return new Response(events.join(''), {
    status: options.status ?? 200,
    headers: { 'x-manifest-trace-id': options.traceId ?? TRACE_ID },
  });
}

test('canary accepts an exact, well-formed Anthropic stream and returns metadata only', async () => {
  let requestBody;
  const result = await runCanary({
    baseUrl: 'https://manifest.example',
    apiKey: 'secret-test-key',
    fetchImpl: async (_url, init) => {
      requestBody = JSON.parse(init.body);
      return sseResponse();
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.terminal_event, 'message_stop');
  assert.equal(result.text_characters, DEFAULT_MARKER.length);
  assert.equal(result.trace_id, TRACE_ID);
  assert.equal(result.response_model, 'canary-model');
  assert.ok(!JSON.stringify(result).includes(DEFAULT_MARKER));
  assert.ok(!JSON.stringify(result).includes('secret-test-key'));
  assert.equal(requestBody.temperature, undefined);
});

test('canary rejects a text mismatch without returning response content', async () => {
  let error;
  try {
    await runCanary({
      baseUrl: 'https://manifest.example',
      apiKey: 'secret-test-key',
      fetchImpl: async () => sseResponse('unexpected private output'),
    });
  } catch (caught) {
    error = caught;
  }

  const report = failureReport(error);
  assert.equal(report.error_code, 'unexpected_text_digest');
  assert.equal(report.actual_sha256.length, 64);
  assert.equal(report.text_characters, 'unexpected private output'.length);
  assert.ok(!JSON.stringify(report).includes('unexpected private output'));
  assert.ok(!JSON.stringify(report).includes(DEFAULT_MARKER));
  assert.ok(!JSON.stringify(report).includes('secret-test-key'));
});

test('canary rejects a truncated stream even when its text matches', async () => {
  await assert.rejects(
    () =>
      runCanary({
        baseUrl: 'https://manifest.example',
        apiKey: 'secret-test-key',
        fetchImpl: async () => sseResponse(DEFAULT_MARKER, { truncated: true }),
      }),
    (error) => error.code === 'missing_message_stop',
  );
});

test('canary rejects malformed SSE without exposing its payload', async () => {
  const response = new Response('event: message_start\ndata: not-json\n\n', {
    status: 200,
    headers: { 'x-manifest-trace-id': TRACE_ID },
  });
  let error;
  try {
    await runCanary({
      baseUrl: 'https://manifest.example',
      apiKey: 'secret-test-key',
      fetchImpl: async () => response,
    });
  } catch (caught) {
    error = caught;
  }

  const report = failureReport(error);
  assert.equal(report.error_code, 'malformed_sse_json');
  assert.equal(report.malformed_events, 1);
  assert.equal(report.trace_id, TRACE_ID);
  assert.equal(report.status, 200);
  assert.ok(!JSON.stringify(report).includes('not-json'));
});

test('canary requires the response correlation trace ID', async () => {
  await assert.rejects(
    () =>
      runCanary({
        baseUrl: 'https://manifest.example',
        apiKey: 'secret-test-key',
        fetchImpl: async () => sseResponse(DEFAULT_MARKER, { traceId: 'missing' }),
      }),
    (error) => error.code === 'missing_trace_id',
  );
});

test('canary reports an HTTP failure without reading or printing its body', async () => {
  const privateBody = 'private provider error body';
  let bodyCancelled = false;
  const body = new ReadableStream({
    cancel() {
      bodyCancelled = true;
    },
  });
  let error;
  try {
    await runCanary({
      baseUrl: 'https://manifest.example',
      apiKey: 'secret-test-key',
      fetchImpl: async () =>
        new Response(body, {
          status: 502,
          headers: { 'x-manifest-trace-id': TRACE_ID, 'x-private-test-body': privateBody },
        }),
    });
  } catch (caught) {
    error = caught;
  }

  const report = failureReport(error);
  assert.equal(report.error_code, 'unexpected_http_status');
  assert.equal(report.status, 502);
  assert.equal(report.trace_id, TRACE_ID);
  assert.equal(bodyCancelled, true);
  assert.ok(!JSON.stringify(report).includes(privateBody));
  assert.ok(!JSON.stringify(report).includes('secret-test-key'));
});
