/**
 * Phase 2 end-to-end coverage (issues #1617, #1612, #1450). These tests
 * exercise the full proxy path — bearer auth → token estimate → size
 * check → routing — for the three failure modes users reported:
 *
 *   1. Normal-size request: the scored-tier primary is used, new context
 *      headers are emitted.
 *   2. Oversized request: the scored tier can't fit, so the router
 *      escalates to a bigger-context tier and forwards there.
 *   3. Payload bigger than every connected model: user gets the friendly
 *      "context_window_exceeded" message instead of a silent truncation
 *      or an opaque provider 400.
 */
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { createTestApp, TEST_AGENT_ID, TEST_API_KEY, TEST_OTLP_KEY } from './helpers';
import { PricingSyncService } from '../src/database/pricing-sync.service';
import { ModelPricingCacheService } from '../src/model-prices/model-pricing-cache.service';
import { TierAutoAssignService } from '../src/routing/routing-core/tier-auto-assign.service';
import { RoutingCacheService } from '../src/routing/routing-core/routing-cache.service';

let app: INestApplication;

const api = () => request(app.getHttpServer());
const bearer = (r: request.Test) => r.set('Authorization', `Bearer ${TEST_OTLP_KEY}`);

beforeAll(async () => {
  app = await createTestApp();

  const pricingSync = app.get(PricingSyncService);
  const orCache = pricingSync.getAll() as Map<
    string,
    { input: number; output: number; contextWindow?: number }
  >;
  orCache.set('openai/gpt-4o-mini', {
    input: 0.00000015,
    output: 0.0000006,
    contextWindow: 128_000,
  });
  orCache.set('anthropic/claude-opus-4-6', {
    input: 0.000015,
    output: 0.000075,
    contextWindow: 200_000,
  });
  await app.get(ModelPricingCacheService).reload();

  await api()
    .post('/api/v1/routing/test-agent/providers')
    .set('x-api-key', TEST_API_KEY)
    .send({ provider: 'openai', apiKey: 'sk-fake-openai' })
    .expect(201);
  await api()
    .post('/api/v1/routing/test-agent/providers')
    .set('x-api-key', TEST_API_KEY)
    .send({ provider: 'anthropic', apiKey: 'sk-fake-anthropic' })
    .expect(201);

  const ds = app.get(DataSource);
  const openaiModels = JSON.stringify([
    {
      id: 'gpt-4o-mini',
      displayName: 'gpt-4o-mini',
      provider: 'openai',
      contextWindow: 128_000,
      inputPricePerToken: 0.00000015,
      outputPricePerToken: 0.0000006,
      capabilityReasoning: false,
      capabilityCode: true,
      qualityScore: 2,
    },
  ]);
  const anthropicModels = JSON.stringify([
    {
      id: 'claude-opus-4-6',
      displayName: 'claude-opus-4-6',
      provider: 'anthropic',
      contextWindow: 200_000,
      inputPricePerToken: 0.000015,
      outputPricePerToken: 0.000075,
      capabilityReasoning: true,
      capabilityCode: true,
      qualityScore: 5,
    },
  ]);
  await ds.query(
    `UPDATE user_providers SET cached_models = $1 WHERE agent_id = $2 AND provider = $3`,
    [openaiModels, TEST_AGENT_ID, 'openai'],
  );
  await ds.query(
    `UPDATE user_providers SET cached_models = $1 WHERE agent_id = $2 AND provider = $3`,
    [anthropicModels, TEST_AGENT_ID, 'anthropic'],
  );

  const autoAssign = app.get(TierAutoAssignService);
  await autoAssign.recalculate(TEST_AGENT_ID);
}, 30000);

afterAll(async () => {
  await app.close();
});

describe('Context-aware routing — Phase 2 (#1617)', () => {
  it('returns the friendly context_window_exceeded response when nothing fits', async () => {
    // Trigger the size check via max_tokens instead of payload size — a
    // huge max_tokens eats every model's context budget and makes the
    // request unable to fit anywhere, which is the exact class of
    // failure #1617 reports. Keeps the HTTP body tiny so we don't trip
    // express.json's limit.
    const res = await bearer(api().post('/v1/chat/completions'))
      .set('Accept', 'text/event-stream')
      .send({
        messages: [{ role: 'user', content: 'hello' }],
        max_tokens: 5_000_000,
      })
      .expect(200);

    const content = res.body.choices[0].message.content;
    expect(content).toContain('200,000');
    expect(content).toContain('Manifest');
    expect(content).not.toContain('no providers are set up yet');
  });

  it('surfaces the context-exceeded reason to non-chat clients too', async () => {
    // Without the Accept: text/event-stream header the exception filter
    // classifies us as a CI/monitor caller. The response body is still a
    // chat-completion envelope because buildFriendlyResponse keeps the
    // shape consistent across client types.
    const res = await bearer(api().post('/v1/chat/completions'))
      .send({
        messages: [{ role: 'user', content: 'hello' }],
        max_tokens: 5_000_000,
      })
      .expect(200);

    expect(res.body.choices[0].message.content).toContain('200,000');
  });

  /**
   * The fix I was asked to defend: before the rewrite, the exceeded
   * message merged input tokens and the reserved-output budget into a
   * single "Request needs ~N tokens" number, so when the blocker was
   * `max_tokens` (e.g. a caller asking for 5M output tokens on a 5-char
   * prompt), the message read nonsensically — it told users to "shorten
   * the conversation" with no hint that the real problem was their
   * max_tokens parameter. This asserts both the input total and the
   * reserved-output breakdown are present in the body so the message is
   * actionable. Anchors are "Request needs" + "reserved for output" —
   * the exact token count depends on the estimator's safety multiplier
   * and would make the test brittle otherwise.
   */
  it('breaks input vs reserved-output in the exceeded message when max_tokens is the blocker', async () => {
    const res = await bearer(api().post('/v1/chat/completions'))
      .set('Accept', 'text/event-stream')
      .send({
        messages: [{ role: 'user', content: 'hello' }],
        max_tokens: 5_000_000,
      })
      .expect(200);

    const content = res.body.choices[0].message.content as string;
    // Key anchors — the message must break out the components.
    expect(content).toMatch(/Request needs/);
    expect(content).toMatch(/reserved for output/);
    expect(content).toMatch(/input/);
    // And must include the explicit 5,000,000 reserved-output token count
    // so the user sees *their* max_tokens number reflected back.
    expect(content).toContain('5,000,000');
  });
});

/**
 * User-journey regression coverage for the top three issues users opened
 * against Phase 2 — #1617 (fuzhyperblue, "200K configured, routed to
 * 128K"), the RFC's cross-tier escalation promise, and the happy-path
 * signal contract EthanFrostpro asked for. These tests are anchored to
 * the *reported complaint*, not to implementation lines — they protect
 * the user-visible behaviour regardless of how the resolver is refactored.
 *
 * Upstream provider calls are stubbed with a canned 200 response so
 * tests stay deterministic and don't depend on network / provider keys.
 */
describe('Context-aware routing — user-journey scenarios', () => {
  const api2 = () => request(app.getHttpServer());
  const bearer2 = (r: request.Test) => r.set('Authorization', `Bearer ${TEST_OTLP_KEY}`);

  /** Minimal OpenAI-compatible chat completion body for upstream stubs. */
  const makeCompletionBody = (model: string) =>
    JSON.stringify({
      id: 'chatcmpl-stub',
      object: 'chat.completion',
      created: 1_700_000_000,
      model,
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: 'ok' },
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    });

  let originalFetch: typeof global.fetch;

  beforeAll(async () => {
    // Install an upstream stub that returns a canned 200 for any provider
    // call (OpenAI, Anthropic, Google). OpenRouter pricing calls would
    // already be served from cache since createTestApp pre-loaded it.
    originalFetch = global.fetch;
    global.fetch = (async (
      input: Parameters<typeof fetch>[0],
      init?: Parameters<typeof fetch>[1],
    ): Promise<Response> => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      // Any provider completion endpoint — return a deterministic 200.
      if (
        url.includes('api.openai.com') ||
        url.includes('api.anthropic.com') ||
        url.includes('generativelanguage.googleapis.com')
      ) {
        return new Response(makeCompletionBody('stubbed'), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return originalFetch(input, init);
    }) as typeof fetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  /**
   * Cleanup: any per-test tier overrides / fallback lists are rolled back
   * so tests don't pollute one another. We restore the seeded baseline by
   * resetting overrides + re-running auto-assign.
   */
  afterEach(async () => {
    const ds = app.get(DataSource);
    await ds.query(
      `UPDATE tier_assignments SET override_model = NULL, override_provider = NULL,
         override_auth_type = NULL, fallback_models = NULL WHERE agent_id = $1`,
      [TEST_AGENT_ID],
    );
    app.get(RoutingCacheService).invalidateAgent(TEST_AGENT_ID);
    await app.get(TierAutoAssignService).recalculate(TEST_AGENT_ID);
    app.get(RoutingCacheService).invalidateAgent(TEST_AGENT_ID);
  });

  it('Hermes user with a 200K fallback keeps the 200K model when the 128K primary is too small (#1617 fuzhyperblue)', async () => {
    // fuzhyperblue on #1617: "I have the 200K Opus configured as fallback
    // for standard tier, but Manifest still routed my 150K conversation
    // to gpt-4o-mini (128K) and it got silently truncated."  After Phase
    // 2, the resolver must skip the too-small primary and pick the
    // within-tier fallback; the response must advertise the 200K window
    // it actually used, and must NOT claim an escalation happened.
    await api2()
      .put(`/api/v1/routing/test-agent/tiers/simple/fallbacks`)
      .set('x-api-key', TEST_API_KEY)
      .send({ models: ['claude-opus-4-6'] })
      .expect(200);

    const res = await bearer2(api2().post('/v1/chat/completions'))
      .send({
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 150_000,
        stream: false,
      });

    // Whatever the upstream result, Manifest's routing headers must be
    // set before we forward. The key assertion is `Context-Used`.
    expect(res.headers['x-manifest-context-used']).toBe('200000');
    // Same tier — no escalation header expected.
    expect(res.headers['x-manifest-context-escalated']).toBeUndefined();
    // The routed model must be the 200K fallback, not the 128K primary.
    expect(res.headers['x-manifest-model']).toBe('claude-opus-4-6');
  });

  it('escalates across tiers with an ASCII-arrow header when no model in the scored tier fits (#1617 RFC)', async () => {
    // The RFC in #1617 promises: "if the scored tier is simple and the
    // request is 200K, the router must escalate upward to a tier whose
    // model can handle it, and the escalation must be visible to the
    // client via a response header." This test pins standard tier to a
    // 200K model so that a simple-scored oversized request walks
    // simple (128K, unfit) → standard (200K, fits).
    await api2()
      .put(`/api/v1/routing/test-agent/tiers/standard`)
      .set('x-api-key', TEST_API_KEY)
      .send({ model: 'claude-opus-4-6', provider: 'anthropic' })
      .expect(200);

    const res = await bearer2(api2().post('/v1/chat/completions'))
      .send({
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 150_000,
        stream: false,
      });

    // Escalation header must use ASCII arrow — Unicode → would be
    // silently stripped by Node's http layer (manually smoked 2026-04-22).
    expect(res.headers['x-manifest-context-escalated']).toBe('simple->standard');
    expect(res.headers['x-manifest-context-escalated']).not.toContain('→');
    expect(res.headers['x-manifest-model']).toBe('claude-opus-4-6');
    expect(res.headers['x-manifest-tier']).toBe('standard');
  });

  it('emits Context-Estimated and Context-Used on a happy-path request, without any Escalated header (#1617 EthanFrostpro)', async () => {
    // EthanFrostpro asked on #1617 for an agent-readable signal so agents
    // can adapt compaction mid-conversation without a second round trip:
    // "just give me the model's context window in a response header."
    // On a normal, within-tier request, Estimated + Used must be set,
    // and Escalated must be absent (otherwise every client would log
    // escalations that never happened).
    const res = await bearer2(api2().post('/v1/chat/completions'))
      .send({
        messages: [{ role: 'user', content: 'hi' }],
        stream: false,
      });

    expect(res.headers['x-manifest-context-estimated']).toBeDefined();
    const estimated = Number(res.headers['x-manifest-context-estimated']);
    expect(Number.isFinite(estimated)).toBe(true);
    expect(estimated).toBeGreaterThan(0);
    expect(estimated).toBeLessThan(1_000); // trivial "hi" must not inflate

    expect(res.headers['x-manifest-context-used']).toBeDefined();
    const used = Number(res.headers['x-manifest-context-used']);
    expect(Number.isFinite(used)).toBe(true);
    expect(used).toBeGreaterThanOrEqual(128_000);

    // Happy path = no escalation. If this leaks, clients log false alarms.
    expect(res.headers['x-manifest-context-escalated']).toBeUndefined();
  });
});
