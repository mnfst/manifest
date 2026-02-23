import { ResendProvider } from './resend.provider';
import { EmailProviderConfig } from './email-provider.interface';

describe('ResendProvider', () => {
  beforeEach(() => {
    jest.spyOn(global, 'fetch').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const config: EmailProviderConfig = {
    provider: 'resend',
    apiKey: 're_test-key',
    fromEmail: 'noreply@test.com',
  };

  it('sends email and returns true on success', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
    const provider = new ResendProvider(config);

    const result = await provider.send({ to: 'user@test.com', subject: 'Test', html: '<p>Hi</p>' });

    expect(result).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('uses Bearer auth header', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
    const provider = new ResendProvider(config);

    await provider.send({ to: 'user@test.com', subject: 'Test', html: '<p>Hi</p>' });

    const headers = (global.fetch as jest.Mock).mock.calls[0][1].headers;
    expect(headers.Authorization).toBe('Bearer re_test-key');
  });

  it('sends correct JSON body with to as array', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
    const provider = new ResendProvider(config);

    await provider.send({ to: 'user@test.com', subject: 'Test', html: '<p>Hi</p>' });

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.to).toEqual(['user@test.com']);
    expect(body.from).toBe('Manifest <noreply@test.com>');
    expect(body.subject).toBe('Test');
    expect(body.html).toBe('<p>Hi</p>');
  });

  it('returns false when apiKey is empty', async () => {
    const provider = new ResendProvider({ ...config, apiKey: '' });
    const result = await provider.send({ to: 'a@b.com', subject: 'Hi', html: '<p>Hello</p>' });
    expect(result).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns false on non-ok response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 422, text: async () => 'Invalid' });
    const provider = new ResendProvider(config);

    const result = await provider.send({ to: 'user@test.com', subject: 'Test', html: '<p>Hi</p>' });
    expect(result).toBe(false);
  });

  it('returns false on network error', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network failure'));
    const provider = new ResendProvider(config);

    const result = await provider.send({ to: 'user@test.com', subject: 'Test', html: '<p>Hi</p>' });
    expect(result).toBe(false);
  });

  it('uses custom from address when provided', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
    const provider = new ResendProvider(config);

    await provider.send({ to: 'user@test.com', subject: 'Test', html: '<p>Hi</p>', from: 'Custom <custom@test.com>' });

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.from).toBe('Custom <custom@test.com>');
  });

  it('includes text field when provided', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
    const provider = new ResendProvider(config);

    await provider.send({ to: 'user@test.com', subject: 'Test', html: '<p>Hi</p>', text: 'Hi plain' });

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.text).toBe('Hi plain');
  });

  it('omits text field when not provided', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
    const provider = new ResendProvider(config);

    await provider.send({ to: 'user@test.com', subject: 'Test', html: '<p>Hi</p>' });

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.text).toBeUndefined();
  });
});
