import { ConfigService } from '@nestjs/config';
import { INestApplication } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import * as http from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { RequestRecordingStorageService } from '../src/common/services/request-recording-storage.service';
import { decodeRequestRecording } from '../src/common/utils/request-recording-codec';
import { RequestRecordingRetentionService } from '../src/database/request-recording-retention.service';
import { createTestApp, TEST_API_KEY, TEST_OTLP_KEY } from './helpers';

type RecordingMetadata = {
  request_id: string;
  storage_key: string;
  storage_backend: 'filesystem' | 's3';
  status: 'pending' | 'ready' | 'failed';
  api_format: string;
  content_encoding: string;
  size_bytes: number;
};

const expectedBackend = process.env['E2E_RECORDING_BACKEND'] === 's3' ? 's3' : 'filesystem';
const canBreakStorage =
  expectedBackend === 'filesystem' || Boolean(process.env['E2E_S3_CONTAINER_NAME']);
const storageFailureTest = canBreakStorage ? it : it.skip;
const execFileAsync = promisify(execFile);
const previousEnv = new Map<string, string | undefined>();
const recordingEnvKeys = [
  'REQUEST_RECORDING_STORAGE',
  'REQUEST_RECORDING_FILESYSTEM_PATH',
  'REQUEST_RECORDING_RETENTION_DAYS',
];

let app: INestApplication;
let dataSource: DataSource;
let storage: RequestRecordingStorageService;
let mockServer: http.Server;
let mockPort: number;
let filesystemRoot: string | null = null;
let customProviderId: string;
let jsonRecording: RecordingMetadata;
let jsonResponseBody: unknown;
let streamRecording: RecordingMetadata;

const api = () => request(app.getHttpServer());
const dashboardAuth = (test: request.Test) => test.set('x-api-key', TEST_API_KEY);
const agentAuth = (test: request.Test) => test.set('Authorization', `Bearer ${TEST_OTLP_KEY}`);
const modelKey = () => `custom:${customProviderId}/recording-model`;

beforeAll(async () => {
  for (const key of recordingEnvKeys) previousEnv.set(key, process.env[key]);

  process.env['REQUEST_RECORDING_STORAGE'] = 'auto';
  process.env['REQUEST_RECORDING_RETENTION_DAYS'] = '1';
  if (expectedBackend === 'filesystem') {
    filesystemRoot = await mkdtemp(join(tmpdir(), 'manifest-recordings-e2e-'));
    process.env['REQUEST_RECORDING_FILESYSTEM_PATH'] = filesystemRoot;
  }

  await startMockProvider();
  app = await createTestApp();
  refreshAppReferences();
  await configureRecordingAgent();
}, 30_000);

afterAll(async () => {
  await app?.close();
  await closeMockProvider();
  if (filesystemRoot) {
    await rm(filesystemRoot, { recursive: true, force: true });
    await rm(`${filesystemRoot}-backup`, { recursive: true, force: true });
  }
  for (const [key, value] of previousEnv) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe(`request recording E2E (${expectedBackend})`, () => {
  it('records a complete JSON request/response outside PostgreSQL and serves it through the authenticated drawer API', async () => {
    const largeTail = `${'complete-payload-'.repeat(3_500)}__END_OF_REQUEST__`;
    const requestBody = {
      model: modelKey(),
      messages: [{ role: 'user', content: largeTail }],
      temperature: 0.42,
      stream: false,
    };

    const response = await agentAuth(api().post('/v1/chat/completions'))
      .send(requestBody)
      .expect(200);
    jsonResponseBody = response.body;
    jsonRecording = await waitForLatestRecording();

    expect(jsonRecording).toEqual(
      expect.objectContaining({
        storage_backend: expectedBackend,
        status: 'ready',
        api_format: 'chat_completions',
        content_encoding: 'gzip',
        size_bytes: expect.any(Number),
      }),
    );
    expect(jsonRecording.size_bytes).toBeGreaterThan(0);

    const columns = (await dataSource.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_name = 'request_recordings'
       ORDER BY ordinal_position`,
    )) as Array<{ column_name: string }>;
    expect(columns.map((column) => column.column_name)).not.toEqual(
      expect.arrayContaining(['request_body', 'response_body']),
    );

    const objectBytes = await storage.get(jsonRecording.storage_backend, jsonRecording.storage_key);
    expect([...objectBytes.subarray(0, 2)]).toEqual([0x1f, 0x8b]);
    expect(objectBytes.byteLength).toBe(jsonRecording.size_bytes);
    await expect(decodeRequestRecording(objectBytes)).resolves.toEqual({
      version: 1,
      request_body: requestBody,
      response_body: { type: 'json', body: response.body },
    });

    const details = await dashboardAuth(
      api().get(`/api/v1/messages/${jsonRecording.request_id}/details`),
    ).expect(200);
    expect(details.body.recording).toEqual({
      request_body: requestBody,
      response_body: { type: 'json', body: response.body },
      api_format: 'chat_completions',
      size_bytes: objectBytes.byteLength,
      created_at: expect.any(String),
    });
    expect(JSON.stringify(details.body)).not.toContain(jsonRecording.storage_key);
  });

  it('captures the exact caller-facing SSE stream', async () => {
    const requestBody = {
      model: modelKey(),
      messages: [{ role: 'user', content: 'stream this response' }],
      stream: true,
    };

    const response = await agentAuth(api().post('/v1/chat/completions'))
      .set('Accept', 'text/event-stream')
      .send(requestBody)
      .expect(200);
    streamRecording = await waitForLatestRecording(jsonRecording.request_id);

    const payload = await decodeRequestRecording(
      await storage.get(streamRecording.storage_backend, streamRecording.storage_key),
    );
    expect(payload.request_body).toEqual(requestBody);
    expect(payload.response_body).toEqual({
      type: 'stream',
      raw_sse: response.text,
    });

    const details = await dashboardAuth(
      api().get(`/api/v1/messages/${streamRecording.request_id}/details`),
    ).expect(200);
    expect(details.body.recording.response_body.raw_sse).toBe(response.text);
  });

  it('does not expose a recording across tenant boundaries', async () => {
    const timestamp = new Date().toISOString();
    await dataSource.query(
      `INSERT INTO tenants
        (id, name, owner_user_id, organization_name, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, true, $5, $5)`,
      ['intruder-tenant', 'intruder', 'intruder-user', 'Intruder Org', timestamp],
    );

    await dashboardAuth(
      api()
        .get(`/api/v1/messages/${jsonRecording.request_id}/details`)
        .set('x-test-user-id', 'intruder-user'),
    ).expect(404);

    await expect(
      storage.get(jsonRecording.storage_backend, jsonRecording.storage_key),
    ).resolves.toBeInstanceOf(Buffer);
  });

  it('stops creating payload objects immediately when recording is disabled', async () => {
    const before = await recordingCount();

    await dashboardAuth(api().patch('/api/v1/routing/test-agent/recording'))
      .send({ enabled: false })
      .expect(200, { enabled: false });
    await agentAuth(api().post('/v1/chat/completions'))
      .send({
        model: modelKey(),
        messages: [{ role: 'user', content: 'do not record this' }],
        stream: false,
      })
      .expect(200);

    expect(await recordingCount()).toBe(before);

    await dashboardAuth(api().patch('/api/v1/routing/test-agent/recording'))
      .send({ enabled: true })
      .expect(200, { enabled: true });
  });

  storageFailureTest(
    'keeps successful proxy traffic successful when storage fails',
    async () => {
      const before = await recordingCount();
      const backup = filesystemRoot ? `${filesystemRoot}-backup` : null;

      if (expectedBackend === 'filesystem') {
        await rename(filesystemRoot!, backup!);
        await writeFile(filesystemRoot!, 'this file deliberately blocks the storage directory');
      } else {
        await execFileAsync('docker', ['stop', process.env['E2E_S3_CONTAINER_NAME']!]);
      }

      try {
        const response = await agentAuth(api().post('/v1/chat/completions'))
          .send({
            model: modelKey(),
            messages: [{ role: 'user', content: 'storage can fail independently' }],
            stream: false,
          })
          .expect(200);
        expect(response.body.choices[0].message.content).toBe('recorded JSON response');

        const failed = await waitForLatestRecording(undefined, before + 1, 'failed', 15_000);
        expect(failed.status).toBe('failed');
      } finally {
        if (expectedBackend === 'filesystem') {
          await rm(filesystemRoot!, { force: true });
          await rename(backup!, filesystemRoot!);
        } else {
          await execFileAsync('docker', ['start', process.env['E2E_S3_CONTAINER_NAME']!]);
          await waitForStorageObject(jsonRecording);
        }
      }
    },
    30_000,
  );

  it('can read the same private object after the application restarts', async () => {
    await app.close();
    app = await createTestApp({ dropSchema: false, seed: false });
    refreshAppReferences();

    const details = await dashboardAuth(
      api().get(`/api/v1/messages/${jsonRecording.request_id}/details`),
    ).expect(200);
    expect(details.body.recording.response_body).toEqual({
      type: 'json',
      body: jsonResponseBody,
    });
    await expect(
      storage.get(jsonRecording.storage_backend, jsonRecording.storage_key),
    ).resolves.toBeInstanceOf(Buffer);
  });

  it('retention removes the object before its pointer while preserving the parent Request', async () => {
    await dataSource.query(
      `UPDATE request_recordings
       SET created_at = CURRENT_TIMESTAMP - INTERVAL '10 days'
       WHERE request_id = $1`,
      [jsonRecording.request_id],
    );
    const retention = new RequestRecordingRetentionService(
      dataSource,
      {
        get: (key: string) => (key === 'app.requestRecordingRetentionDays' ? 1 : undefined),
      } as ConfigService,
      storage,
    );

    await expect(retention.deleteExpiredRecordings()).resolves.toBe(1);

    const metadata = await dataSource.query(
      `SELECT request_id FROM request_recordings WHERE request_id = $1`,
      [jsonRecording.request_id],
    );
    expect(metadata).toHaveLength(0);
    await expect(
      storage.get(jsonRecording.storage_backend, jsonRecording.storage_key),
    ).rejects.toBeDefined();
    const parent = await dataSource.query(`SELECT id FROM requests WHERE id = $1`, [
      jsonRecording.request_id,
    ]);
    expect(parent).toHaveLength(1);
  });
});

function refreshAppReferences(): void {
  dataSource = app.get(DataSource);
  storage = app.get(RequestRecordingStorageService);
}

async function configureRecordingAgent(): Promise<void> {
  await dashboardAuth(api().patch('/api/v1/routing/test-agent/recording'))
    .send({ enabled: true })
    .expect(200, { enabled: true });

  const provider = await dashboardAuth(api().post('/api/v1/routing/test-agent/custom-providers'))
    .send({
      name: 'Recording E2E Provider',
      base_url: `http://127.0.0.1:${mockPort}`,
      apiKey: 'recording-e2e-key',
      models: [
        {
          model_name: 'recording-model',
          input_price_per_million_tokens: 0,
          output_price_per_million_tokens: 0,
        },
      ],
    })
    .expect(201);
  customProviderId = provider.body.id as string;

  for (const tier of ['simple', 'standard', 'complex', 'reasoning', 'default']) {
    await dashboardAuth(api().put(`/api/v1/routing/test-agent/tiers/${tier}`))
      .send({ model: modelKey() })
      .expect(200);
  }
}

async function recordingCount(): Promise<number> {
  const rows = (await dataSource.query(
    `SELECT COUNT(*)::int AS count FROM request_recordings`,
  )) as Array<{ count: number }>;
  return Number(rows[0]?.count ?? 0);
}

async function waitForLatestRecording(
  excludeRequestId?: string,
  minimumCount?: number,
  expectedStatus: RecordingMetadata['status'] = 'ready',
  timeoutMs = 5_000,
): Promise<RecordingMetadata> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (minimumCount === undefined || (await recordingCount()) >= minimumCount) {
      const parameters: string[] = [];
      const exclusion = excludeRequestId ? 'WHERE request_id <> $1' : '';
      if (excludeRequestId) parameters.push(excludeRequestId);
      const rows = (await dataSource.query(
        `SELECT request_id, storage_key, storage_backend, status, api_format,
                content_encoding, size_bytes
         FROM request_recordings
         ${exclusion}
         ORDER BY created_at DESC, request_id DESC
         LIMIT 1`,
        parameters,
      )) as RecordingMetadata[];
      if (rows[0]?.status === expectedStatus) return rows[0];
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('Timed out waiting for a request recording');
}

async function waitForStorageObject(recording: RecordingMetadata): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      await storage.get(recording.storage_backend, recording.storage_key);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error('Timed out waiting for recording storage to recover');
}

async function startMockProvider(): Promise<void> {
  await new Promise<void>((resolve) => {
    mockServer = http.createServer((incoming, outgoing) => {
      let raw = '';
      incoming.on('data', (chunk: Buffer) => {
        raw += chunk.toString('utf8');
      });
      incoming.on('end', () => {
        const body = JSON.parse(raw) as { model: string; stream?: boolean };
        if (body.stream) {
          outgoing.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
          });
          outgoing.write(
            `data: ${JSON.stringify({
              id: 'chatcmpl-recording-stream',
              object: 'chat.completion.chunk',
              created: 1,
              model: body.model,
              choices: [
                {
                  index: 0,
                  delta: { role: 'assistant', content: 'recorded stream response' },
                  finish_reason: null,
                },
              ],
            })}\n\n`,
          );
          outgoing.end('data: [DONE]\n\n');
          return;
        }

        outgoing.writeHead(200, { 'Content-Type': 'application/json' });
        outgoing.end(
          JSON.stringify({
            id: 'chatcmpl-recording-json',
            object: 'chat.completion',
            created: 1,
            model: body.model,
            choices: [
              {
                index: 0,
                message: { role: 'assistant', content: 'recorded JSON response' },
                finish_reason: 'stop',
              },
            ],
            usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 },
          }),
        );
      });
    });
    mockServer.listen(0, '127.0.0.1', () => {
      mockPort = (mockServer.address() as { port: number }).port;
      resolve();
    });
  });
}

async function closeMockProvider(): Promise<void> {
  if (!mockServer) return;
  await new Promise<void>((resolve, reject) => {
    mockServer.close((error) => (error ? reject(error) : resolve()));
  });
}
