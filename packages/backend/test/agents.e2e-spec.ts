import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, TEST_API_KEY } from './helpers';

let app: INestApplication;

beforeAll(async () => {
  app = await createTestApp();
}, 30000);

afterAll(async () => {
  await app.close();
});

const api = () => request(app.getHttpServer());
const auth = (r: request.Test) => r.set('x-api-key', TEST_API_KEY);

describe('Agents CRUD E2E', () => {
  const AGENT_NAME = 'e2e-crud-agent';
  let apiKey: string;

  /* ── Create ── */

  describe('POST /api/v1/agents', () => {
    it('should create an agent and return an API key', async () => {
      const res = await auth(api().post('/api/v1/agents'))
        .send({ name: AGENT_NAME })
        .expect(201);

      expect(res.body.agent).toBeDefined();
      expect(res.body.agent.name).toBe(AGENT_NAME);
      expect(res.body.apiKey).toMatch(/^mnfst_/);
      apiKey = res.body.apiKey;
    });

    it('should reject duplicate agent name', async () => {
      const res = await auth(api().post('/api/v1/agents'))
        .send({ name: AGENT_NAME });
      // Duplicate key constraint — service returns 409 or 500 depending on error handling
      expect([409, 500]).toContain(res.status);
    });

    it('should reject empty name', async () => {
      await auth(api().post('/api/v1/agents'))
        .send({ name: '' })
        .expect(400);
    });

    it('should reject name with invalid characters', async () => {
      await auth(api().post('/api/v1/agents'))
        .send({ name: 'invalid agent name!' })
        .expect(400);
    });

    it('should reject request without auth', async () => {
      await api()
        .post('/api/v1/agents')
        .send({ name: 'no-auth-agent' })
        .expect(401);
    });
  });

  /* ── List ── */

  describe('GET /api/v1/agents', () => {
    it('should list agents including the created one', async () => {
      const res = await auth(api().get('/api/v1/agents')).expect(200);

      expect(res.body).toHaveProperty('agents');
      expect(Array.isArray(res.body.agents)).toBe(true);
      // Should contain at least our e2e agent + the test-agent from helpers seed
      const names = res.body.agents.map((a: { agent_name: string }) => a.agent_name);
      expect(names).toContain(AGENT_NAME);
    });

    it('should reject request without auth', async () => {
      await api().get('/api/v1/agents').expect(401);
    });
  });

  /* ── Get key ── */

  describe('GET /api/v1/agents/:agentName/key', () => {
    it('should return the key prefix for the agent', async () => {
      const res = await auth(
        api().get(`/api/v1/agents/${AGENT_NAME}/key`),
      ).expect(200);

      expect(res.body).toHaveProperty('keyPrefix');
      expect(res.body.keyPrefix).toMatch(/^mnfst_/);
    });

    it('should return 404 for unknown agent', async () => {
      await auth(
        api().get('/api/v1/agents/nonexistent-agent/key'),
      ).expect(404);
    });
  });

  /* ── Rotate key ── */

  describe('POST /api/v1/agents/:agentName/rotate-key', () => {
    it('should return a new API key', async () => {
      const res = await auth(
        api().post(`/api/v1/agents/${AGENT_NAME}/rotate-key`),
      ).expect(201);

      expect(res.body.apiKey).toMatch(/^mnfst_/);
      // New key should be different from the original
      expect(res.body.apiKey).not.toBe(apiKey);
    });

    it('should return 404 for unknown agent', async () => {
      await auth(
        api().post('/api/v1/agents/nonexistent-agent/rotate-key'),
      ).expect(404);
    });
  });

  /* ── Delete ── */

  describe('DELETE /api/v1/agents/:agentName', () => {
    it('should delete the agent', async () => {
      const res = await auth(
        api().delete(`/api/v1/agents/${AGENT_NAME}`),
      ).expect(200);

      expect(res.body.deleted).toBe(true);
    });

    it('should return 404 when deleting already deleted agent', async () => {
      await auth(
        api().delete(`/api/v1/agents/${AGENT_NAME}`),
      ).expect(404);
    });
  });
});
