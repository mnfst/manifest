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

  it('sends email and returns true on success with all required body fields', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
    const provider = new MailgunProvider(config);

    const result = await provider.send({ to: 'user@test.com', subject: 'Test', html: '<p>Hi</p>' });

    expect(result).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      'https://api.mailgun.net/v3/mg.test.com/messages',
      expect.objectContaining({ method: 'POST' }),
    );

    const body = (global.fetch as jest.Mock).mock.calls[0][1].body;
    expect(body).toBeInstanceOf(URLSearchParams);
    expect(body.get('from')).toBe('Manifest <noreply@test.com>');
    expect(body.get('to')).toBe('user@test.com');
    expect(body.get('subject')).toBe('Test');
    expect(body.get('html')).toBe('<p>Hi</p>');
    expect(body.get('h:Reply-To')).toBe('noreply@test.com');
    expect(body.get('o:tag')).toBe('manifest');
    expect(body.has('text')).toBe(false);
  });

  it('serializes body as URL-encoded form (not JSON)', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
    const provider = new MailgunProvider(config);

    await provider.send({
      to: 'user@test.com',
      subject: 'Subject with spaces & symbols',
      html: '<p>Hi & bye</p>',
    });

    const body = (global.fetch as jest.Mock).mock.calls[0][1].body as URLSearchParams;
    expect(body).toBeInstanceOf(URLSearchParams);
    const encoded = body.toString();
    expect(encoded).toContain('subject=Subject+with+spaces+%26+symbols');
    expect(encoded).toContain('html=%3Cp%3EHi+%26+bye%3C%2Fp%3E');
    // Ensure body is NOT a JSON string
    expect(typeof body).not.toBe('string');
  });

  it('uses Basic auth with base64-encoded credentials and no Content-Type override', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
    const provider = new MailgunProvider(config);

    await provider.send({ to: 'user@test.com', subject: 'Test', html: '<p>Hi</p>' });

    const headers = (global.fetch as jest.Mock).mock.calls[0][1].headers;
    const expected = `Basic ${Buffer.from('api:test-key').toString('base64')}`;
    expect(headers.Authorization).toBe(expected);
    // fetch() should infer Content-Type: application/x-www-form-urlencoded from URLSearchParams
    expect(headers['Content-Type']).toBeUndefined();
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

  it('returns false when domain is undefined (defaults to empty string)', async () => {
    const provider = new MailgunProvider({ ...config, domain: undefined });
    const result = await provider.send({ to: 'a@b.com', subject: 'Hi', html: '<p>Hello</p>' });
    expect(result).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns false on non-ok response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    });
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

  it('uses custom from address when provided and preserves all other fields', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
    const provider = new MailgunProvider(config);

    await provider.send({
      to: 'user@test.com',
      subject: 'Test',
      html: '<p>Hi</p>',
      from: 'Custom <custom@test.com>',
    });

    const body = (global.fetch as jest.Mock).mock.calls[0][1].body as URLSearchParams;
    expect(body.get('from')).toBe('Custom <custom@test.com>');
    expect(body.get('to')).toBe('user@test.com');
    expect(body.get('subject')).toBe('Test');
    expect(body.get('html')).toBe('<p>Hi</p>');
    expect(body.get('h:Reply-To')).toBe('noreply@test.com');
    expect(body.get('o:tag')).toBe('manifest');
  });

  it('uses default from when fromEmail not configured', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
    const provider = new MailgunProvider({ ...config, fromEmail: undefined });

    await provider.send({ to: 'user@test.com', subject: 'Test', html: '<p>Hi</p>' });

    const body = (global.fetch as jest.Mock).mock.calls[0][1].body as URLSearchParams;
    expect(body.get('from')).toBe('Manifest <noreply@manifest.build>');
    expect(body.get('h:Reply-To')).toBe('noreply@manifest.build');
  });

  it('includes text param when provided alongside all required fields', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
    const provider = new MailgunProvider(config);

    await provider.send({
      to: 'user@test.com',
      subject: 'Test',
      html: '<p>Hi</p>',
      text: 'Hi plain',
    });

    const body = (global.fetch as jest.Mock).mock.calls[0][1].body as URLSearchParams;
    expect(body.get('text')).toBe('Hi plain');
    expect(body.get('from')).toBe('Manifest <noreply@test.com>');
    expect(body.get('to')).toBe('user@test.com');
    expect(body.get('subject')).toBe('Test');
    expect(body.get('html')).toBe('<p>Hi</p>');
    expect(body.get('h:Reply-To')).toBe('noreply@test.com');
    expect(body.get('o:tag')).toBe('manifest');
  });

  it('omits text param when not provided', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
    const provider = new MailgunProvider(config);

    await provider.send({ to: 'user@test.com', subject: 'Test', html: '<p>Hi</p>' });

    const body = (global.fetch as jest.Mock).mock.calls[0][1].body as URLSearchParams;
    expect(body.has('text')).toBe(false);
  });

  it('omits text param when explicitly empty string', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
    const provider = new MailgunProvider(config);

    await provider.send({ to: 'user@test.com', subject: 'Test', html: '<p>Hi</p>', text: '' });

    const body = (global.fetch as jest.Mock).mock.calls[0][1].body as URLSearchParams;
    // empty string is falsy, so text should not be appended
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

  it('preserves unicode characters in subject and html', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
    const provider = new MailgunProvider(config);

    await provider.send({
      to: 'user@test.com',
      subject: 'Alert: spend > €100 (你好)',
      html: '<p>Hello 你好 🚨</p>',
    });

    const body = (global.fetch as jest.Mock).mock.calls[0][1].body as URLSearchParams;
    expect(body.get('subject')).toBe('Alert: spend > €100 (你好)');
    expect(body.get('html')).toBe('<p>Hello 你好 🚨</p>');
  });

  it('encodes domain in URL path to prevent injection', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
    // valid domain that contains a hyphen — exercise encodeURIComponent path
    const provider = new MailgunProvider({ ...config, domain: 'mg-prod.test.com' });

    await provider.send({ to: 'user@test.com', subject: 'Test', html: '<p>Hi</p>' });

    const url = (global.fetch as jest.Mock).mock.calls[0][0];
    expect(url).toBe('https://api.mailgun.net/v3/mg-prod.test.com/messages');
  });

  it('rejects domain with path traversal characters', async () => {
    const provider = new MailgunProvider({ ...config, domain: '../../evil.com' });
    const result = await provider.send({ to: 'a@b.com', subject: 'Hi', html: '<p>Hello</p>' });
    expect(result).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects domain with slashes', async () => {
    const provider = new MailgunProvider({ ...config, domain: 'evil.com/redirect' });
    const result = await provider.send({ to: 'a@b.com', subject: 'Hi', html: '<p>Hello</p>' });
    expect(result).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });
});
