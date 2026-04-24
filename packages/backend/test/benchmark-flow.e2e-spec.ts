import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { createTestApp, TEST_AGENT_ID, TEST_API_KEY } from './helpers';
import { PricingSyncService } from '../src/database/pricing-sync.service';
import { ModelPricingCacheService } from '../src/model-prices/model-pricing-cache.service';

let app: INestApplication;
let originalFetch: typeof fetch;

beforeAll(async () => {
  app = await createTestApp();

  // Seed pricing so benchmark cost computation has data to work with
  const pricingSync = app.get(PricingSyncService);
  (
    pricingSync.getAll() as Map<
      string,
      { input: number; output: number; contextWindow?: number }
    >
  ).set('openai/gpt-4o-mini', {
    input: 0.00000015,
    output: 0.0000006,
    contextWindow: 128000,
  });
  await app.get(ModelPricingCacheService).reload();

  // Connect the openai provider for TEST_AGENT_ID
  await request(app.getHttpServer())
    .post('/api/v1/routing/test-agent/providers')
    .set('x-api-key', TEST_API_KEY)
    .send({ provider: 'openai', apiKey: 'sk-fake-test-key' })
    .expect(201);
}, 30000);

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  originalFetch = global.fetch;
});

afterEach(() => {
  global.fetch = originalFetch;
});

const api = () => request(app.getHttpServer());
const auth = (r: request.Test) => r.set('x-api-key', TEST_API_KEY);

function stubOpenAiChat(body: Record<string, unknown>, init: ResponseInit = { status: 200 }): void {
  const prev = global.fetch;
  global.fetch = (async (input: Parameters<typeof fetch>[0], opts?: Parameters<typeof fetch>[1]) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (url.includes('api.openai.com') && url.includes('chat/completions')) {
      return new Response(JSON.stringify(body), {
        status: init.status ?? 200,
        headers: { 'content-type': 'application/json', 'x-ratelimit-remaining-requests': '49' },
      });
    }
    return prev(input, opts);
  }) as typeof fetch;
}

describe('Benchmark E2E — POST /api/v1/benchmark/run', () => {
  it('returns content + metrics and records an agent_messages row on happy path', async () => {
    stubOpenAiChat({
      choices: [{ message: { content: 'hello world' } }],
      usage: { prompt_tokens: 7, completion_tokens: 3 },
    });

    const res = await auth(api().post('/api/v1/benchmark/run'))
      .send({
        agentName: 'test-agent',
        model: 'gpt-4o-mini',
        provider: 'openai',
        authType: 'api_key',
        messages: [{ role: 'user', content: 'say hi' }],
      })
      .expect(201);

    expect(res.body.content).toBe('hello world');
    expect(res.body.metrics).toMatchObject({ inputTokens: 7, outputTokens: 3 });
    expect(typeof res.body.metrics.durationMs).toBe('number');
    expect(res.body.headers['x-ratelimit-remaining-requests']).toBe('49');
    expect(res.body.headers['set-cookie']).toBeUndefined();

    const ds = app.get(DataSource);
    const rows = await ds.query(
      `SELECT routing_reason, routing_tier, status, provider, model, input_tokens, output_tokens FROM agent_messages WHERE agent_id = $1 AND routing_tier = $2`,
      [TEST_AGENT_ID, 'benchmark'],
    );
    expect(rows.length).toBe(1);
    expect(rows[0]).toMatchObject({
      routing_tier: 'benchmark',
      routing_reason: null,
      status: 'ok',
      provider: 'openai',
      model: 'gpt-4o-mini',
      input_tokens: 7,
      output_tokens: 3,
    });
  });

  it('returns 404 when the requested provider is not connected for this agent', async () => {
    const res = await auth(api().post('/api/v1/benchmark/run'))
      .send({
        agentName: 'test-agent',
        model: 'claude-sonnet-4',
        provider: 'anthropic',
        authType: 'api_key',
        messages: [{ role: 'user', content: 'say hi' }],
      })
      .expect(404);

    expect(res.body.message).toContain('anthropic');
  });

  it('returns 404 when the agent does not belong to the current user', async () => {
    await auth(api().post('/api/v1/benchmark/run'))
      .send({
        agentName: 'someone-elses-agent',
        model: 'gpt-4o-mini',
        provider: 'openai',
        authType: 'api_key',
        messages: [{ role: 'user', content: 'say hi' }],
      })
      .expect(404);
  });

  it('returns 400 when messages payload is missing', async () => {
    await auth(api().post('/api/v1/benchmark/run'))
      .send({
        agentName: 'test-agent',
        model: 'gpt-4o-mini',
        provider: 'openai',
        authType: 'api_key',
      })
      .expect(400);
  });
});

describe('Benchmark history — GET /api/v1/benchmark/runs', () => {
  it('lists runs after successful benchmarks and replays a run by id', async () => {
    stubOpenAiChat({
      choices: [{ message: { content: 'one' } }],
      usage: { prompt_tokens: 2, completion_tokens: 1 },
    });

    const runId = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';

    await auth(api().post('/api/v1/benchmark/run'))
      .send({
        agentName: 'test-agent',
        model: 'gpt-4o-mini',
        provider: 'openai',
        authType: 'api_key',
        messages: [{ role: 'user', content: 'hello there' }],
        runId,
        position: 0,
      })
      .expect(201);

    stubOpenAiChat({
      choices: [{ message: { content: 'two' } }],
      usage: { prompt_tokens: 3, completion_tokens: 2 },
    });
    await auth(api().post('/api/v1/benchmark/run'))
      .send({
        agentName: 'test-agent',
        model: 'gpt-4o-mini',
        provider: 'openai',
        authType: 'api_key',
        messages: [{ role: 'user', content: 'hello there' }],
        runId,
        position: 1,
      })
      .expect(201);

    const list = await auth(api().get('/api/v1/benchmark/runs').query({ agentName: 'test-agent' }))
      .expect(200);
    const runs = list.body as Array<{ id: string; prompt: string; modelCount: number }>;
    const target = runs.find((r) => r.id === runId);
    expect(target).toBeDefined();
    expect(target?.prompt).toBe('hello there');
    expect(target?.modelCount).toBe(2);

    const detail = await auth(api().get(`/api/v1/benchmark/runs/${runId}`)).expect(200);
    expect(detail.body.columns).toHaveLength(2);
    const contents = detail.body.columns.map((c: { content: string }) => c.content);
    expect(contents).toEqual(expect.arrayContaining(['one', 'two']));
    expect(detail.body.columns[0].position).toBeLessThan(detail.body.columns[1].position);
  });

  it('returns 404 when the run id does not belong to the current user', async () => {
    await auth(api().get('/api/v1/benchmark/runs/bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb')).expect(404);
  });

  it('returns 400 for a malformed run id', async () => {
    await auth(api().get('/api/v1/benchmark/runs/not-a-uuid')).expect(400);
  });
});
