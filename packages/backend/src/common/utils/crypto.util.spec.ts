import { getEncryptionSecret, encrypt, decrypt, isEncrypted } from './crypto.util';

jest.mock('../../common/constants/local-mode.constants', () => ({
  getLocalAuthSecret: jest.fn(),
}));

describe('getEncryptionSecret', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env['MANIFEST_ENCRYPTION_KEY'];
    delete process.env['BETTER_AUTH_SECRET'];
    delete process.env['MANIFEST_MODE'];
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it('returns MANIFEST_ENCRYPTION_KEY when it is >= 32 chars', () => {
    const key = 'a'.repeat(32);
    process.env['MANIFEST_ENCRYPTION_KEY'] = key;
    expect(getEncryptionSecret()).toBe(key);
  });

  it('returns BETTER_AUTH_SECRET when MANIFEST_ENCRYPTION_KEY is not set and secret is >= 32 chars', () => {
    const secret = 'b'.repeat(64);
    process.env['BETTER_AUTH_SECRET'] = secret;
    expect(getEncryptionSecret()).toBe(secret);
  });

  it('prefers MANIFEST_ENCRYPTION_KEY over BETTER_AUTH_SECRET', () => {
    const encKey = 'e'.repeat(32);
    const authSecret = 'a'.repeat(64);
    process.env['MANIFEST_ENCRYPTION_KEY'] = encKey;
    process.env['BETTER_AUTH_SECRET'] = authSecret;
    expect(getEncryptionSecret()).toBe(encKey);
  });

  it('falls through to local mode when key is too short', () => {
    process.env['BETTER_AUTH_SECRET'] = 'short';
    process.env['MANIFEST_MODE'] = 'local';
    const mockSecret = 'local-secret-' + 'x'.repeat(32);
    const { getLocalAuthSecret } = require('../../common/constants/local-mode.constants');
    (getLocalAuthSecret as jest.Mock).mockReturnValue(mockSecret);
    expect(getEncryptionSecret()).toBe(mockSecret);
  });

  it('calls getLocalAuthSecret in local mode when no env key is set', () => {
    process.env['MANIFEST_MODE'] = 'local';
    const mockSecret = 'local-fallback-' + 'y'.repeat(32);
    const { getLocalAuthSecret } = require('../../common/constants/local-mode.constants');
    (getLocalAuthSecret as jest.Mock).mockReturnValue(mockSecret);
    expect(getEncryptionSecret()).toBe(mockSecret);
  });

  it('throws when no key is set and not in local mode', () => {
    expect(() => getEncryptionSecret()).toThrow(
      'Encryption secret required. Set MANIFEST_ENCRYPTION_KEY or BETTER_AUTH_SECRET (>=32 chars).',
    );
  });

  it('throws when key exists but is shorter than 32 chars and not in local mode', () => {
    process.env['BETTER_AUTH_SECRET'] = 'only-31-chars-long-xxxxxxxxxx!';
    expect(() => getEncryptionSecret()).toThrow(
      'Encryption secret required.',
    );
  });
});

describe('encrypt / decrypt', () => {
  const secret = 'test-secret-that-is-long-enough-for-scrypt';

  it('round-trips plaintext', () => {
    const plaintext = 'hello world';
    const ciphertext = encrypt(plaintext, secret);
    expect(decrypt(ciphertext, secret)).toBe(plaintext);
  });

  it('produces different ciphertext each call (random salt/iv)', () => {
    const plaintext = 'deterministic?';
    const a = encrypt(plaintext, secret);
    const b = encrypt(plaintext, secret);
    expect(a).not.toBe(b);
  });

  it('decrypt throws on malformed ciphertext', () => {
    expect(() => decrypt('not:valid', secret)).toThrow('Invalid ciphertext format');
  });

  it('decrypt throws on tampered ciphertext', () => {
    const ciphertext = encrypt('secret data', secret);
    const parts = ciphertext.split(':');
    // Flip a character in the encrypted portion
    parts[3] = 'AAAA' + parts[3].slice(4);
    expect(() => decrypt(parts.join(':'), secret)).toThrow();
  });
});

describe('isEncrypted', () => {
  const secret = 'test-secret-that-is-long-enough-for-scrypt';

  it('returns true for a valid encrypted string', () => {
    const ciphertext = encrypt('test', secret);
    expect(isEncrypted(ciphertext)).toBe(true);
  });

  it('returns false for plain text', () => {
    expect(isEncrypted('just-a-plain-string')).toBe(false);
  });

  it('returns false for wrong number of parts', () => {
    expect(isEncrypted('a:b:c')).toBe(false);
  });

  it('returns false when parts are not valid base64', () => {
    expect(isEncrypted('not!base64:not!base64:not!base64:not!base64')).toBe(false);
  });
});
