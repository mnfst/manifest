import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, TEST_OTLP_KEY } from './helpers';

let app: INestApplication;

beforeAll(async () => {
  app = await createTestApp();
});

afterAll(async () => {
  await app.close();
});

const AUTH_HEADER = `Bearer ${TEST_OTLP_KEY}`;

function makeTracePayload(overrides?: Record<string, unknown>) {
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
            scope: { name: 'test-scope' },
            spans: [
              {
                traceId: 'abcdef1234567890abcdef1234567890',
                spanId: '1234567890abcdef',
                name: 'agent-message-span',
                kind: 1,
                startTimeUnixNano: '1708070400000000000',
                endTimeUnixNano: '1708070401000000000',
                attributes: [],
                status: { code: 1 },
                ...overrides,
              },
            ],
          },
        ],
      },
    ],
  };
}

describe('POST /otlp/v1/traces', () => {
  it('accepts valid trace payload and returns 200', async () => {
    const res = await request(app.getHttpServer())
      .post('/otlp/v1/traces')
      .set('Authorization', AUTH_HEADER)
      .send(makeTracePayload())
      .expect(200);

    expect(res.body).toBeDefined();
  });

  it('rejects request without auth header with 401', async () => {
    const origMode = process.env['MANIFEST_MODE'];
    delete process.env['MANIFEST_MODE'];
    try {
      await request(app.getHttpServer())
        .post('/otlp/v1/traces')
        .send(makeTracePayload())
        .expect(401);
    } finally {
      if (origMode !== undefined) process.env['MANIFEST_MODE'] = origMode;
    }
  });

  it('rejects request with wrong API key with 401', async () => {
    await request(app.getHttpServer())
      .post('/otlp/v1/traces')
      .set('Authorization', 'Bearer wrong-key')
      .send(makeTracePayload())
      .expect(401);
  });

  it('classifies LLM call spans by gen_ai.system attribute', async () => {
    const payload = makeTracePayload({
      name: 'llm-call',
      attributes: [
        { key: 'gen_ai.system', value: { stringValue: 'anthropic' } },
        { key: 'gen_ai.request.model', value: { stringValue: 'claude-opus-4-6' } },
        { key: 'gen_ai.usage.input_tokens', value: { intValue: 500 } },
        { key: 'gen_ai.usage.output_tokens', value: { intValue: 200 } },
      ],
    });

    await request(app.getHttpServer())
      .post('/otlp/v1/traces')
      .set('Authorization', AUTH_HEADER)
      .send(payload)
      .expect(200);
  });

  it('classifies tool execution spans by tool.name attribute', async () => {
    const payload = makeTracePayload({
      name: 'tool-exec',
      attributes: [
        { key: 'tool.name', value: { stringValue: 'web_search' } },
      ],
    });

    await request(app.getHttpServer())
      .post('/otlp/v1/traces')
      .set('Authorization', AUTH_HEADER)
      .send(payload)
      .expect(200);
  });

  it('handles error status spans', async () => {
    const payload = makeTracePayload({
      status: { code: 2, message: 'Rate limit exceeded' },
    });

    await request(app.getHttpServer())
      .post('/otlp/v1/traces')
      .set('Authorization', AUTH_HEADER)
      .send(payload)
      .expect(200);
  });
});

describe('POST /otlp/v1/metrics', () => {
  it('accepts token usage metrics', async () => {
    const res = await request(app.getHttpServer())
      .post('/otlp/v1/metrics')
      .set('Authorization', AUTH_HEADER)
      .send({
        resourceMetrics: [
          {
            resource: {
              attributes: [
                { key: 'agent.name', value: { stringValue: 'test-agent' } },
              ],
            },
            scopeMetrics: [
              {
                scope: { name: 'test' },
                metrics: [
                  {
                    name: 'gen_ai.usage.input_tokens',
                    gauge: {
                      dataPoints: [
                        {
                          timeUnixNano: '1708070400000000000',
                          asInt: 1500,
                        },
                      ],
                    },
                  },
                ],
              },
            ],
          },
        ],
      })
      .expect(200);

    expect(res.body).toBeDefined();
  });

  it('accepts cost metrics', async () => {
    await request(app.getHttpServer())
      .post('/otlp/v1/metrics')
      .set('Authorization', AUTH_HEADER)
      .send({
        resourceMetrics: [
          {
            resource: {
              attributes: [
                { key: 'agent.name', value: { stringValue: 'test-agent' } },
              ],
            },
            scopeMetrics: [
              {
                scope: { name: 'test' },
                metrics: [
                  {
                    name: 'gen_ai.cost.usd',
                    gauge: {
                      dataPoints: [
                        {
                          timeUnixNano: '1708070400000000000',
                          asDouble: 0.0045,
                          attributes: [
                            { key: 'gen_ai.request.model', value: { stringValue: 'claude-opus-4-6' } },
                          ],
                        },
                      ],
                    },
                  },
                ],
              },
            ],
          },
        ],
      })
      .expect(200);
  });

  it('rejects without auth', async () => {
    const origMode = process.env['MANIFEST_MODE'];
    delete process.env['MANIFEST_MODE'];
    try {
      await request(app.getHttpServer())
        .post('/otlp/v1/metrics')
        .send({ resourceMetrics: [] })
        .expect(401);
    } finally {
      if (origMode !== undefined) process.env['MANIFEST_MODE'] = origMode;
    }
  });
});

describe('POST /otlp/v1/logs', () => {
  it('accepts log records', async () => {
    const res = await request(app.getHttpServer())
      .post('/otlp/v1/logs')
      .set('Authorization', AUTH_HEADER)
      .send({
        resourceLogs: [
          {
            resource: {
              attributes: [
                { key: 'service.name', value: { stringValue: 'test-agent' } },
              ],
            },
            scopeLogs: [
              {
                scope: { name: 'test' },
                logRecords: [
                  {
                    timeUnixNano: '1708070400000000000',
                    severityNumber: 9,
                    severityText: 'INFO',
                    body: { stringValue: 'Agent started processing request' },
                    attributes: [
                      { key: 'agent.name', value: { stringValue: 'test-agent' } },
                    ],
                    traceId: 'abcdef1234567890abcdef1234567890',
                    spanId: '1234567890abcdef',
                  },
                ],
              },
            ],
          },
        ],
      })
      .expect(200);

    expect(res.body).toBeDefined();
  });

  it('handles log records with severity number only', async () => {
    await request(app.getHttpServer())
      .post('/otlp/v1/logs')
      .set('Authorization', AUTH_HEADER)
      .send({
        resourceLogs: [
          {
            resource: { attributes: [] },
            scopeLogs: [
              {
                scope: { name: 'test' },
                logRecords: [
                  {
                    timeUnixNano: '1708070400000000000',
                    severityNumber: 17,
                    body: { stringValue: 'Error occurred' },
                  },
                ],
              },
            ],
          },
        ],
      })
      .expect(200);
  });

  it('rejects without auth', async () => {
    const origMode = process.env['MANIFEST_MODE'];
    delete process.env['MANIFEST_MODE'];
    try {
      await request(app.getHttpServer())
        .post('/otlp/v1/logs')
        .send({ resourceLogs: [] })
        .expect(401);
    } finally {
      if (origMode !== undefined) process.env['MANIFEST_MODE'] = origMode;
    }
  });
});
