// Contract tests for the vendored healer (healer/heal.mjs).
//
// Self-contained: imports the exported Express app directly (no child
// processes, no fixed ports) and binds ephemeral ports via listen(0). The
// HEALER_API_KEY variant is tested by re-importing the module under a fresh
// specifier (query string) after setting the env var — Node treats that as a
// distinct module evaluation, giving us a second, independently-configured
// instance.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

const KEY = 'test-healer-key-123';

// Import order matters: the keyless instance must be evaluated while
// HEALER_API_KEY is unset; the keyed instance afterwards with it set.
const keyless = await import('../heal.mjs?instance=keyless');
process.env.HEALER_API_KEY = KEY;
const keyed = await import(`../heal.mjs?instance=keyed-${Date.now()}`);
delete process.env.HEALER_API_KEY;

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      servers.push(server);
      resolve(`http://127.0.0.1:${server.address().port}`);
    });
  });
}

const servers = [];
let base;
let authBase;

before(async () => {
  base = await listen(keyless.app);
  authBase = await listen(keyed.app);
});

after(async () => {
  await Promise.all(
    servers.map(
      (s) =>
        new Promise((resolve) => {
          if (!s.listening) return resolve();
          s.close(() => resolve());
        }),
    ),
  );
});

async function post(url, body, headers = {}) {
  return fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

function healBody(overrides = {}) {
  return {
    traceId: 'trace-contract-test',
    tenantId: 'tenant-test',
    provider: 'openai',
    model: 'gpt-4o',
    authType: 'api_key',
    api: 'openai',
    request: { model: 'gpt-4o', messages: [{ role: 'user', content: 'hi' }], top_p: 0 },
    response: { statusCode: 400, error: { message: 'top_p must be greater than 0' } },
    ...overrides,
  };
}

// ── GET /api/health ───────────────────────────────────────────
test('GET /api/health reports ok with >= 10 rules loaded', async () => {
  const res = await fetch(`${base}/api/health`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, 'ok');
  assert.ok(body.rulesLoaded >= 10, `rulesLoaded >= 10, got ${body.rulesLoaded}`);
});

// ── POST /api/heal ────────────────────────────────────────────
test('POST /api/heal with no matching rule returns no_patch', async () => {
  const res = await post(`${base}/api/heal`, healBody({
    request: { model: 'gpt-4o', messages: [{ role: 'user', content: 'hi' }] },
    response: { statusCode: 400, error: { message: 'some unrelated provider error' } },
  }));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, 'no_patch');
  assert.match(body.issueId, /^issue_no_match_/);
});

test('POST /api/heal with top_p:0 returns patched body without top_p and with operations', async () => {
  const res = await post(`${base}/api/heal`, healBody());
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, 'patched');
  assert.ok(body.issueId);
  assert.ok(body.healAttemptId, 'healAttemptId present');
  assert.equal(body.healedBody.top_p, undefined, 'top_p removed from healedBody');
  assert.ok(Array.isArray(body.operations) && body.operations.length > 0, 'operations present');
  assert.equal(body.explanation.source, 'deterministic');
  assert.equal(body.retryAfterMs, 0);
});

test('POST /api/heal without traceId returns 400', async () => {
  const { traceId, ...rest } = healBody();
  const res = await post(`${base}/api/heal`, rest);
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error, 'traceId is required');
});

// ── rotate_key on key/quota failures ────────────────────────────
test('POST /api/heal with 429 status (no message) returns patched with rotate_key op and unchanged body', async () => {
  const request = { model: 'gpt-4o', messages: [{ role: 'user', content: 'hi' }] };
  const res = await post(`${base}/api/heal`, healBody({
    request,
    response: { statusCode: 429, error: { message: '' } },
  }));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, 'patched');
  assert.ok(
    body.operations.some((op) => op.type === 'rotate_key'),
    'operations contain rotate_key',
  );
  assert.deepEqual(body.healedBody, request, 'healedBody unchanged');
});

test('POST /api/heal with 400 + /quota/ message returns patched with rotate_key op', async () => {
  const res = await post(`${base}/api/heal`, healBody({
    // Clean request: healBody()'s default top_p:0 would match top_p_zero
    // (first rule wins), which is correct but not what this case targets.
    request: { model: 'gpt-4o', messages: [{ role: 'user', content: 'hi' }] },
    response: { statusCode: 400, error: { message: 'You have exceeded your quota. Please check your plan.' } },
  }));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, 'patched');
  assert.ok(
    body.operations.some((op) => op.type === 'rotate_key'),
    'operations contain rotate_key',
  );
});

test('POST /api/heal with an existing-rule message still uses that rule (rotate_key must not shadow body patches)', async () => {
  const res = await post(`${base}/api/heal`, healBody({
    request: {
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'hi' }],
      tools: [{ type: 'function', function: { name: 'f', parameters: { type: 'null' } } }],
    },
    response: { statusCode: 400, error: { message: 'schema must be a JSON Schema, got null' } },
  }));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, 'patched');
  assert.equal(body.patchId, 'patch_invalid_function_schema', 'specific rule wins');
  assert.ok(body.operations.length > 0, 'operations present');
  assert.ok(
    !body.operations.some((op) => op.type === 'rotate_key'),
    'operations do NOT contain rotate_key',
  );
});

test('POST /api/heal with 500 status stays no_patch (out of scope)', async () => {
  const res = await post(`${base}/api/heal`, healBody({
    response: { statusCode: 500, error: { message: 'rate limit hit on upstream' } },
  }));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, 'no_patch');
  assert.match(body.issueId, /^issue_out_of_scope/);
});

// ── PATCH /api/heal-attempts/:id ───────────────────────────────
test('PATCH /api/heal-attempts/:id roundtrips a heal attempt', async () => {
  const healRes = await post(`${base}/api/heal`, healBody());
  const heal = await healRes.json();
  assert.equal(heal.status, 'patched');

  const res = await fetch(`${base}/api/heal-attempts/${heal.healAttemptId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ retryStatusCode: 200 }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.healAttemptId, heal.healAttemptId);
  assert.equal(body.status, 'succeeded');
  assert.equal(body.issueStatus, 'verified');
});

test('PATCH /api/heal-attempts/:id with unknown id returns 404', async () => {
  const res = await fetch(`${base}/api/heal-attempts/attempt_nope`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ retryStatusCode: 200 }),
  });
  assert.equal(res.status, 404);
});

// ── POST /api/heal/observe ─────────────────────────────────────
test('POST /api/heal/observe accepts an array and counts observed', async () => {
  const res = await post(`${base}/api/heal/observe`, [
    { traceId: 't1', tenantId: 'ten', provider: 'openai', api: 'openai', authType: 'api_key' },
    { traceId: 't2', tenantId: 'ten', provider: 'anthropic', api: 'anthropic', authType: 'api_key' },
  ]);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, 'ok');
  assert.equal(body.observed, 2);
});

test('POST /api/heal/observe accepts a single object', async () => {
  const res = await post(`${base}/api/heal/observe`, {
    traceId: 't-single',
    tenantId: 'ten',
    provider: 'openai',
    api: 'openai',
    authType: 'api_key',
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, 'ok');
  assert.equal(body.observed, 1);
});

test('POST /api/heal/observe accepts the { observations: [...] } envelope', async () => {
  // The Manifest HttpHealingClient posts this shape.
  const res = await post(`${base}/api/heal/observe`, {
    observations: [
      { traceId: 't-env-1', tenantId: 'ten', provider: 'openai', api: 'openai', authType: 'api_key' },
    ],
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, 'ok');
  assert.equal(body.observed, 1);
});

// ── x-api-key enforcement (HEALER_API_KEY set) ─────────────────
test('keyed instance rejects /api/heal without x-api-key', async () => {
  const res = await post(`${authBase}/api/heal`, healBody());
  assert.equal(res.status, 401);
});

test('keyed instance accepts /api/heal with matching x-api-key', async () => {
  const res = await post(`${authBase}/api/heal`, healBody(), { 'x-api-key': KEY });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, 'patched');
});

test('keyed instance still serves /api/health without a key', async () => {
  const res = await fetch(`${authBase}/api/health`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, 'ok');
});

test('keyless instance serves /api/heal without a key (backward compatible)', async () => {
  const res = await post(`${base}/api/heal`, healBody());
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, 'patched');
});

// ── Module import guard ────────────────────────────────────────
test('module does not self-listen on import', () => {
  // Importing must not have bound the default port 3100; the app we use here
  // was listen()ed on an ephemeral port by this test file only.
  assert.ok(base.startsWith('http://127.0.0.1:'));
  assert.notEqual(new URL(base).port, '3100');
});

// ── reasoning_content cache tests ──────────────────────────────
test('reasoning_content filled from cache', async () => {
  const res = await post(`${base}/api/heal`, healBody({
    request: {
      model: 'deepseek-v4-flash',
      messages: [
        { role: 'user', content: 'hello' },
        {
          role: 'assistant',
          tool_calls: [{ id: 'call_42', type: 'function', function: { name: 'x', arguments: '{}' } }],
        },
      ],
    },
    response: { statusCode: 400, error: { message: 'The reasoning_content in the thinking mode must be passed back to the API.' } },
    reasoningContentCache: { call_42: 'the original reasoning' },
  }));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, 'patched');
  assert.equal(body.patchId, 'patch_reasoning_content_missing');
  assert.equal(body.healedBody.messages[1].reasoning_content, 'the original reasoning');
});

test('reasoning_content falls back to empty string when cache miss', async () => {
  const res = await post(`${base}/api/heal`, healBody({
    request: {
      model: 'deepseek-v4-flash',
      messages: [
        { role: 'user', content: 'hello' },
        {
          role: 'assistant',
          tool_calls: [{ id: 'call_99', type: 'function', function: { name: 'x', arguments: '{}' } }],
        },
      ],
    },
    response: { statusCode: 400, error: { message: 'The reasoning_content in the thinking mode must be passed back to the API.' } },
    reasoningContentCache: {},
  }));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, 'patched');
  assert.equal(body.patchId, 'patch_reasoning_content_missing');
  assert.equal(body.healedBody.messages[1].reasoning_content, '');
});

test('reasoning_content rule does not match non-reasoning errors', async () => {
  const res = await post(`${base}/api/heal`, healBody({
    request: { model: 'deepseek-v4-flash', messages: [{ role: 'user', content: 'hi' }] },
    response: { statusCode: 400, error: { message: 'invalid model' } },
  }));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, 'no_patch');
});

test('existing rules still work (top_p_zero) with ctx param change', async () => {
  const res = await post(`${base}/api/heal`, healBody());
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, 'patched');
  assert.equal(body.patchId, 'patch_top_p_zero');
  assert.equal(body.healedBody.top_p, undefined);
});
