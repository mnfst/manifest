import { DataSource } from 'typeorm';
import { runRequestBackfill } from '../src/database/backfills/backfill-requests';
import { TypeOrmRequestBackfillGateway } from '../src/database/backfills/backfill-requests.gateway';
import { AddRequestsAndProviderAttempts1801000000000 } from '../src/database/migrations/1801000000000-AddRequestsAndProviderAttempts';

interface LegacyAttempt {
  id: string;
  timestamp: string;
  status: string;
  model: string;
  fallbackFrom?: string;
  fallbackIndex?: number;
  superseded?: boolean;
  autofixGroup?: string;
  errorOrigin?: string;
  requestParams?: object;
}

describe('request backfill legacy fallback reconstruction (e2e)', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      url:
        process.env['DATABASE_URL'] ?? 'postgresql://myuser:mypassword@localhost:5432/mydatabase',
    });
    await dataSource.initialize();
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
  });

  beforeEach(async () => {
    await dataSource.query('DROP SCHEMA public CASCADE');
    await dataSource.query('CREATE SCHEMA public');
    await dataSource.query(`
      CREATE TABLE agent_messages (
        id varchar PRIMARY KEY,
        tenant_id varchar,
        agent_id varchar,
        user_id varchar,
        agent_name varchar,
        trace_id varchar,
        session_key varchar,
        session_id varchar,
        timestamp timestamp NOT NULL,
        duration_ms integer,
        status varchar NOT NULL,
        error_message varchar,
        error_http_status integer,
        error_code varchar(8),
        error_origin varchar,
        error_class varchar,
        model varchar,
        caller_attribution text,
        request_headers text,
        request_params jsonb,
        feedback_rating varchar,
        feedback_tags varchar,
        feedback_details text,
        autofix_group_id varchar,
        superseded boolean DEFAULT false,
        fallback_from_model varchar,
        fallback_index integer
      )
    `);
    const runner = dataSource.createQueryRunner();
    try {
      await new AddRequestsAndProviderAttempts1801000000000().up(runner);
    } finally {
      await runner.release();
    }
  });

  async function insertAttempt(attempt: LegacyAttempt): Promise<void> {
    await dataSource.query(
      `INSERT INTO provider_attempts (
        id, tenant_id, agent_id, agent_name, timestamp, duration_ms, status,
        model, fallback_from_model, fallback_index, superseded,
        autofix_group_id, error_origin, caller_attribution, request_headers,
        request_params
      ) VALUES (
        $1, 'tenant-1', 'agent-1', 'Agent', $2, 100, $3, $4, $5, $6, $7,
        $8, $9, '{"agent":"openai-sdk"}', '{"content-type":"application/json"}', $10
      )`,
      [
        attempt.id,
        attempt.timestamp,
        attempt.status,
        attempt.model,
        attempt.fallbackFrom ?? null,
        attempt.fallbackIndex ?? null,
        attempt.superseded ?? false,
        attempt.autofixGroup ?? null,
        attempt.errorOrigin ?? null,
        attempt.requestParams ?? { model: 'openai/gpt-4o' },
      ],
    );
  }

  async function backfill(
    options: { batchSize?: number; before?: string; fallbackBefore?: string } = {},
  ): Promise<void> {
    await runRequestBackfill(new TypeOrmRequestBackfillGateway(dataSource), {
      batchSize: options.batchSize ?? 2,
      throttleMs: 0,
      before: options.before,
      fallbackBefore: options.fallbackBefore,
    });
  }

  it('groups a recovered fallback chain without traceparent', async () => {
    await insertAttempt({
      id: 'recovered-primary',
      timestamp: '2026-01-01 00:00:00.000',
      status: 'fallback_error',
      model: 'openai/gpt-4o',
      superseded: true,
      errorOrigin: 'provider',
    });
    await insertAttempt({
      id: 'recovered-fallback-0',
      timestamp: '2026-01-01 00:00:00.200',
      status: 'fallback_error',
      model: 'anthropic/claude-sonnet',
      fallbackFrom: 'openai/gpt-4o',
      fallbackIndex: 0,
      superseded: true,
      errorOrigin: 'provider',
    });
    await insertAttempt({
      id: 'recovered-fallback-1',
      timestamp: '2026-01-01 00:00:00.100',
      status: 'fallback_error',
      model: 'google/gemini-flash',
      fallbackFrom: 'openai/gpt-4o',
      fallbackIndex: 1,
      superseded: true,
      errorOrigin: 'provider',
    });
    await insertAttempt({
      id: 'recovered-terminal',
      timestamp: '2026-01-01 00:00:00.300',
      status: 'ok',
      model: 'google/gemini-pro',
      fallbackFrom: 'openai/gpt-4o',
      fallbackIndex: 2,
    });

    await backfill({ batchSize: 1 });

    const [request] = await dataSource.query(
      `SELECT status, requested_model, duration_ms FROM requests`,
    );
    const [{ parents, attempts }] = await dataSource.query(
      `SELECT count(DISTINCT request_id)::int parents, count(*)::int attempts
       FROM provider_attempts`,
    );
    expect({ ...request, parents, attempts }).toEqual({
      status: 'ok',
      requested_model: 'openai/gpt-4o',
      duration_ms: 400,
      parents: 1,
      attempts: 4,
    });
  });

  it('groups an exhausted fallback chain around its legacy primary anchor', async () => {
    await insertAttempt({
      id: 'exhausted-fallback-0',
      timestamp: '2026-01-01 00:01:00.200',
      status: 'fallback_error',
      model: 'anthropic/claude-sonnet',
      fallbackFrom: 'openai/gpt-4o',
      fallbackIndex: 0,
      superseded: true,
      errorOrigin: 'provider',
    });
    await insertAttempt({
      id: 'exhausted-terminal',
      timestamp: '2026-01-01 00:01:00.100',
      status: 'error',
      model: 'google/gemini-pro',
      fallbackFrom: 'openai/gpt-4o',
      fallbackIndex: 1,
      errorOrigin: 'provider',
    });
    await insertAttempt({
      id: 'exhausted-primary',
      timestamp: '2026-01-01 00:01:00.300',
      status: 'fallback_error',
      model: 'openai/gpt-4o',
      superseded: true,
      errorOrigin: 'provider',
    });

    await backfill();

    const [request] = await dataSource.query(`SELECT status, requested_model FROM requests`);
    const [{ parents }] = await dataSource.query(
      `SELECT count(DISTINCT request_id)::int parents FROM provider_attempts`,
    );
    expect({ ...request, parents }).toEqual({
      status: 'error',
      requested_model: 'openai/gpt-4o',
      parents: 1,
    });
  });

  it('leaves ambiguous fallback signatures as separate synthetic requests', async () => {
    for (const id of ['ambiguous-primary-a', 'ambiguous-primary-b']) {
      await insertAttempt({
        id,
        timestamp: '2026-01-01 00:02:00.000',
        status: 'fallback_error',
        model: 'openai/gpt-4o',
        superseded: true,
        errorOrigin: 'provider',
      });
    }
    await insertAttempt({
      id: 'ambiguous-terminal',
      timestamp: '2026-01-01 00:02:00.100',
      status: 'ok',
      model: 'anthropic/claude-sonnet',
      fallbackFrom: 'openai/gpt-4o',
      fallbackIndex: 0,
    });

    await backfill();

    const [{ requests, parents }] = await dataSource.query(
      `SELECT (SELECT count(*)::int FROM requests) requests,
              (SELECT count(DISTINCT request_id)::int FROM provider_attempts) parents`,
    );
    expect({ requests, parents }).toEqual({ requests: 3, parents: 3 });
  });

  it('rejects member ambiguity that spans separate source batches', async () => {
    await insertAttempt({
      id: 'cross-batch-primary-a',
      timestamp: '2026-01-01 00:04:00.000',
      status: 'fallback_error',
      model: 'openai/gpt-4o',
      superseded: true,
      errorOrigin: 'provider',
    });
    await insertAttempt({
      id: 'cross-batch-primary-b',
      timestamp: '2026-01-01 00:04:00.100',
      status: 'fallback_error',
      model: 'openai/gpt-4o',
      superseded: true,
      errorOrigin: 'provider',
    });
    await insertAttempt({
      id: 'cross-batch-shared-member',
      timestamp: '2026-01-01 00:04:00.200',
      status: 'fallback_error',
      model: 'anthropic/claude-sonnet',
      fallbackFrom: 'openai/gpt-4o',
      fallbackIndex: 0,
      superseded: true,
      errorOrigin: 'provider',
    });
    await insertAttempt({
      id: 'cross-batch-terminal-a',
      timestamp: '2026-01-01 00:04:00.300',
      status: 'ok',
      model: 'google/gemini-pro',
      fallbackFrom: 'openai/gpt-4o',
      fallbackIndex: 2,
    });
    await insertAttempt({
      id: 'cross-batch-terminal-b',
      timestamp: '2026-01-01 00:04:00.300',
      status: 'ok',
      model: 'mistral/large',
      fallbackFrom: 'openai/gpt-4o',
      fallbackIndex: 1,
    });

    await backfill({ batchSize: 1 });

    const [{ requests, parents }] = await dataSource.query(
      `SELECT (SELECT count(*)::int FROM requests) requests,
              (SELECT count(DISTINCT request_id)::int FROM provider_attempts) parents`,
    );
    expect({ requests, parents }).toEqual({ requests: 5, parents: 5 });
  });

  it('waits for a late old-replica terminal before linking its primary', async () => {
    await dataSource.query(`
      INSERT INTO agent_messages (
        id, tenant_id, agent_id, agent_name, timestamp, duration_ms, status,
        model, superseded, error_origin, caller_attribution, request_headers, request_params
      ) VALUES (
        'late-primary', 'tenant-1', 'agent-1', 'Agent',
        '2026-01-01 00:05:00.000', 100, 'fallback_error', 'openai/gpt-4o', true,
        'provider', '{"agent":"openai-sdk"}', '{"content-type":"application/json"}',
        '{"model":"openai/gpt-4o"}'::jsonb
      )
    `);
    await dataSource.query(`
      INSERT INTO agent_messages (
        id, tenant_id, agent_id, agent_name, timestamp, duration_ms, status,
        model, fallback_from_model, fallback_index, superseded,
        caller_attribution, request_headers, request_params
      ) VALUES (
        'late-terminal', 'tenant-1', 'agent-1', 'Agent',
        '2026-01-01 00:05:00.100', 100, 'ok', 'anthropic/claude-sonnet',
        'openai/gpt-4o', 0, false, '{"agent":"openai-sdk"}',
        '{"content-type":"application/json"}', '{"model":"openai/gpt-4o"}'::jsonb
      )
    `);

    await backfill({
      batchSize: 1,
      fallbackBefore: '2026-01-01 00:05:00.050',
      before: '2025-12-31 23:55:00.000',
    });
    const [{ unlinkedAfterFirstSweep }] = await dataSource.query(
      `SELECT count(*)::int AS "unlinkedAfterFirstSweep"
       FROM provider_attempts WHERE request_id IS NULL`,
    );
    expect(unlinkedAfterFirstSweep).toBe(2);

    await backfill({
      batchSize: 1,
      fallbackBefore: '2026-01-01 00:06:00.000',
      before: '2026-01-01 00:05:30.000',
    });
    const [{ requests, parents, unlinked }] = await dataSource.query(
      `SELECT (SELECT count(*)::int FROM requests) requests,
              (SELECT count(DISTINCT request_id)::int FROM provider_attempts) parents,
              (SELECT count(*)::int FROM provider_attempts WHERE request_id IS NULL) unlinked`,
    );
    expect({ requests, parents, unlinked }).toEqual({ requests: 1, parents: 1, unlinked: 0 });
  });

  it('preserves ordinary and Auto-fix grouping behavior', async () => {
    await insertAttempt({
      id: 'plain',
      timestamp: '2026-01-01 00:03:00.000',
      status: 'ok',
      model: 'openai/gpt-4o',
    });
    await insertAttempt({
      id: 'autofix-original',
      timestamp: '2026-01-01 00:03:01.000',
      status: 'auto_fixed',
      model: 'openai/gpt-4o',
      superseded: true,
      autofixGroup: 'heal-1',
      errorOrigin: 'provider',
    });
    await insertAttempt({
      id: 'autofix-retry',
      timestamp: '2026-01-01 00:03:01.100',
      status: 'ok',
      model: 'openai/gpt-4o',
      autofixGroup: 'heal-1',
    });

    await backfill();

    const [{ requests, parents }] = await dataSource.query(
      `SELECT (SELECT count(*)::int FROM requests) requests,
              (SELECT count(DISTINCT request_id)::int FROM provider_attempts) parents`,
    );
    expect({ requests, parents }).toEqual({ requests: 2, parents: 2 });
  });
});
