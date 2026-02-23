import { MailgunProvider } from './mailgun.provider';
import { EmailProviderConfig } from './email-provider.interface';

describe('MailgunProvider', () => {
  beforeEach(() => {
    jest.spyOn(global, 'fetch').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const config: EmailProviderConfig = {
    provider: 'mailgun',
    apiKey: 'test-key',
    domain: 'mg.test.com',
    fromEmail: 'noreply@test.com',
  };

  it('sends email and returns true on success', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
    const provider = new MailgunProvider(config);

    const result = await provider.send({ to: 'user@test.com', subject: 'Test', html: '<p>Hi</p>' });

    expect(result).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      'https://api.mailgun.net/v3/mg.test.com/messages',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('uses Basic auth with base64-encoded credentials', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
    const provider = new MailgunProvider(config);

    await provider.send({ to: 'user@test.com', subject: 'Test', html: '<p>Hi</p>' });

    const headers = (global.fetch as jest.Mock).mock.calls[0][1].headers;
    const expected = `Basic ${Buffer.from('api:test-key').toString('base64')}`;
    expect(headers.Authorization).toBe(expected);
  });

  it('returns false when apiKey is empty', async () => {
    const provider = new MailgunProvider({ ...config, apiKey: '' });
    const result = await provider.send({ to: 'a@b.com', subject: 'Hi', html: '<p>Hello</p>' });
    expect(result).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns false when domain is empty', async () => {
    const provider = new MailgunProvider({ ...config, domain: '' });
    const result = await provider.send({ to: 'a@b.com', subject: 'Hi', html: '<p>Hello</p>' });
    expect(result).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns false on non-ok response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 401, text: async () => 'Unauthorized' });
    const provider = new MailgunProvider(config);

    const result = await provider.send({ to: 'user@test.com', subject: 'Test', html: '<p>Hi</p>' });
    expect(result).toBe(false);
  });

  it('returns false on network error', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network failure'));
    const provider = new MailgunProvider(config);

    const result = await provider.send({ to: 'user@test.com', subject: 'Test', html: '<p>Hi</p>' });
    expect(result).toBe(false);
  });

  it('uses custom from address when provided', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
    const provider = new MailgunProvider(config);

    await provider.send({ to: 'user@test.com', subject: 'Test', html: '<p>Hi</p>', from: 'Custom <custom@test.com>' });

    const body = (global.fetch as jest.Mock).mock.calls[0][1].body as URLSearchParams;
    expect(body.get('from')).toBe('Custom <custom@test.com>');
  });

  it('includes text param when provided', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
    const provider = new MailgunProvider(config);

    await provider.send({ to: 'user@test.com', subject: 'Test', html: '<p>Hi</p>', text: 'Hi plain' });

    const body = (global.fetch as jest.Mock).mock.calls[0][1].body as URLSearchParams;
    expect(body.get('text')).toBe('Hi plain');
  });

  it('omits text param when not provided', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
    const provider = new MailgunProvider(config);

    await provider.send({ to: 'user@test.com', subject: 'Test', html: '<p>Hi</p>' });

    const body = (global.fetch as jest.Mock).mock.calls[0][1].body as URLSearchParams;
    expect(body.has('text')).toBe(false);
  });

  it('includes Reply-To header and tag', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
    const provider = new MailgunProvider(config);

    await provider.send({ to: 'user@test.com', subject: 'Test', html: '<p>Hi</p>' });

    const body = (global.fetch as jest.Mock).mock.calls[0][1].body as URLSearchParams;
    expect(body.get('h:Reply-To')).toBe('noreply@test.com');
    expect(body.get('o:tag')).toBe('manifest');
  });
});
