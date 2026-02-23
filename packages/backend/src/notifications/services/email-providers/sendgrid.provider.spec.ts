import { SendGridProvider } from './sendgrid.provider';
import { EmailProviderConfig } from './email-provider.interface';

describe('SendGridProvider', () => {
  beforeEach(() => {
    jest.spyOn(global, 'fetch').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const config: EmailProviderConfig = {
    provider: 'sendgrid',
    apiKey: 'SG.test-key',
    fromEmail: 'noreply@test.com',
  };

  it('sends email and returns true on success', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
    const provider = new SendGridProvider(config);

    const result = await provider.send({ to: 'user@test.com', subject: 'Test', html: '<p>Hi</p>' });

    expect(result).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      'https://api.sendgrid.com/v3/mail/send',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('uses Bearer auth header', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
    const provider = new SendGridProvider(config);

    await provider.send({ to: 'user@test.com', subject: 'Test', html: '<p>Hi</p>' });

    const headers = (global.fetch as jest.Mock).mock.calls[0][1].headers;
    expect(headers.Authorization).toBe('Bearer SG.test-key');
  });

  it('sends correct JSON body structure', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
    const provider = new SendGridProvider(config);

    await provider.send({ to: 'user@test.com', subject: 'Test', html: '<p>Hi</p>' });

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.personalizations[0].to[0].email).toBe('user@test.com');
    expect(body.from.email).toBe('noreply@test.com');
    expect(body.subject).toBe('Test');
    expect(body.content[0].type).toBe('text/html');
  });

  it('returns false when apiKey is empty', async () => {
    const provider = new SendGridProvider({ ...config, apiKey: '' });
    const result = await provider.send({ to: 'a@b.com', subject: 'Hi', html: '<p>Hello</p>' });
    expect(result).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns false on non-ok response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 403, text: async () => 'Forbidden' });
    const provider = new SendGridProvider(config);

    const result = await provider.send({ to: 'user@test.com', subject: 'Test', html: '<p>Hi</p>' });
    expect(result).toBe(false);
  });

  it('returns false on network error', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network failure'));
    const provider = new SendGridProvider(config);

    const result = await provider.send({ to: 'user@test.com', subject: 'Test', html: '<p>Hi</p>' });
    expect(result).toBe(false);
  });

  it('extracts email from "Name <email>" from address', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
    const provider = new SendGridProvider(config);

    await provider.send({ to: 'user@test.com', subject: 'Test', html: '<p>Hi</p>', from: 'Manifest <custom@test.com>' });

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.from.email).toBe('custom@test.com');
  });

  it('includes text/plain content when text is provided', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
    const provider = new SendGridProvider(config);

    await provider.send({ to: 'user@test.com', subject: 'Test', html: '<p>Hi</p>', text: 'Hi plain' });

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.content).toEqual([
      { type: 'text/plain', value: 'Hi plain' },
      { type: 'text/html', value: '<p>Hi</p>' },
    ]);
  });

  it('omits text/plain content when text is not provided', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
    const provider = new SendGridProvider(config);

    await provider.send({ to: 'user@test.com', subject: 'Test', html: '<p>Hi</p>' });

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.content).toEqual([{ type: 'text/html', value: '<p>Hi</p>' }]);
  });
});
