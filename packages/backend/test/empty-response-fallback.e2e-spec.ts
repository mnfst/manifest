/**
 * End-to-end reproduction for #2709 — a provider returning HTTP 200 with an
 * empty `content` (and no `tool_calls`) must advance the fallback chain
 * instead of being recorded as a success.
 *
 * Drives a real /v1/chat/completions request through the full proxy stack
 * (resolver, fallback chain, response handler, recorder) and asserts on the
 * rows that land in `agent_messages`.
 */
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { createTestApp, TEST_AGENT_ID, TEST_OTLP_KEY, TEST_TENANT_ID, TEST_USER_ID } from './helpers';
import { encrypt, getEncryptionSecret } from '../src/common/utils/crypto.util';
import { RoutingCacheService } from '../src/routing/routing-core/routing-cache.service';

let app: INestApplication;
let originalFetch: typeof global.fetch;
const calls: { url: string; status: number }[] = [];

const PRIMARY_MODEL = 'gpt-4o-mini';
const FALLBACK_MODEL = 'claude-sonnet-4';

beforeAll(async () => {
    app = await createTestApp();

    const ds = app.get(DataSource);
    const secret = getEncryptionSecret();
    const enc = (s: string) => encrypt(s, secret);
    const now = new Date().toISOString().replace('T', ' ').replace('Z', '').slice(0, 19);

    // Two real (registry) providers so the cleanup that deactivates unsupported
    // subscription rows leaves them alone:
    //   - openai    / api_key   (primary — returns empty 200)
    //   - anthropic / api_key   (fallback — returns real content)
    await ds.query(
        `INSERT INTO tenant_providers
       (id, tenant_id, created_by_user_id, agent_id, provider, auth_type, api_key_encrypted, is_active, connected_at, updated_at, key_prefix, cached_models)
     VALUES ($1,$2,$3,$4,$5,$6,$7,true,$8,$8,$9,$10)`,
        [
            'up-empty-primary',
            TEST_TENANT_ID,
            TEST_USER_ID,
            TEST_AGENT_ID,
            'openai',
            'api_key',
            enc('fake-openai-key'),
            now,
            'sk-openai',
            JSON.stringify([
                {
                    id: PRIMARY_MODEL,
                    displayName: PRIMARY_MODEL,
                    provider: 'openai',
                    authType: 'api_key',
                    contextWindow: 128000,
                    inputPricePerToken: 0.00000015,
                    outputPricePerToken: 0.0000006,
                    qualityScore: 5,
                },
            ]),
        ],
    );
    await ds.query(
        `INSERT INTO tenant_providers
       (id, tenant_id, created_by_user_id, agent_id, provider, auth_type, api_key_encrypted, is_active, connected_at, updated_at, key_prefix, cached_models)
     VALUES ($1,$2,$3,$4,$5,$6,$7,true,$8,$8,$9,$10)`,
        [
            'up-success-fallback',
            TEST_TENANT_ID,
            TEST_USER_ID,
            TEST_AGENT_ID,
            'anthropic',
            'api_key',
            enc('fake-anthropic-key'),
            now,
            'sk-ant',
            JSON.stringify([
                {
                    id: FALLBACK_MODEL,
                    displayName: FALLBACK_MODEL,
                    provider: 'anthropic',
                    authType: 'api_key',
                    contextWindow: 200000,
                    inputPricePerToken: 0.000003,
                    outputPricePerToken: 0.000015,
                    qualityScore: 3,
                },
            ]),
        ],
    );

    // Enable both user-level providers for the test agent.
    await ds.query(
        `INSERT INTO agent_enabled_providers (agent_id, tenant_provider_id) VALUES ($1,$2),($1,$3)`,
        [TEST_AGENT_ID, 'up-empty-primary', 'up-success-fallback'],
    );

    // Wire the default tier: empty-200 primary -> healthy fallback.
    await ds.query(
        `INSERT INTO tier_assignments
       (id, agent_id, tier, override_route, auto_assigned_route, fallback_routes, updated_at)
     VALUES ($1,$2,$3,$4::jsonb,NULL,$5::jsonb,$6)
     ON CONFLICT (agent_id, tier) DO UPDATE SET
       override_route = EXCLUDED.override_route,
       fallback_routes = EXCLUDED.fallback_routes`,
        [
            'tier-empty-default',
            TEST_AGENT_ID,
            'default',
            JSON.stringify({ provider: 'openai', authType: 'api_key', model: PRIMARY_MODEL }),
            JSON.stringify([{ provider: 'anthropic', authType: 'api_key', model: FALLBACK_MODEL }]),
            now,
        ],
    );

    // Disable complexity scoring so the resolver always lands on the default tier.
    await ds.query(`UPDATE agents SET complexity_routing_enabled = false WHERE id = $1`, [
        TEST_AGENT_ID,
    ]);

    // Stub fetch: the primary upstream returns HTTP 200 with empty content; the
    // fallback upstream returns a healthy Anthropic Messages response.
    const PRIMARY_HOSTS = new Set(['api.openai.com']);
    const FALLBACK_HOSTS = new Set(['api.anthropic.com']);
    originalFetch = global.fetch;
    global.fetch = (async (input, init) => {
        const url =
            typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        let hostname = '';
        try {
            hostname = new URL(url).hostname;
        } catch {
            // Non-absolute URL — fall through to the real fetch.
        }
        if (PRIMARY_HOSTS.has(hostname)) {
            calls.push({ url, status: 200 });
            return new Response(
                JSON.stringify({
                    id: 'chatcmpl-empty',
                    object: 'chat.completion',
                    created: Date.now(),
                    model: PRIMARY_MODEL,
                    choices: [
                        { index: 0, message: { role: 'assistant', content: '' }, finish_reason: 'stop' },
                    ],
                    usage: { prompt_tokens: 10, completion_tokens: 0, total_tokens: 10 },
                }),
                { status: 200, headers: { 'content-type': 'application/json' } },
            );
        }
        if (FALLBACK_HOSTS.has(hostname)) {
            calls.push({ url, status: 200 });
            return new Response(
                JSON.stringify({
                    id: 'msg-success',
                    type: 'message',
                    role: 'assistant',
                    model: FALLBACK_MODEL,
                    content: [{ type: 'text', text: 'Success!' }],
                    usage: { input_tokens: 10, output_tokens: 5 },
                }),
                { status: 200, headers: { 'content-type': 'application/json' } },
            );
        }
        return originalFetch!(input, init);
    }) as typeof fetch;
}, 60000);

afterAll(async () => {
    if (originalFetch) global.fetch = originalFetch;
    if (app) await app.close();
});

describe('Empty response fallback (#2709)', () => {
    beforeEach(() => {
        calls.length = 0;
    });

    it('falls back when the primary returns HTTP 200 with empty content', async () => {
        const ds = app.get(DataSource);
        await ds.query(`DELETE FROM agent_messages WHERE agent_id = $1`, [TEST_AGENT_ID]);

        // The seeder + auto-assign warm the routing cache before the test's DB
        // writes, so flush it now or the resolver keeps using the stale tier.
        app.get(RoutingCacheService).invalidateAgent(TEST_AGENT_ID);

        const res = await request(app.getHttpServer())
            .post('/v1/chat/completions')
            .set('Authorization', `Bearer ${TEST_OTLP_KEY}`)
            .send({ messages: [{ role: 'user', content: 'Say only: TEST_OK' }] })
            .expect(200);

        // The client must receive the fallback model's content, not the empty one.
        expect(res.body.choices[0].message.content).toBe('Success!');
        expect(res.headers['x-manifest-fallback-from']).toBe(PRIMARY_MODEL);
        expect(res.headers['x-manifest-fallback-index']).toBe('0');
        expect(calls.map((c) => c.status)).toEqual([200, 200]);

        // Wait for recordFallbackSuccess to flush asynchronously instead of fixed timeout.
        await waitForRowsOrTimeout(ds, TEST_AGENT_ID, PRIMARY_MODEL, FALLBACK_MODEL, 5000);

        const rows = await ds.query(
            `SELECT model, status, error_http_status, error_message, superseded
         FROM agent_messages
        WHERE agent_id = $1
        ORDER BY timestamp DESC`,
            [TEST_AGENT_ID],
        );

        // The primary attempt must be recorded as a failure (not success) with a
        // distinguishable error origin and the synthetic 502 status.
        const primaryFailure = rows.find(
            (r: { model: string; superseded: boolean }) =>
                r.model === PRIMARY_MODEL && r.superseded === true,
        );
        expect(primaryFailure).toBeDefined();
        expect(primaryFailure.status).toBe('failed');
        expect(primaryFailure.error_http_status).toBe(502);
        expect(primaryFailure.error_message).toContain('empty_response');

        // The fallback attempt must be the terminal success.
        const success = rows.find(
            (r: { model: string; status: string }) =>
                r.model === FALLBACK_MODEL && r.status === 'success',
        );
        expect(success).toBeDefined();
    });
});

/**
 * Waits for agent_messages rows to appear or timeout occurs.
 * Polls every 100ms until the expected rows exist or timeout is reached.
 */
async function waitForRowsOrTimeout(
    ds: DataSource,
    agentId: string,
    primaryModel: string,
    fallbackModel: string,
    timeoutMs: number,
): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        const rows = await ds.query(
            `SELECT model, status, error_http_status, error_message, superseded
       FROM agent_messages
       WHERE agent_id = $1
       ORDER BY timestamp DESC`,
            [agentId],
        );

        const primaryFailure = rows.find(
            (r: { model: string; superseded: boolean }) =>
                r.model === primaryModel && r.superseded === true,
        );
        const success = rows.find(
            (r: { model: string; status: string }) =>
                r.model === fallbackModel && r.status === 'success',
        );

        if (primaryFailure && success) {
            return;
        }
        await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error('Timed out waiting for agent_messages rows to appear');
}