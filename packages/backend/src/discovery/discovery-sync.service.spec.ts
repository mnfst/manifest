import { isSelfHosted } from '../common/utils/detect-self-hosted';
import { DiscoverySyncService } from './discovery-sync.service';

jest.mock('../common/utils/detect-self-hosted', () => ({
  isSelfHosted: jest.fn(),
}));

const mockIsSelfHosted = isSelfHosted as jest.MockedFunction<typeof isSelfHosted>;

describe('DiscoverySyncService', () => {
  const originalNodeEnv = process.env['NODE_ENV'];
  let service: DiscoverySyncService;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    process.env['NODE_ENV'] = 'production';
    mockIsSelfHosted.mockReturnValue(true);
    fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true } as Response);
    service = new DiscoverySyncService();
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    jest.clearAllMocks();
  });

  afterAll(() => {
    if (originalNodeEnv === undefined) delete process.env['NODE_ENV'];
    else process.env['NODE_ENV'] = originalNodeEnv;
  });

  it('posts the submission to the neutral Blue ingest endpoint', async () => {
    const submission = {
      name: 'Jane',
      email: 'jane@example.com',
      projectType: 'ai_agent',
      companySize: '1-20',
    };

    await service.submit(submission);

    expect(fetchSpy).toHaveBeenCalledWith('https://blue.manifest.build/v1/self-hosted/discovery', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(submission),
      signal: expect.any(AbortSignal),
    });
  });

  it('does not send Skip or whitespace-only submissions', async () => {
    await service.submit({});
    await service.submit({ name: '   ' });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does not send outside a production self-hosted deployment', async () => {
    mockIsSelfHosted.mockReturnValue(false);
    await service.submit({ email: 'jane@example.com' });

    process.env['NODE_ENV'] = 'development';
    mockIsSelfHosted.mockReturnValue(true);
    await service.submit({ email: 'jane@example.com' });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does not fail completion when Peacock rejects the submission', async () => {
    fetchSpy.mockResolvedValueOnce({ ok: false, status: 500 } as Response);

    await expect(service.submit({ email: 'jane@example.com' })).resolves.toBeUndefined();
  });

  it('does not fail completion when Peacock is unreachable', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('network down'));

    await expect(service.submit({ email: 'jane@example.com' })).resolves.toBeUndefined();
  });
});
