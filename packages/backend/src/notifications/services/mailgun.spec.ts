describe('sendMailgunEmail', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  async function loadMailgun() {
    return import('./mailgun');
  }

  it('returns false when MAILGUN_API_KEY is not set', async () => {
    delete process.env['MAILGUN_API_KEY'];
    delete process.env['MAILGUN_DOMAIN'];
    const { sendMailgunEmail } = await loadMailgun();

    const result = await sendMailgunEmail({
      to: 'test@test.com',
      subject: 'Test',
      html: '<p>Hello</p>',
    });

    expect(result).toBe(false);
  });

  it('returns false when MAILGUN_DOMAIN is not set', async () => {
    process.env['MAILGUN_API_KEY'] = 'test-key';
    delete process.env['MAILGUN_DOMAIN'];
    const { sendMailgunEmail } = await loadMailgun();

    const result = await sendMailgunEmail({
      to: 'test@test.com',
      subject: 'Test',
      html: '<p>Hello</p>',
    });

    expect(result).toBe(false);
  });

  it('sends email when configured and returns true', async () => {
    process.env['MAILGUN_API_KEY'] = 'test-key';
    process.env['MAILGUN_DOMAIN'] = 'mg.example.com';

    const mockFetch = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = mockFetch;

    const { sendMailgunEmail } = await loadMailgun();

    const result = await sendMailgunEmail({
      to: 'test@test.com',
      subject: 'Test Subject',
      html: '<p>Body</p>',
    });

    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.mailgun.net/v3/mg.example.com/messages',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('returns false when API returns non-ok status', async () => {
    process.env['MAILGUN_API_KEY'] = 'test-key';
    process.env['MAILGUN_DOMAIN'] = 'mg.example.com';

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: () => Promise.resolve('Bad Request'),
    });

    const { sendMailgunEmail } = await loadMailgun();

    const result = await sendMailgunEmail({
      to: 'test@test.com',
      subject: 'Test',
      html: '<p>Body</p>',
    });

    expect(result).toBe(false);
  });

  it('returns false when fetch throws', async () => {
    process.env['MAILGUN_API_KEY'] = 'test-key';
    process.env['MAILGUN_DOMAIN'] = 'mg.example.com';

    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

    const { sendMailgunEmail } = await loadMailgun();

    const result = await sendMailgunEmail({
      to: 'test@test.com',
      subject: 'Test',
      html: '<p>Body</p>',
    });

    expect(result).toBe(false);
  });
});
