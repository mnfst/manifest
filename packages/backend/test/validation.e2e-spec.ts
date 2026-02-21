import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, TEST_API_KEY, TEST_OTLP_KEY } from './helpers';

let app: INestApplication;

beforeAll(async () => {
  app = await createTestApp();
}, 30000);

afterAll(async () => {
  await app.close();
});

const api = () => request(app.getHttpServer());
const auth = (r: request.Test) => r.set('x-api-key', TEST_API_KEY);
const otlpAuth = (r: request.Test) =>
  r.set('authorization', `Bearer ${TEST_OTLP_KEY}`);

/* ══════════════════════════════════════════════════
   1. INJECTION
   ══════════════════════════════════════════════════ */

describe('Injection protection', () => {
  const SQL_PAYLOADS = [
    "'; DROP TABLE agents; --",
    "1' OR '1'='1",
    "1; SELECT * FROM api_keys --",
    "' UNION SELECT key_hash FROM api_keys --",
  ];

  const XSS_PAYLOADS = [
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    '"><svg onload=alert(1)>',
  ];

  describe('SQL injection in agent name', () => {
    it.each(SQL_PAYLOADS)(
      'should reject or safely handle: %s',
      async (payload) => {
        const res = await auth(api().post('/api/v1/agents'))
          .send({ name: payload });

        // Must be 400 (validation rejects special chars) — never 500
        expect(res.status).toBe(400);
      },
    );
  });

  describe('SQL injection in query params', () => {
    it.each(SQL_PAYLOADS)(
      'costs endpoint should handle: %s',
      async (payload) => {
        const res = await auth(
          api().get(`/api/v1/costs?agent_name=${encodeURIComponent(payload)}`),
        );

        // Should not cause a 500 SQL error
        expect(res.status).not.toBe(500);
        expect([200, 400]).toContain(res.status);
      },
    );
  });

  describe('SQL injection in telemetry fields', () => {
    it('should safely handle SQL in description', async () => {
      const res = await auth(api().post('/api/v1/telemetry')).send({
        events: [
          {
            timestamp: new Date().toISOString(),
            description: "'; DROP TABLE agent_messages; --",
            service_type: 'agent',
            status: 'ok',
          },
        ],
      });

      // Should accept the data (stored as string, not interpolated)
      expect([200, 202]).toContain(res.status);
    });
  });

  describe('XSS in agent name', () => {
    it.each(XSS_PAYLOADS)(
      'should reject: %s',
      async (payload) => {
        const res = await auth(api().post('/api/v1/agents'))
          .send({ name: payload });

        // Validation rejects special chars
        expect(res.status).toBe(400);
      },
    );
  });

  describe('XSS in telemetry description', () => {
    it('should accept but store safely', async () => {
      const res = await auth(api().post('/api/v1/telemetry')).send({
        events: [
          {
            timestamp: new Date().toISOString(),
            description: '<script>alert("xss")</script>',
            service_type: 'agent',
            status: 'ok',
          },
        ],
      });

      // Telemetry accepts string data — storage is parameterized
      expect([200, 202]).toContain(res.status);
    });
  });

  describe('XSS in notification rule', () => {
    it('should handle script tags in agent_name', async () => {
      const res = await auth(api().post('/api/v1/notifications')).send({
        agent_name: '<script>alert(1)</script>',
        metric_type: 'tokens',
        threshold: 1000,
        period: 'hour',
      });

      // Either stored safely or rejected — never 500
      expect(res.status).not.toBe(500);
    });
  });
});

/* ══════════════════════════════════════════════════
   2. STRICT DTO VALIDATION
   ══════════════════════════════════════════════════ */

describe('Strict DTO validation', () => {
  /* ── Unknown properties (whitelist: true) ── */

  describe('unknown properties are stripped or rejected', () => {
    it('should reject unknown props on agent create (forbidNonWhitelisted)', async () => {
      const res = await auth(api().post('/api/v1/agents')).send({
        name: 'valid-agent',
        hackerField: 'should-be-rejected',
      });

      expect(res.status).toBe(400);
    });

    it('should reject unknown props on telemetry events', async () => {
      const res = await auth(api().post('/api/v1/telemetry')).send({
        events: [
          {
            timestamp: new Date().toISOString(),
            description: 'test',
            service_type: 'agent',
            status: 'ok',
            unknownField: 'should-fail',
          },
        ],
      });

      expect(res.status).toBe(400);
    });

    it('should reject unknown props on notification rule', async () => {
      const res = await auth(api().post('/api/v1/notifications')).send({
        agent_name: 'test-agent',
        metric_type: 'tokens',
        threshold: 1000,
        period: 'hour',
        extraField: true,
      });

      expect(res.status).toBe(400);
    });
  });

  /* ── Incorrect types ── */

  describe('incorrect types', () => {
    it('should reject string where number expected (notification threshold)', async () => {
      const res = await auth(api().post('/api/v1/notifications')).send({
        agent_name: 'test-agent',
        metric_type: 'tokens',
        threshold: 'not-a-number',
        period: 'hour',
      });

      expect(res.status).toBe(400);
    });

    it('should reject number where string expected (agent name)', async () => {
      const res = await auth(api().post('/api/v1/agents')).send({
        name: 12345,
      });

      expect(res.status).toBe(400);
    });

    it('should reject non-array events in telemetry', async () => {
      const res = await auth(api().post('/api/v1/telemetry')).send({
        events: 'not-an-array',
      });

      expect(res.status).toBe(400);
    });

    it('should reject empty events array', async () => {
      const res = await auth(api().post('/api/v1/telemetry')).send({
        events: [],
      });

      expect(res.status).toBe(400);
    });
  });

  /* ── Enum/constraint violations ── */

  describe('enum and constraint violations', () => {
    it('should reject invalid range value', async () => {
      await auth(api().get('/api/v1/costs?range=99d')).expect(400);
    });

    it('should reject invalid service_type in telemetry', async () => {
      const res = await auth(api().post('/api/v1/telemetry')).send({
        events: [
          {
            timestamp: new Date().toISOString(),
            description: 'test',
            service_type: 'invalid_type',
            status: 'ok',
          },
        ],
      });

      expect(res.status).toBe(400);
    });

    it('should reject invalid status in telemetry', async () => {
      const res = await auth(api().post('/api/v1/telemetry')).send({
        events: [
          {
            timestamp: new Date().toISOString(),
            description: 'test',
            service_type: 'agent',
            status: 'invalid_status',
          },
        ],
      });

      expect(res.status).toBe(400);
    });

    it('should reject invalid metric_type in notification', async () => {
      const res = await auth(api().post('/api/v1/notifications')).send({
        agent_name: 'test-agent',
        metric_type: 'invalid_metric',
        threshold: 1000,
        period: 'hour',
      });

      expect(res.status).toBe(400);
    });

    it('should reject invalid period in notification', async () => {
      const res = await auth(api().post('/api/v1/notifications')).send({
        agent_name: 'test-agent',
        metric_type: 'tokens',
        threshold: 1000,
        period: 'invalid_period',
      });

      expect(res.status).toBe(400);
    });

    it('should reject negative threshold', async () => {
      const res = await auth(api().post('/api/v1/notifications')).send({
        agent_name: 'test-agent',
        metric_type: 'tokens',
        threshold: -100,
        period: 'hour',
      });

      expect(res.status).toBe(400);
    });

    it('should reject invalid tier param in routing', async () => {
      const res = await auth(
        api().get('/api/v1/routing/tiers/invalid_tier'),
      );
      // Returns 400 (validation) or 404 (not found) — never 200/500
      expect([400, 404]).toContain(res.status);
    });

    it('should reject agent name over 100 chars', async () => {
      const longName = 'a'.repeat(101);
      const res = await auth(api().post('/api/v1/agents')).send({
        name: longName,
      });

      expect(res.status).toBe(400);
    });
  });

  /* ── Missing required fields ── */

  describe('missing required fields', () => {
    it('should reject agent create with empty body', async () => {
      await auth(api().post('/api/v1/agents'))
        .send({})
        .expect(400);
    });

    it('should reject telemetry without events', async () => {
      await auth(api().post('/api/v1/telemetry'))
        .send({})
        .expect(400);
    });

    it('should reject notification without required fields', async () => {
      await auth(api().post('/api/v1/notifications'))
        .send({})
        .expect(400);
    });

    it('should reject telemetry event without timestamp', async () => {
      const res = await auth(api().post('/api/v1/telemetry')).send({
        events: [
          {
            description: 'test',
            service_type: 'agent',
            status: 'ok',
          },
        ],
      });

      expect(res.status).toBe(400);
    });
  });
});

/* ══════════════════════════════════════════════════
   3. AUTH EDGE CASES
   ══════════════════════════════════════════════════ */

describe('Auth edge cases', () => {
  const PROTECTED_ENDPOINTS = [
    { method: 'get' as const, path: '/api/v1/overview' },
    { method: 'get' as const, path: '/api/v1/agents' },
    { method: 'get' as const, path: '/api/v1/costs' },
    { method: 'get' as const, path: '/api/v1/tokens' },
    { method: 'get' as const, path: '/api/v1/messages' },
    { method: 'get' as const, path: '/api/v1/security' },
    { method: 'get' as const, path: '/api/v1/model-prices' },
    { method: 'post' as const, path: '/api/v1/agents' },
    { method: 'post' as const, path: '/api/v1/telemetry' },
    { method: 'get' as const, path: '/api/v1/notifications' },
    { method: 'post' as const, path: '/api/v1/notifications' },
  ];

  describe('requests without auth header', () => {
    it.each(PROTECTED_ENDPOINTS)(
      '$method $path should return 401',
      async ({ method, path }) => {
        const res = await api()[method](path);
        expect(res.status).toBe(401);
      },
    );
  });

  /*
   * Note: Invalid API key value tests are skipped here because the E2E test
   * helper uses a MockSessionGuard that checks for x-api-key header presence
   * but does not validate the key value (that's the real ApiKeyGuard's job).
   * The real ApiKeyGuard is tested via unit tests in api-key.guard.spec.ts.
   */

  describe('OTLP auth', () => {
    it('should reject OTLP request without Authorization header', async () => {
      await api()
        .post('/otlp/v1/traces')
        .send({})
        .expect(401);
    });

    it('should reject OTLP request with invalid bearer token', async () => {
      await api()
        .post('/otlp/v1/traces')
        .set('authorization', 'Bearer invalid-token')
        .send({})
        .expect(401);
    });

    it('should reject bearer token without mnfst_ prefix', async () => {
      await api()
        .post('/otlp/v1/traces')
        .set('authorization', 'Bearer some_random_key_12345')
        .send({})
        .expect(401);
    });

    it('should reject OTLP with X-API-Key (wrong auth method)', async () => {
      await api()
        .post('/otlp/v1/traces')
        .set('x-api-key', TEST_API_KEY)
        .send({})
        .expect(401);
    });

    it('should accept valid OTLP bearer token', async () => {
      const res = await otlpAuth(api().post('/otlp/v1/traces'))
        .set('content-type', 'application/json')
        .send({});

      // Valid token — may return 200 or error from empty payload, but NOT 401
      expect(res.status).not.toBe(401);
    });
  });

  describe('public endpoints do not require auth', () => {
    it('GET /api/v1/health should return 200 without auth', async () => {
      await api().get('/api/v1/health').expect(200);
    });
  });
});

/* ══════════════════════════════════════════════════
   4. RATE LIMITING
   ══════════════════════════════════════════════════ */

/*
 * Rate limiting: The ThrottlerGuard is registered as APP_GUARD in the real
 * app.module.ts but the E2E test helper only registers MockSessionGuard.
 * Functional rate-limit tests (triggering 429) would require either the full
 * app module or a custom test setup with a very low limit. The ThrottlerModule
 * is imported (verified via app.module.ts:61 — { provide: APP_GUARD, useClass: ThrottlerGuard }).
 */
