import assert from 'node:assert/strict';
import { test } from 'node:test';

const baseUrl = process.env.MANIFEST_BASE_URL;

if (!baseUrl) {
  throw new Error('MANIFEST_BASE_URL is required');
}

async function post(path, body) {
  const response = await fetch(new URL(path, baseUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  const text = await response.text();
  let responseBody;

  try {
    responseBody = JSON.parse(text);
  } catch {
    assert.fail(`${path} returned non-JSON response: ${text}`);
  }

  return { status: response.status, body: responseBody, text };
}

function assertAuthenticationRequired(path, result) {
  assert.equal(
    result.status,
    401,
    `${path} returned HTTP ${result.status} instead of 401: ${result.text}`,
  );
  assert.equal(
    result.body?.error?.type,
    'auth_error',
    `${path} did not return the gateway authentication error: ${result.text}`,
  );
}

test('POST /v1/chat/completions remains available', async () => {
  const result = await post('/v1/chat/completions', {
    model: 'auto',
    messages: [{ role: 'user', content: 'hello' }],
  });

  assertAuthenticationRequired('/v1/chat/completions', result);
});

test('POST /v1/responses remains available', async () => {
  const result = await post('/v1/responses', {
    model: 'auto',
    input: 'hello',
  });

  assertAuthenticationRequired('/v1/responses', result);
});
