import type { AuthSession, AuthUser } from './auth.instance';

const mockBetterAuth = jest.fn().mockReturnValue({
  $Infer: { Session: {} },
  api: {},
});

jest.mock('better-auth', () => ({ betterAuth: mockBetterAuth }));
jest.mock('pg', () => ({ Pool: jest.fn() }));
jest.mock('@react-email/render', () => ({
  render: jest
    .fn()
    .mockImplementation((_el: unknown, opts?: { plainText?: boolean }) =>
      Promise.resolve(opts?.plainText ? 'plain text version' : '<html>rendered</html>'),
    ),
}));
jest.mock('../notifications/emails/verify-email', () => ({
  VerifyEmailEmail: jest.fn().mockReturnValue('verify-email-element'),
}));
jest.mock('../notifications/emails/reset-password', () => ({
  ResetPasswordEmail: jest.fn().mockReturnValue('reset-password-element'),
}));
jest.mock('../notifications/services/email-providers/send-email', () => ({
  sendEmail: jest.fn(),
}));

describe('auth.instance', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    mockBetterAuth.mockClear();
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      BETTER_AUTH_SECRET: 'a]3kF9!xLm2@pQzR7^wYu4&vN6*cE0hT',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  function loadModule() {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('./auth.instance') as typeof import('./auth.instance');
  }

  it('exports a defined auth object', () => {
    const mod = loadModule();
    expect(mod.auth).toBeDefined();
  });

  it('calls betterAuth with telemetry disabled', () => {
    loadModule();

    expect(mockBetterAuth).toHaveBeenCalledTimes(1);
    const config = mockBetterAuth.mock.calls[0][0];
    expect(config.telemetry).toEqual({ enabled: false });
  });

  it('does not set skipStateCookieCheck in account config', () => {
    loadModule();

    const config = mockBetterAuth.mock.calls[0][0];
    expect(config.account).toBeDefined();
    expect(config.account).not.toHaveProperty('skipStateCookieCheck');
  });

  it('enables account linking with trusted providers', () => {
    loadModule();

    const config = mockBetterAuth.mock.calls[0][0];
    expect(config.account.accountLinking).toEqual({
      enabled: true,
      trustedProviders: ['google', 'github', 'discord'],
    });
  });

  it('sets basePath to /api/auth', () => {
    loadModule();

    const config = mockBetterAuth.mock.calls[0][0];
    expect(config.basePath).toBe('/api/auth');
  });

  it('enables emailAndPassword with min length 8', () => {
    loadModule();

    const config = mockBetterAuth.mock.calls[0][0];
    expect(config.emailAndPassword.enabled).toBe(true);
    expect(config.emailAndPassword.minPasswordLength).toBe(8);
  });

  it('does not require email verification when NODE_ENV is not production', () => {
    process.env['NODE_ENV'] = 'test';
    loadModule();

    const config = mockBetterAuth.mock.calls[0][0];
    expect(config.emailAndPassword.requireEmailVerification).toBe(false);
  });

  it('requires email verification in production when email provider is configured', () => {
    process.env['NODE_ENV'] = 'production';
    process.env['BETTER_AUTH_SECRET'] = 'a]3kF9!xLm2@pQzR7^wYu4&vN6*cE0hT';
    process.env['MAILGUN_API_KEY'] = 'key-test';
    process.env['MAILGUN_DOMAIN'] = 'mg.example.com';
    loadModule();

    const config = mockBetterAuth.mock.calls[0][0];
    expect(config.emailAndPassword.requireEmailVerification).toBe(true);
  });

  it('does not require email verification in production when no email provider is configured', () => {
    process.env['NODE_ENV'] = 'production';
    process.env['BETTER_AUTH_SECRET'] = 'a]3kF9!xLm2@pQzR7^wYu4&vN6*cE0hT';
    delete process.env['MAILGUN_API_KEY'];
    delete process.env['MAILGUN_DOMAIN'];
    loadModule();

    const config = mockBetterAuth.mock.calls[0][0];
    expect(config.emailAndPassword.requireEmailVerification).toBe(false);
  });

  it('does not require email verification in development', () => {
    process.env['NODE_ENV'] = 'development';
    loadModule();

    const config = mockBetterAuth.mock.calls[0][0];
    expect(config.emailAndPassword.requireEmailVerification).toBe(false);
  });

  describe('trusted origins', () => {
    it('includes default localhost origins', () => {
      delete process.env['BETTER_AUTH_URL'];
      delete process.env['CORS_ORIGIN'];
      delete process.env['FRONTEND_PORT'];
      process.env['PORT'] = '3001';
      loadModule();

      const config = mockBetterAuth.mock.calls[0][0];
      expect(config.trustedOrigins).toContain('http://localhost:3000');
      expect(config.trustedOrigins).toContain('http://localhost:3001');
    });

    it('includes BETTER_AUTH_URL when set', () => {
      process.env['BETTER_AUTH_URL'] = 'https://app.example.com';
      loadModule();

      const config = mockBetterAuth.mock.calls[0][0];
      expect(config.trustedOrigins).toContain('https://app.example.com');
    });

    it('includes CORS_ORIGIN when set', () => {
      process.env['CORS_ORIGIN'] = 'https://frontend.example.com';
      loadModule();

      const config = mockBetterAuth.mock.calls[0][0];
      expect(config.trustedOrigins).toContain('https://frontend.example.com');
    });

    it('includes FRONTEND_PORT origin when set', () => {
      process.env['FRONTEND_PORT'] = '4000';
      loadModule();

      const config = mockBetterAuth.mock.calls[0][0];
      expect(config.trustedOrigins).toContain('http://localhost:4000');
    });

    it('does not include localhost origins in production mode', () => {
      process.env['NODE_ENV'] = 'production';
      process.env['BETTER_AUTH_SECRET'] = 'a]3kF9!xLm2@pQzR7^wYu4&vN6*cE0hT';
      delete process.env['BETTER_AUTH_URL'];
      delete process.env['CORS_ORIGIN'];
      delete process.env['FRONTEND_PORT'];
      process.env['PORT'] = '3001';
      loadModule();

      const config = mockBetterAuth.mock.calls[0][0];
      expect(config.trustedOrigins).not.toContain('http://localhost:3000');
      expect(config.trustedOrigins).not.toContain('http://localhost:3001');
    });
  });

  describe('social providers', () => {
    it('disables google when env vars are missing', () => {
      delete process.env['GOOGLE_CLIENT_ID'];
      delete process.env['GOOGLE_CLIENT_SECRET'];
      loadModule();

      const config = mockBetterAuth.mock.calls[0][0];
      expect(config.socialProviders.google.enabled).toBe(false);
    });

    it('enables google when both env vars are set', () => {
      process.env['GOOGLE_CLIENT_ID'] = 'google-id';
      process.env['GOOGLE_CLIENT_SECRET'] = 'google-secret';
      loadModule();

      const config = mockBetterAuth.mock.calls[0][0];
      expect(config.socialProviders.google.enabled).toBe(true);
      expect(config.socialProviders.google.clientId).toBe('google-id');
    });

    it('disables github when env vars are missing', () => {
      delete process.env['GITHUB_CLIENT_ID'];
      delete process.env['GITHUB_CLIENT_SECRET'];
      loadModule();

      const config = mockBetterAuth.mock.calls[0][0];
      expect(config.socialProviders.github.enabled).toBe(false);
    });

    it('disables discord when env vars are missing', () => {
      delete process.env['DISCORD_CLIENT_ID'];
      delete process.env['DISCORD_CLIENT_SECRET'];
      loadModule();

      const config = mockBetterAuth.mock.calls[0][0];
      expect(config.socialProviders.discord.enabled).toBe(false);
    });
  });

  describe('secret validation', () => {
    it('skips validation when NODE_ENV is test', () => {
      process.env['NODE_ENV'] = 'test';
      process.env['BETTER_AUTH_SECRET'] = '';
      expect(() => loadModule()).not.toThrow();
    });

    it('throws when secret is missing in non-test env', () => {
      process.env['NODE_ENV'] = 'development';
      process.env['BETTER_AUTH_SECRET'] = '';
      expect(() => loadModule()).toThrow(
        'BETTER_AUTH_SECRET must be set to a value of at least 32 characters',
      );
    });

    it('throws when secret is too short in non-test env', () => {
      process.env['NODE_ENV'] = 'production';
      process.env['BETTER_AUTH_SECRET'] = 'short';
      expect(() => loadModule()).toThrow(
        'BETTER_AUTH_SECRET must be set to a value of at least 32 characters',
      );
    });
  });

  describe('sendResetPassword callback', () => {
    it('renders the reset password email and calls sendEmail', async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { ResetPasswordEmail } = require('../notifications/emails/reset-password') as {
        ResetPasswordEmail: jest.Mock;
      };
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { sendEmail } = require('../notifications/services/email-providers/send-email') as {
        sendEmail: jest.Mock;
      };
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { render } = require('@react-email/render') as { render: jest.Mock };

      loadModule();

      const config = mockBetterAuth.mock.calls[0][0];
      const sendResetPassword = config.emailAndPassword.sendResetPassword;

      const mockUser = { name: 'Jane Doe', email: 'jane@example.com' };
      const mockUrl = 'https://app.example.com/reset?token=abc123';

      await sendResetPassword({ user: mockUser, url: mockUrl });

      expect(ResetPasswordEmail).toHaveBeenCalledWith({
        userName: 'Jane Doe',
        resetUrl: mockUrl,
      });
      expect(render).toHaveBeenCalledTimes(2);
      expect(render).toHaveBeenCalledWith('reset-password-element');
      expect(render).toHaveBeenCalledWith('reset-password-element', { plainText: true });
      expect(sendEmail).toHaveBeenCalledWith({
        to: 'jane@example.com',
        subject: 'Reset your password',
        html: '<html>rendered</html>',
        text: 'plain text version',
      });
    });
  });

  describe('sendVerificationEmail callback', () => {
    it('renders the verification email and calls sendEmail', async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { VerifyEmailEmail } = require('../notifications/emails/verify-email') as {
        VerifyEmailEmail: jest.Mock;
      };
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { sendEmail } = require('../notifications/services/email-providers/send-email') as {
        sendEmail: jest.Mock;
      };
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { render } = require('@react-email/render') as { render: jest.Mock };

      loadModule();

      const config = mockBetterAuth.mock.calls[0][0];
      const sendVerificationEmail = config.emailVerification.sendVerificationEmail;

      const mockUser = { name: 'John Doe', email: 'john@example.com' };
      const mockUrl = 'https://app.example.com/verify?token=xyz789';

      await sendVerificationEmail({ user: mockUser, url: mockUrl });

      expect(VerifyEmailEmail).toHaveBeenCalledWith({
        userName: 'John Doe',
        verificationUrl: mockUrl,
      });
      expect(render).toHaveBeenCalledWith('verify-email-element');
      expect(render).toHaveBeenCalledWith('verify-email-element', { plainText: true });
      expect(sendEmail).toHaveBeenCalledWith({
        to: 'john@example.com',
        subject: 'Verify your email address',
        html: '<html>rendered</html>',
        text: 'plain text version',
      });
    });

    it('sends verification email on sign-up when Mailgun email provider is configured', () => {
      process.env['MAILGUN_API_KEY'] = 'key-test';
      process.env['MAILGUN_DOMAIN'] = 'mg.example.com';
      loadModule();

      const config = mockBetterAuth.mock.calls[0][0];
      expect(config.emailVerification.sendOnSignUp).toBe(true);
    });

    it('sends verification email on sign-up when unified EMAIL_* is configured', () => {
      process.env['EMAIL_PROVIDER'] = 'resend';
      process.env['EMAIL_API_KEY'] = 're_test';
      loadModule();

      const config = mockBetterAuth.mock.calls[0][0];
      expect(config.emailVerification.sendOnSignUp).toBe(true);
    });

    it('does not send verification email on sign-up when no email provider is configured', () => {
      delete process.env['MAILGUN_API_KEY'];
      delete process.env['MAILGUN_DOMAIN'];
      delete process.env['EMAIL_PROVIDER'];
      delete process.env['EMAIL_API_KEY'];
      loadModule();

      const config = mockBetterAuth.mock.calls[0][0];
      expect(config.emailVerification.sendOnSignUp).toBe(false);
    });

    it('enables autoSignInAfterVerification', () => {
      loadModule();

      const config = mockBetterAuth.mock.calls[0][0];
      expect(config.emailVerification.autoSignInAfterVerification).toBe(true);
    });
  });

  describe('database connection', () => {
    it('uses DATABASE_URL from environment', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Pool } = require('pg') as { Pool: jest.Mock };
      process.env['DATABASE_URL'] = 'postgresql://test:test@db:5432/testdb';

      loadModule();

      expect(Pool).toHaveBeenCalledWith({
        connectionString: 'postgresql://test:test@db:5432/testdb',
      });
    });

    it('falls back to default DATABASE_URL when not set', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Pool } = require('pg') as { Pool: jest.Mock };
      delete process.env['DATABASE_URL'];

      loadModule();

      expect(Pool).toHaveBeenCalledWith({
        connectionString: 'postgresql://myuser:mypassword@localhost:5432/mydatabase',
      });
    });
  });

  describe('baseURL configuration', () => {
    it('uses BETTER_AUTH_URL when set', () => {
      process.env['BETTER_AUTH_URL'] = 'https://auth.example.com';
      loadModule();

      const config = mockBetterAuth.mock.calls[0][0];
      expect(config.baseURL).toBe('https://auth.example.com');
    });

    it('falls back to localhost with PORT when BETTER_AUTH_URL is not set', () => {
      delete process.env['BETTER_AUTH_URL'];
      process.env['PORT'] = '4000';
      loadModule();

      const config = mockBetterAuth.mock.calls[0][0];
      expect(config.baseURL).toBe('http://localhost:4000');
    });

    it('falls back to localhost:3001 when neither BETTER_AUTH_URL nor PORT is set', () => {
      delete process.env['BETTER_AUTH_URL'];
      delete process.env['PORT'];
      loadModule();

      const config = mockBetterAuth.mock.calls[0][0];
      expect(config.baseURL).toBe('http://localhost:3001');
    });
  });

  describe('exported types', () => {
    it('exports AuthSession and AuthUser types', () => {
      // Type-level check: these compile without errors
      const _session: AuthSession | undefined = undefined;
      const _user: AuthUser | undefined = undefined;
      expect(_session).toBeUndefined();
      expect(_user).toBeUndefined();
    });
  });
});
