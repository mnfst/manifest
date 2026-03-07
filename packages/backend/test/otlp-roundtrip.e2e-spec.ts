import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, TEST_API_KEY, TEST_OTLP_KEY } from './helpers';

let app: INestApplication;

const AUTH_HEADER = `Bearer ${TEST_OTLP_KEY}`;

function makeCurrentTimeNano(): string {
  return (BigInt(Date.now()) * 1_000_000n).toString();
}

function makeTracePayload() {
  const startNano = makeCurrentTimeNano();
  const endNano = (BigInt(startNano) + 1_000_000_000n).toString();

  return {
    resourceSpans: [
      {
        resource: {
          attributes: [
            { key: 'service.name', value: { stringValue: 'agent' } },
            { key: 'agent.name', value: { stringValue: 'test-agent' } },
          ],
        },
        scopeSpans: [
          {
            scope: { name: 'roundtrip-test' },
            spans: [
              {
                traceId: 'aabb112233445566aabb112233445566',
                spanId: 'cc11223344556677',
                name: 'openclaw.agent.turn',
                kind: 1,
                startTimeUnixNano: startNano,
                endTimeUnixNano: endNano,
                attributes: [
                  { key: 'gen_ai.usage.input_tokens', value: { intValue: 2000 } },
                  { key: 'gen_ai.usage.output_tokens', value: { intValue: 1000 } },
                ],
                status: { code: 1 },
              },
            ],
          },
        ],
      },
    ],
  };
}

beforeAll(async () => {
  app = await createTestApp();
});

afterAll(async () => {
  await app.close();
});

describe('OTLP ingest-then-query round-trip', () => {
  beforeAll(async () => {
    // Ingest OTLP traces with current-time timestamps
    await request(app.getHttpServer())
      .post('/otlp/v1/traces')
      .set('Authorization', AUTH_HEADER)
      .send(makeTracePayload())
      .expect(200);
  });

  it('filters ghost duplicate from same batch', async () => {
    // Get baseline message count
    const before = await request(app.getHttpServer())
      .get('/api/v1/messages?range=24h')
      .set('x-api-key', TEST_API_KEY)
      .expect(200);
    const baselineCount = before.body.total_count;

    const startNano = makeCurrentTimeNano();
    const endNano = (BigInt(startNano) + 1_000_000_000n).toString();

    const batchPayload = {
      resourceSpans: [
        {
          resource: {
            attributes: [
              { key: 'service.name', value: { stringValue: 'agent' } },
              { key: 'agent.name', value: { stringValue: 'test-agent' } },
            ],
          },
          scopeSpans: [
            {
              scope: { name: 'ghost-test' },
              spans: [
                {
                  traceId: 'ddee112233445566ddee112233445566',
                  spanId: 'ff11223344556677',
                  name: 'openclaw.agent.turn',
                  kind: 1,
                  startTimeUnixNano: startNano,
                  endTimeUnixNano: endNano,
                  attributes: [
                    { key: 'gen_ai.request.model', value: { stringValue: 'gpt-4o' } },
                    { key: 'gen_ai.usage.input_tokens', value: { intValue: 1000 } },
                    { key: 'gen_ai.usage.output_tokens', value: { intValue: 500 } },
                  ],
                  status: { code: 1 },
                },
                {
                  traceId: 'eeff112233445566eeff112233445566',
                  spanId: 'aa11223344556677',
                  name: 'openclaw.agent.turn',
                  kind: 1,
                  startTimeUnixNano: startNano,
                  endTimeUnixNano: endNano,
                  attributes: [],
                  status: { code: 1 },
                },
              ],
            },
          ],
        },
      ],
    };

    await request(app.getHttpServer())
      .post('/otlp/v1/traces')
      .set('Authorization', AUTH_HEADER)
      .send(batchPayload)
      .expect(200);

    const after = await request(app.getHttpServer())
      .get('/api/v1/messages?range=24h')
      .set('x-api-key', TEST_API_KEY)
      .expect(200);

    // Only 1 message should be added (ghost filtered), not 2
    expect(after.body.total_count).toBe(baselineCount + 1);
  });

  it('overview reflects OTLP-ingested data', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/overview?range=24h')
      .set('x-api-key', TEST_API_KEY)
      .expect(200);

    // This catches the tenant mismatch bug: OTLP data uses tenant_id,
    // and only the tenants.name = :userId path resolves it.
    expect(res.body.has_data).toBe(true);
    expect(res.body.summary.messages.value).toBeGreaterThan(0);
  });
});
