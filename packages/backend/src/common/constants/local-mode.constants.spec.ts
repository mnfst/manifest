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
});
