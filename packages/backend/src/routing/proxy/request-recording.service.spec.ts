import { decodeRequestRecording } from '../../common/utils/request-recording-codec';
import type { StoredRequestRecording } from '../../entities/request-recording.entity';
import { RequestRecordingService } from './request-recording.service';

describe('RequestRecordingService', () => {
  const create = jest.fn((value) => value);
  const save = jest.fn();
  const findOne = jest.fn();
  const repository = { create, save, findOne };
  const storage = {
    backend: 'filesystem' as const,
    objectKey: jest.fn(
      (tenantId: string, requestId: string) =>
        `request-recordings/v1/tenants/${tenantId}/${requestId}.json.gz`,
    ),
    put: jest.fn(),
  };
  const service = new RequestRecordingService(repository as never, storage as never);
  const payload: StoredRequestRecording = {
    version: 1,
    request_body: { messages: [{ role: 'user', content: 'hello' }] },
    response_body: { type: 'json', body: { output_text: 'hi' } },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    save.mockImplementation(async (value) => value);
    storage.backend = 'filesystem';
  });

  it('starts a request-owned metadata row without putting payloads in PostgreSQL', async () => {
    await expect(service.start('tenant-1', 'request-1', 'messages')).resolves.toBe(true);

    expect(save).toHaveBeenCalledWith({
      request_id: 'request-1',
      storage_key: 'request-recordings/v1/tenants/tenant-1/request-1.json.gz',
      storage_backend: 'filesystem',
      status: 'pending',
      api_format: 'messages',
      content_encoding: 'gzip',
      size_bytes: 0,
    });
    expect(storage.objectKey).toHaveBeenCalledWith('tenant-1', 'request-1');
    expect(save.mock.calls[0][0]).not.toHaveProperty('request_body');
    expect(save.mock.calls[0][0]).not.toHaveProperty('response_body');
  });

  it('does not start recording when storage is unavailable', async () => {
    storage.backend = null as never;

    await expect(service.start('tenant-1', 'request-1', 'messages')).resolves.toBe(false);

    expect(save).not.toHaveBeenCalled();
  });

  it('gzip-encodes the complete accepted payload and marks metadata ready', async () => {
    const recording = {
      request_id: 'request-1',
      storage_key: 'request-recordings/v1/request-1.json.gz',
      storage_backend: 'filesystem',
      status: 'pending',
      api_format: 'messages',
      content_encoding: 'gzip',
      size_bytes: 0,
    };
    findOne.mockResolvedValue(recording);

    await service.finish('request-1', payload);

    const encoded = storage.put.mock.calls[0][1] as Buffer;
    expect(storage.put).toHaveBeenCalledWith(recording.storage_key, expect.any(Buffer));
    await expect(decodeRequestRecording(encoded)).resolves.toEqual(payload);
    expect(save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        request_id: 'request-1',
        status: 'ready',
        size_bytes: encoded.byteLength,
      }),
    );
  });

  it('stores large accepted recordings completely rather than truncating them', async () => {
    const largePayload: StoredRequestRecording = {
      ...payload,
      request_body: { input: 'x'.repeat(2 * 1024 * 1024) },
    };
    findOne.mockResolvedValue({
      request_id: 'request-large',
      storage_key: 'request-recordings/v1/request-large.json.gz',
      storage_backend: 'filesystem',
      status: 'pending',
    });

    await service.finish('request-large', largePayload);

    await expect(decodeRequestRecording(storage.put.mock.calls[0][1] as Buffer)).resolves.toEqual(
      largePayload,
    );
  });

  it('marks metadata failed when object storage rejects the write', async () => {
    const recording = {
      request_id: 'request-1',
      storage_key: 'request-recordings/v1/request-1.json.gz',
      storage_backend: 'filesystem',
      status: 'pending',
    };
    findOne.mockResolvedValue(recording);
    storage.put.mockRejectedValue(new Error('offline'));

    await expect(service.finish('request-1', payload)).rejects.toThrow('offline');

    expect(save).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }));
  });

  it('does nothing when the metadata row was not started', async () => {
    findOne.mockResolvedValue(null);

    await service.finish('missing-request', payload);

    expect(storage.put).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });
});
