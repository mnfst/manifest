import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { createTestApp, TEST_API_KEY, TEST_USER_ID, TEST_TENANT_ID } from './helpers';
import { sqlNow } from '../src/common/utils/postgres-sql';
import { v4 as uuid } from 'uuid';
import { PricingSyncService } from '../src/database/pricing-sync.service';
import { ModelPricingCacheService } from '../src/model-prices/model-pricing-cache.service';

interface CacheLike {
  del?: (key: string) => Promise<unknown> | unknown;
  reset?: () => Promise<unknown> | unknown;
  clear?: () => Promise<unknown> | unknown;
  store?: { reset?: () => Promise<unknown> | unknown };
}

let app: INestApplication;

async function clearCache(): Promise<void> {
  const cache = app.get<CacheLike>(CACHE_MANAGER);
  // cache-manager v5 exposes reset(); v6 exposes clear(); legacy versions
  // tucked it under .store.reset(). Try whichever the runtime provides so
  // the test stays resilient across the upstream API churn.
  if (typeof cache.clear === 'function') {
    await cache.clear();
  } else if (typeof cache.reset === 'function') {
    await cache.reset();
  } else if (cache.store && typeof cache.store.reset === 'function') {
    await cache.store.reset();
  }
}

beforeAll(async () => {
  app = await createTestApp();

  const ds = app.get(DataSource);
  const now = sqlNow();

  // Populate PricingSyncService cache with gpt-4o pricing
  const pricingSync = app.get(PricingSyncService);
  (pricingSync.getAll() as Map<string, { input: number; output: number; contextWindow?: number }>).set('openai/gpt-4o', {
    input: 0.0000025,
    output: 0.00001,
    contextWindow: 128000,
  });

  // Reload pricing cache from OpenRouter cache + manual pricing
  await app.get(ModelPricingCacheService).reload();

  // Seed agent_messages directly (with pre-calculated cost_usd) using the same
  // timestamp format as sqlNow() so that date comparisons line up with the
  // Postgres `timestamp without time zone` columns the analytics queries read.
  const costUsd1 = 5000 * 0.0000025 + 2000 * 0.00001; // 0.0325
  const costUsd2 = 3000 * 0.0000025 + 1000 * 0.00001; // 0.0175
  await ds.query(
    `INSERT INTO agent_messages (id, timestamp, description, service_type, status, model, input_tokens, output_tokens, cost_usd, user_id, tenant_id, agent_name)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [uuid(), now, 'Cost query 1', 'agent', 'ok', 'gpt-4o', 5000, 2000, costUsd1, TEST_USER_ID, TEST_TENANT_ID, null],
  );
  await ds.query(
    `INSERT INTO agent_messages (id, timestamp, description, service_type, status, model, input_tokens, output_tokens, cost_usd, user_id, tenant_id, agent_name)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [uuid(), now, 'Cost query 2', 'agent', 'ok', 'gpt-4o', 3000, 1000, costUsd2, TEST_USER_ID, TEST_TENANT_ID, null],
  );
}, 30000);

afterAll(async () => {
  await app.close();
});

const api = () => request(app.getHttpServer());
const auth = (r: request.Test) => r.set('x-api-key', TEST_API_KEY);

describe('GET /api/v1/costs', () => {
  it('should return cost data with all sections', async () => {
    const res = await auth(api().get('/api/v1/costs?range=24h')).expect(200);

    expect(res.body).toHaveProperty('summary');
    expect(res.body.summary).toHaveProperty('weekly_cost');
    expect(res.body).toHaveProperty('daily');
    expect(res.body).toHaveProperty('hourly');
    expect(res.body).toHaveProperty('by_model');
    expect(Array.isArray(res.body.daily)).toBe(true);
    expect(Array.isArray(res.body.hourly)).toBe(true);
    expect(Array.isArray(res.body.by_model)).toBe(true);
  });

  it('should return non-zero cost from seeded data', async () => {
    const res = await auth(api().get('/api/v1/costs?range=24h')).expect(200);

    const totalCost = Number(res.body.summary.weekly_cost.value);
    expect(totalCost).toBeGreaterThan(0);
  });

  it('should accept different range values', async () => {
    for (const range of ['1h', '6h', '24h', '7d', '30d']) {
      const res = await auth(
        api().get(`/api/v1/costs?range=${range}`),
      ).expect(200);
      expect(res.body).toHaveProperty('summary');
    }
  });

  it('should filter by agent_name', async () => {
    const res = await auth(
      api().get('/api/v1/costs?range=24h&agent_name=test-agent'),
    ).expect(200);

    expect(res.body).toHaveProperty('summary');
    expect(res.body.summary.weekly_cost).toHaveProperty('value');
  });

  it('should return zero cost for unknown agent', async () => {
    const res = await auth(
      api().get('/api/v1/costs?range=24h&agent_name=nonexistent'),
    ).expect(200);

    const totalCost = Number(res.body.summary.weekly_cost.value);
    expect(totalCost).toBe(0);
  });

  it('should default to 7d range when not specified', async () => {
    const res = await auth(api().get('/api/v1/costs')).expect(200);
    expect(res.body).toHaveProperty('summary');
  });

  it('should reject invalid range value', async () => {
    await auth(api().get('/api/v1/costs?range=99d')).expect(400);
  });

  it('should reject request without auth with 401', async () => {
    await api().get('/api/v1/costs?range=24h').expect(401);
  });
});

describe('GET /api/v1/costs - range validation edge cases', () => {
  // RangeQueryDto uses class-validator @IsIn(['1h','6h','24h','7d','30d']).
  // Anything outside that fixed set must fail validation with 400.
  it('should reject range=0h (zero-magnitude)', async () => {
    await auth(api().get('/api/v1/costs?range=0h')).expect(400);
  });

  it('should reject range=-1h (negative)', async () => {
    await auth(api().get('/api/v1/costs?range=-1h')).expect(400);
  });

  it('should reject range=24h30m (trailing garbage)', async () => {
    await auth(api().get('/api/v1/costs?range=24h30m')).expect(400);
  });

  it('should reject range=24H (case-sensitive whitelist)', async () => {
    // @IsIn is case-sensitive: '24H' is not in the lowercase whitelist.
    await auth(api().get('/api/v1/costs?range=24H')).expect(400);
  });
});

describe('GET /api/v1/costs - numeric edge cases', () => {
  // Seed extra rows that exercise the zero-token and large-token boundaries.
  // These run AFTER the main describe so the existing tests' assertions
  // (which only check shape or `> 0`) remain valid.
  beforeAll(async () => {
    const ds = app.get(DataSource);
    const now = sqlNow();

    // Row with all zeros — must not crash the query nor poison cost summary.
    await ds.query(
      `INSERT INTO agent_messages (id, timestamp, description, service_type, status, model, input_tokens, output_tokens, cost_usd, user_id, tenant_id, agent_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        '11111111-1111-4111-8111-111111111111',
        now,
        'Zero tokens edge case',
        'agent',
        'ok',
        'gpt-4o',
        0,
        0,
        0,
        TEST_USER_ID,
        TEST_TENANT_ID,
        null,
      ],
    );

    // Row with the max value PostgreSQL `integer` columns accept (2^31 - 1).
    // Anything larger would error at the driver level — verifying the upper
    // boundary is what the column type allows.
    await ds.query(
      `INSERT INTO agent_messages (id, timestamp, description, service_type, status, model, input_tokens, output_tokens, cost_usd, user_id, tenant_id, agent_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        '22222222-2222-4222-8222-222222222222',
        now,
        'Max int32 tokens edge case',
        'agent',
        'ok',
        'gpt-4o',
        2147483647,
        0,
        1.5,
        TEST_USER_ID,
        TEST_TENANT_ID,
        null,
      ],
    );

    // Cross-tenant row — must NEVER appear in the test user's results.
    await ds.query(
      `INSERT INTO tenants (id, name, organization_name, is_active, created_at, updated_at) VALUES ($1,$2,$3,true,$4,$5)`,
      ['other-tenant-001', 'other-user-001', 'Other Org', now, now],
    );
    await ds.query(
      `INSERT INTO agent_messages (id, timestamp, description, service_type, status, model, input_tokens, output_tokens, cost_usd, user_id, tenant_id, agent_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        '33333333-3333-4333-8333-333333333333',
        now,
        'Other tenant cost',
        'agent',
        'ok',
        'gpt-4o',
        1000,
        500,
        99.99,
        'other-user-001',
        'other-tenant-001',
        null,
      ],
    );

    // UserCacheInterceptor caches GET /costs responses for 30s keyed by
    // userId+URL. Earlier tests in this file populated that cache with the
    // pre-seed state; wipe it so the new rows are reflected.
    await clearCache();
  });

  it('should include zero-token rows without producing NaN/null cost', async () => {
    const res = await auth(api().get('/api/v1/costs?range=24h')).expect(200);

    const value = res.body.summary.weekly_cost.value;
    expect(value).not.toBeNull();
    expect(value).not.toBeUndefined();
    expect(Number.isNaN(Number(value))).toBe(false);
    expect(Number.isFinite(Number(value))).toBe(true);
    expect(Number(value)).toBeGreaterThanOrEqual(0);
  });

  it('should sum max int32 token rows without numeric overflow', async () => {
    const res = await auth(api().get('/api/v1/costs?range=24h')).expect(200);

    // by_model aggregates SUM(input_tokens + output_tokens). With one row at
    // 2^31-1 plus seeded rows (5000+2000 + 3000+1000 = 11000) plus the zero
    // row (0), the gpt-4o total is 2_147_494_647. JS Number can represent
    // this exactly (well below 2^53).
    const gpt4o = (
      res.body.by_model as Array<{ model: string; tokens: number; estimated_cost: number }>
    ).find((m) => m.model === 'gpt-4o');
    expect(gpt4o).toBeDefined();
    expect(Number.isFinite(gpt4o!.tokens)).toBe(true);
    expect(gpt4o!.tokens).toBe(2147483647 + 11000);
    expect(Number.isFinite(gpt4o!.estimated_cost)).toBe(true);
    // 0.0325 + 0.0175 + 0 + 1.5 = 1.55 with floating-point tolerance.
    expect(gpt4o!.estimated_cost).toBeCloseTo(1.55, 5);
  });

  it('should not leak rows from other tenants in cost summary', async () => {
    const res = await auth(api().get('/api/v1/costs?range=24h')).expect(200);

    const totalCost = Number(res.body.summary.weekly_cost.value);
    // Cross-tenant row had cost_usd=99.99. If isolation broke, total would
    // exceed 99. Sum of our rows is 0.0325 + 0.0175 + 0 + 1.5 = 1.55.
    expect(totalCost).toBeLessThan(50);
    expect(totalCost).toBeCloseTo(1.55, 5);
  });
});
