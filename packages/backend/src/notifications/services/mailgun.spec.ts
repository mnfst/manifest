import { sendMailgunEmail } from './mailgun';

describe('sendMailgunEmail', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    jest.spyOn(global, 'fetch').mockImplementation();
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it('returns false when Mailgun not configured', async () => {
    delete process.env['MAILGUN_API_KEY'];
    delete process.env['MAILGUN_DOMAIN'];

    const result = await sendMailgunEmail({ to: 'a@b.com', subject: 'Hi', html: '<p>Hello</p>' });

    expect(result).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('sends email and returns true on success', async () => {
    process.env['MAILGUN_API_KEY'] = 'test-key';
    process.env['MAILGUN_DOMAIN'] = 'mg.test.com';
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

    const result = await sendMailgunEmail({ to: 'user@test.com', subject: 'Test', html: '<p>Hi</p>' });

    expect(result).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      'https://api.mailgun.net/v3/mg.test.com/messages',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('returns false on non-ok response', async () => {
    process.env['MAILGUN_API_KEY'] = 'test-key';
    process.env['MAILGUN_DOMAIN'] = 'mg.test.com';
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 401, text: async () => 'Unauthorized' });

    const result = await sendMailgunEmail({ to: 'user@test.com', subject: 'Test', html: '<p>Hi</p>' });

    expect(result).toBe(false);
  });

  it('returns false on network error', async () => {
    process.env['MAILGUN_API_KEY'] = 'test-key';
    process.env['MAILGUN_DOMAIN'] = 'mg.test.com';
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network failure'));

    const result = await sendMailgunEmail({ to: 'user@test.com', subject: 'Test', html: '<p>Hi</p>' });

    expect(result).toBe(false);
  });

  it('uses custom from address when provided', async () => {
    process.env['MAILGUN_API_KEY'] = 'test-key';
    process.env['MAILGUN_DOMAIN'] = 'mg.test.com';
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

    await sendMailgunEmail({ to: 'user@test.com', subject: 'Test', html: '<p>Hi</p>', from: 'Custom <custom@test.com>' });

    const body = (global.fetch as jest.Mock).mock.calls[0][1].body as URLSearchParams;
    expect(body.get('from')).toBe('Custom <custom@test.com>');
  });
});
