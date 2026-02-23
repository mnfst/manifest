jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
}));

import {
  LOCAL_USER_ID,
  LOCAL_EMAIL,
  LOCAL_DEFAULT_PORT,
  getLocalAuthSecret,
  getLocalPassword,
  readLocalEmailConfig,
  writeLocalEmailConfig,
  clearLocalEmailConfig,
  readLocalNotificationEmail,
  writeLocalNotificationEmail,
} from './local-mode.constants';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs');

describe('local-mode.constants', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('static constants', () => {
    it('exports LOCAL_USER_ID', () => {
      expect(LOCAL_USER_ID).toBe('local-user-001');
    });

    it('exports LOCAL_EMAIL', () => {
      expect(LOCAL_EMAIL).toBe('local@manifest.local');
    });

    it('exports LOCAL_DEFAULT_PORT', () => {
      expect(LOCAL_DEFAULT_PORT).toBe(2099);
    });
  });

  describe('getLocalAuthSecret', () => {
    it('generates a random secret when config file does not exist', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const secret = getLocalAuthSecret();

      expect(secret).toHaveLength(64); // 32 bytes hex
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('returns existing secret from config file', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(
        JSON.stringify({ authSecret: 'a'.repeat(64) }),
      );

      const secret = getLocalAuthSecret();

      expect(secret).toBe('a'.repeat(64));
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it('regenerates when existing secret is too short', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(
        JSON.stringify({ authSecret: 'too-short' }),
      );

      const secret = getLocalAuthSecret();

      expect(secret).toHaveLength(64);
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('regenerates when config file is corrupted', () => {
      (fs.existsSync as jest.Mock)
        .mockReturnValueOnce(true)   // ensureConfigDir
        .mockReturnValueOnce(true);  // config file exists
      (fs.readFileSync as jest.Mock).mockReturnValue('not-json{{{');

      const secret = getLocalAuthSecret();

      expect(secret).toHaveLength(64);
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('creates config directory with 0o700 permissions', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      getLocalAuthSecret();

      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ recursive: true, mode: 0o700 }),
      );
    });
  });

  describe('getLocalPassword', () => {
    it('generates a random password when config file does not exist', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const password = getLocalPassword();

      expect(password.length).toBeGreaterThanOrEqual(16);
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('returns existing password from config file', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(
        JSON.stringify({ localPassword: 'a-valid-password-long-enough' }),
      );

      const password = getLocalPassword();

      expect(password).toBe('a-valid-password-long-enough');
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it('regenerates when existing password is too short', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(
        JSON.stringify({ localPassword: 'short' }),
      );

      const password = getLocalPassword();

      expect(password.length).toBeGreaterThanOrEqual(16);
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('preserves existing config fields when writing', () => {
      (fs.existsSync as jest.Mock)
        .mockReturnValueOnce(true)   // ensureConfigDir
        .mockReturnValueOnce(true)   // readConfig check
        .mockReturnValueOnce(true)   // writeConfig ensureConfigDir
        .mockReturnValueOnce(false); // writeConfig config file (doesn't matter)
      (fs.readFileSync as jest.Mock).mockReturnValue(
        JSON.stringify({ apiKey: 'mnfst_existing', authSecret: 'x'.repeat(64) }),
      );

      getLocalPassword();

      const writeCall = (fs.writeFileSync as jest.Mock).mock.calls[0];
      const written = JSON.parse(writeCall[1]);
      expect(written.apiKey).toBe('mnfst_existing');
      expect(written.authSecret).toBe('x'.repeat(64));
      expect(written.localPassword).toBeDefined();
    });

    it('writes config file with 0o600 permissions', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      getLocalPassword();

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({ mode: 0o600 }),
      );
    });
  });

  describe('readLocalEmailConfig', () => {
    it('returns null when no email config in file', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify({ apiKey: 'mnfst_key' }));

      const result = readLocalEmailConfig();
      expect(result).toBeNull();
    });

    it('returns null when emailProvider missing', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(
        JSON.stringify({ emailApiKey: 'some-key' }),
      );

      const result = readLocalEmailConfig();
      expect(result).toBeNull();
    });

    it('returns config when email provider and key are set', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(
        JSON.stringify({
          emailProvider: 'resend',
          emailApiKey: 're_key',
          emailDomain: 'test.com',
          emailFromAddress: 'noreply@test.com',
        }),
      );

      const result = readLocalEmailConfig();
      expect(result).toEqual({
        provider: 'resend',
        apiKey: 're_key',
        domain: 'test.com',
        fromEmail: 'noreply@test.com',
      });
    });
  });

  describe('writeLocalEmailConfig', () => {
    it('writes email config fields to config file', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify({ apiKey: 'existing' }));

      writeLocalEmailConfig({
        provider: 'sendgrid',
        apiKey: 'sg-key',
        domain: 'test.com',
        fromEmail: 'noreply@test.com',
      });

      const written = JSON.parse((fs.writeFileSync as jest.Mock).mock.calls[0][1]);
      expect(written.apiKey).toBe('existing');
      expect(written.emailProvider).toBe('sendgrid');
      expect(written.emailApiKey).toBe('sg-key');
      expect(written.emailDomain).toBe('test.com');
      expect(written.emailFromAddress).toBe('noreply@test.com');
    });
  });

  describe('clearLocalEmailConfig', () => {
    it('removes email config fields from config file', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(
        JSON.stringify({
          apiKey: 'existing',
          emailProvider: 'resend',
          emailApiKey: 're_key',
          emailDomain: 'test.com',
          emailFromAddress: 'noreply@test.com',
        }),
      );

      clearLocalEmailConfig();

      const written = JSON.parse((fs.writeFileSync as jest.Mock).mock.calls[0][1]);
      expect(written.apiKey).toBe('existing');
      expect(written.emailProvider).toBeUndefined();
      expect(written.emailApiKey).toBeUndefined();
      expect(written.emailDomain).toBeUndefined();
      expect(written.emailFromAddress).toBeUndefined();
    });
  });

  describe('readLocalNotificationEmail', () => {
    it('returns null when no notification email in config', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify({ apiKey: 'existing' }));

      const result = readLocalNotificationEmail();
      expect(result).toBeNull();
    });

    it('returns email when notification email is set', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(
        JSON.stringify({ notificationEmail: 'user@real.com' }),
      );

      const result = readLocalNotificationEmail();
      expect(result).toBe('user@real.com');
    });

    it('returns null when config file does not exist', () => {
      (fs.existsSync as jest.Mock)
        .mockReturnValueOnce(true)  // ensureConfigDir
        .mockReturnValueOnce(false); // config file

      const result = readLocalNotificationEmail();
      expect(result).toBeNull();
    });
  });

  describe('writeLocalNotificationEmail', () => {
    it('writes notification email to config file', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify({ apiKey: 'existing' }));

      writeLocalNotificationEmail('user@real.com');

      const written = JSON.parse((fs.writeFileSync as jest.Mock).mock.calls[0][1]);
      expect(written.apiKey).toBe('existing');
      expect(written.notificationEmail).toBe('user@real.com');
    });

    it('overwrites existing notification email', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(
        JSON.stringify({ notificationEmail: 'old@example.com' }),
      );

      writeLocalNotificationEmail('new@example.com');

      const written = JSON.parse((fs.writeFileSync as jest.Mock).mock.calls[0][1]);
      expect(written.notificationEmail).toBe('new@example.com');
    });
  });
});
