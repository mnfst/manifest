import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { v4 as uuid } from 'uuid';
import request from 'supertest';
import { createTestApp, TEST_API_KEY, TEST_TENANT_ID, TEST_AGENT_ID } from './helpers';

let app: INestApplication;

beforeAll(async () => {
  app = await createTestApp();

  // Seed test data via direct DB inserts
  const ds = app.get(DataSource);
  const now = new Date().toISOString().replace('T', ' ').replace('Z', '').slice(0, 19);

  await ds.query(
    `INSERT INTO agent_messages (id, tenant_id, agent_id, timestamp, status, model, input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens, description, service_type, agent_name, user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
    [uuid(), TEST_TENANT_ID, TEST_AGENT_ID, now, 'ok', 'claude-opus-4-6', 2000, 1000, 0, 0, 'Chat message processed', 'agent', 'test-agent', 'test-user-001'],
  );

  await ds.query(
    `INSERT INTO agent_messages (id, tenant_id, agent_id, timestamp, status, model, input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens, description, service_type, agent_name, user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
    [uuid(), TEST_TENANT_ID, TEST_AGENT_ID, now, 'error', 'gpt-4o', 500, 0, 0, 0, 'Browser scrape failed', 'browser', 'test-agent', 'test-user-001'],
  );

  await ds.query(
    `INSERT INTO agent_messages (id, tenant_id, agent_id, timestamp, status, model, input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens, description, service_type, agent_name, user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
    [uuid(), TEST_TENANT_ID, TEST_AGENT_ID, now, 'ok', 'whisper-large', 0, 300, 0, 0, 'Voice transcription completed', 'voice', 'test-agent', 'test-user-001'],
  );
});

afterAll(async () => {
  await app.close();
});

describe('GET /api/v1/messages', () => {
  it('returns paginated message list', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/messages?range=24h')
      .set('x-api-key', TEST_API_KEY)
      .expect(200);

    expect(res.body).toHaveProperty('items');
    expect(res.body).toHaveProperty('total_count');
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBeGreaterThan(0);
  });

  it('returns message details with expected fields', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/messages?range=24h')
      .set('x-api-key', TEST_API_KEY)
      .expect(200);

    const item = res.body.items[0];
    expect(item).toHaveProperty('id');
    expect(item).toHaveProperty('timestamp');
    expect(item).toHaveProperty('description');
    expect(item).toHaveProperty('service_type');
    expect(item).toHaveProperty('status');
  });

  it('filters by provider', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/messages?range=24h&provider=openai')
      .set('x-api-key', TEST_API_KEY)
      .expect(200);

    expect(
      res.body.items.every((item: Record<string, string>) => item['model'] === 'gpt-4o'),
    ).toBe(true);
  });

  it('filters by service_type', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/messages?range=24h&service_type=agent')
      .set('x-api-key', TEST_API_KEY)
      .expect(200);

    expect(
      res.body.items.every((item: Record<string, string>) => item['service_type'] === 'agent'),
    ).toBe(true);
  });

  it('respects limit parameter', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/messages?range=24h&limit=1')
      .set('x-api-key', TEST_API_KEY)
      .expect(200);

    expect(res.body.items.length).toBeLessThanOrEqual(1);
  });

  it('supports cursor-based pagination', async () => {
    const res1 = await request(app.getHttpServer())
      .get('/api/v1/messages?range=24h&limit=1')
      .set('x-api-key', TEST_API_KEY)
      .expect(200);

    if (res1.body.next_cursor) {
      const res2 = await request(app.getHttpServer())
        .get(`/api/v1/messages?range=24h&limit=1&cursor=${res1.body.next_cursor}`)
        .set('x-api-key', TEST_API_KEY)
        .expect(200);

      expect(res2.body.items.length).toBeGreaterThan(0);
      expect(res2.body.items[0].id).not.toBe(res1.body.items[0].id);
    }
  });

  it('includes feedback_rating in message rows', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/messages?range=24h')
      .set('x-api-key', TEST_API_KEY)
      .expect(200);

    const item = res.body.items[0];
    expect(item).toHaveProperty('feedback_rating');
    expect(item.feedback_rating).toBeNull();
  });

  it('filters to successful messages with status=ok', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/messages?range=24h&status=ok')
      .set('x-api-key', TEST_API_KEY)
      .expect(200);

    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.items.every((item: Record<string, string>) => item['status'] === 'ok')).toBe(
      true,
    );
  });

  it('filters to error messages with status=error', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/messages?range=24h&status=error')
      .set('x-api-key', TEST_API_KEY)
      .expect(200);

    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.items.every((item: Record<string, string>) => item['status'] === 'error')).toBe(
      true,
    );
  });

  it('filters to all error variants with status=errors', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/messages?range=24h&status=errors')
      .set('x-api-key', TEST_API_KEY)
      .expect(200);

    expect(res.body.items.length).toBeGreaterThan(0);
    for (const item of res.body.items) {
      expect(['error', 'fallback_error', 'rate_limited']).toContain(item['status']);
    }
  });

  it('rejects an invalid status value with 400', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/messages?range=24h&status=bogus')
      .set('x-api-key', TEST_API_KEY)
      .expect(400);
  });
});

describe('PATCH /api/v1/messages/:id/feedback', () => {
  let messageId: string;

  beforeAll(async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/messages?range=24h&limit=1')
      .set('x-api-key', TEST_API_KEY)
      .expect(200);
    messageId = res.body.items[0].id;
  });

  it('sets like feedback', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/messages/${messageId}/feedback`)
      .set('x-api-key', TEST_API_KEY)
      .send({ rating: 'like' })
      .expect(204);

    const details = await request(app.getHttpServer())
      .get(`/api/v1/messages/${messageId}/details`)
      .set('x-api-key', TEST_API_KEY)
      .expect(200);

    expect(details.body.message.feedback_rating).toBe('like');
    expect(details.body.message.feedback_tags).toBeNull();
    expect(details.body.message.feedback_details).toBeNull();
  });

  it('sets dislike feedback with tags and details', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/messages/${messageId}/feedback`)
      .set('x-api-key', TEST_API_KEY)
      .send({
        rating: 'dislike',
        tags: ['Too slow', 'Buggy'],
        details: 'Response was very slow',
      })
      .expect(204);

    const details = await request(app.getHttpServer())
      .get(`/api/v1/messages/${messageId}/details`)
      .set('x-api-key', TEST_API_KEY)
      .expect(200);

    expect(details.body.message.feedback_rating).toBe('dislike');
    expect(details.body.message.feedback_tags).toEqual(['Too slow', 'Buggy']);
    expect(details.body.message.feedback_details).toBe('Response was very slow');
  });

  it('rejects invalid rating', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/messages/${messageId}/feedback`)
      .set('x-api-key', TEST_API_KEY)
      .send({ rating: 'neutral' })
      .expect(400);
  });

  it('rejects missing rating', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/messages/${messageId}/feedback`)
      .set('x-api-key', TEST_API_KEY)
      .send({})
      .expect(400);
  });

  it('returns 404 for non-existent message', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/messages/non-existent-id/feedback')
      .set('x-api-key', TEST_API_KEY)
      .send({ rating: 'like' })
      .expect(404);
  });
});

describe('GET /api/v1/messages/:id/details — request_headers', () => {
  it('returns null request_headers for messages stored without them', async () => {
    const list = await request(app.getHttpServer())
      .get('/api/v1/messages?range=24h&limit=1')
      .set('x-api-key', TEST_API_KEY)
      .expect(200);
    const id = list.body.items[0].id;

    const details = await request(app.getHttpServer())
      .get(`/api/v1/messages/${id}/details`)
      .set('x-api-key', TEST_API_KEY)
      .expect(200);

    expect(details.body.message.request_headers).toBeNull();
    expect(details.body.message.caller_attribution).toBeNull();
  });

  it('returns the stored headers verbatim', async () => {
    const ds = app.get(DataSource);
    const id = uuid();
    const now = new Date().toISOString().replace('T', ' ').replace('Z', '').slice(0, 19);
    const headers = { 'user-agent': 'curl/8.14.1', 'x-custom-foo': 'bar' };

    await ds.query(
      `INSERT INTO agent_messages (id, tenant_id, agent_id, timestamp, status, model, input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens, description, service_type, agent_name, user_id, request_headers)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        id,
        TEST_TENANT_ID,
        TEST_AGENT_ID,
        now,
        'ok',
        'gpt-4o',
        10,
        5,
        0,
        0,
        'Headers test',
        'agent',
        'test-agent',
        'test-user-001',
        JSON.stringify(headers),
      ],
    );

    const details = await request(app.getHttpServer())
      .get(`/api/v1/messages/${id}/details`)
      .set('x-api-key', TEST_API_KEY)
      .expect(200);

    expect(details.body.message.request_headers).toEqual(headers);
  });
});

describe('DELETE /api/v1/messages/:id/feedback', () => {
  let messageId: string;

  beforeAll(async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/messages?range=24h&limit=1')
      .set('x-api-key', TEST_API_KEY)
      .expect(200);
    messageId = res.body.items[0].id;

    // Set feedback first
    await request(app.getHttpServer())
      .patch(`/api/v1/messages/${messageId}/feedback`)
      .set('x-api-key', TEST_API_KEY)
      .send({ rating: 'dislike', tags: ['Other'], details: 'test' })
      .expect(204);
  });

  it('clears all feedback', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/messages/${messageId}/feedback`)
      .set('x-api-key', TEST_API_KEY)
      .expect(204);

    const details = await request(app.getHttpServer())
      .get(`/api/v1/messages/${messageId}/details`)
      .set('x-api-key', TEST_API_KEY)
      .expect(200);

    expect(details.body.message.feedback_rating).toBeNull();
    expect(details.body.message.feedback_tags).toBeNull();
    expect(details.body.message.feedback_details).toBeNull();
  });

  it('returns 404 for non-existent message', async () => {
    await request(app.getHttpServer())
      .delete('/api/v1/messages/non-existent-id/feedback')
      .set('x-api-key', TEST_API_KEY)
      .expect(404);
  });
});
