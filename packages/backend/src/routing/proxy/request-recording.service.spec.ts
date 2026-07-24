import { RequestRecordingService } from './request-recording.service';

describe('RequestRecordingService', () => {
  const create = jest.fn((value) => value);
  const save = jest.fn();
  const findOne = jest.fn();
  const repository = { create, save, findOne };
  const service = new RequestRecordingService(repository as never);

  beforeEach(() => jest.clearAllMocks());

  it('starts a request-owned recording with the API format', async () => {
    save.mockResolvedValue(undefined);
    await service.start('request-1', { messages: [{ role: 'user', content: 'hi' }] }, 'messages');

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        request_id: 'request-1',
        api_format: 'messages',
        response_body: null,
      }),
    );
  });

  it('stores an accepted request body without truncating it', async () => {
    const requestBody = { input: 'x'.repeat(2 * 1024 * 1024) };
    save.mockResolvedValue(undefined);

    await service.start('request-large', requestBody, 'responses');

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        request_id: 'request-large',
        request_body: requestBody,
        size_bytes: Buffer.byteLength(JSON.stringify(requestBody)),
      }),
    );
  });

  it('keeps recording available when a payload cannot be serialized for accounting', async () => {
    const requestBody: Record<string, unknown> = {};
    requestBody.self = requestBody;
    save.mockResolvedValue(undefined);

    await service.start('request-circular', requestBody, 'chat_completions');

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        request_id: 'request-circular',
        request_body: requestBody,
        size_bytes: 0,
      }),
    );
  });

  it('finishes the recording and accounts for both payloads', async () => {
    findOne.mockResolvedValue({ request_id: 'request-1', request_body: { input: 'hello' } });
    save.mockResolvedValue(undefined);
    const response = { type: 'json' as const, body: { output_text: 'hi' } };

    await service.finish('request-1', response);

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        response_body: response,
        size_bytes:
          Buffer.byteLength(JSON.stringify({ input: 'hello' })) +
          Buffer.byteLength(JSON.stringify(response)),
      }),
    );
  });

  it('does nothing when the recording was not started', async () => {
    findOne.mockResolvedValue(null);

    await service.finish('missing-request', { type: 'json', body: {} });

    expect(save).not.toHaveBeenCalled();
  });
});
