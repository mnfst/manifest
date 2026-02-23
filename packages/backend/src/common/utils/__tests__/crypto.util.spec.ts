import { encrypt, decrypt, isEncrypted, getEncryptionSecret } from '../crypto.util';

const TEST_SECRET = 'a'.repeat(32);

describe('encrypt / decrypt', () => {
  it('round-trips correctly', () => {
    const plaintext = 'sk-ant-api03-super-secret-key-12345';
    const ciphertext = encrypt(plaintext, TEST_SECRET);
    expect(decrypt(ciphertext, TEST_SECRET)).toBe(plaintext);
  });

  it('produces different ciphertexts for different plaintexts', () => {
    const c1 = encrypt('secret-a', TEST_SECRET);
    const c2 = encrypt('secret-b', TEST_SECRET);
    expect(c1).not.toBe(c2);
  });

  it('produces different ciphertexts for same plaintext (random salt/IV)', () => {
    const c1 = encrypt('same', TEST_SECRET);
    const c2 = encrypt('same', TEST_SECRET);
    expect(c1).not.toBe(c2);
  });

  it('throws when decrypting with wrong secret', () => {
    const ciphertext = encrypt('secret', TEST_SECRET);
    expect(() => decrypt(ciphertext, 'b'.repeat(32))).toThrow();
  });

  it('throws for malformed ciphertext', () => {
    expect(() => decrypt('not:valid', TEST_SECRET)).toThrow(
      'Invalid ciphertext format',
    );
  });

  it('round-trips empty string', () => {
    const ciphertext = encrypt('', TEST_SECRET);
    expect(decrypt(ciphertext, TEST_SECRET)).toBe('');
  });

  it('round-trips long plaintext (10k chars)', () => {
    const long = 'a'.repeat(10_000);
    const ciphertext = encrypt(long, TEST_SECRET);
    expect(decrypt(ciphertext, TEST_SECRET)).toBe(long);
  });

  it('throws for tampered ciphertext (modified encrypted data)', () => {
    const ciphertext = encrypt('secret', TEST_SECRET);
    const parts = ciphertext.split(':');
    const encrypted = Buffer.from(parts[3], 'base64');
    encrypted[0] ^= 0xff;
    parts[3] = encrypted.toString('base64');
    expect(() => decrypt(parts.join(':'), TEST_SECRET)).toThrow();
  });

  it('round-trips unicode plaintext', () => {
    const unicode = 'Hello \u00e9\u00e8\u00ea \u4f60\u597d \ud83d\ude00';
    const ciphertext = encrypt(unicode, TEST_SECRET);
    expect(decrypt(ciphertext, TEST_SECRET)).toBe(unicode);
  });
});

describe('isEncrypted', () => {
  it('returns true for encrypt() output', () => {
    const ciphertext = encrypt('test', TEST_SECRET);
    expect(isEncrypted(ciphertext)).toBe(true);
  });

  it('returns false for plaintext strings', () => {
    expect(isEncrypted('just-a-plain-string')).toBe(false);
  });

  it('returns false for typical API key format', () => {
    expect(isEncrypted('sk-ant-api03-abcdef123456')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isEncrypted('')).toBe(false);
  });

  it('returns false for 4 colon-separated non-base64 parts', () => {
    expect(isEncrypted('not!valid:also!bad:more!bad:still!bad')).toBe(false);
  });

  it('returns false for 3 valid base64 parts (wrong count)', () => {
    expect(isEncrypted('dGVzdA==:dGVzdA==:dGVzdA==')).toBe(false);
  });
});

describe('getEncryptionSecret', () => {
  const origEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...origEnv };
  });

  it('throws when no env var is set', () => {
    delete process.env['MANIFEST_ENCRYPTION_KEY'];
    delete process.env['BETTER_AUTH_SECRET'];
    expect(() => getEncryptionSecret()).toThrow('Encryption secret required');
  });

  it('returns MANIFEST_ENCRYPTION_KEY when both are set', () => {
    process.env['MANIFEST_ENCRYPTION_KEY'] = 'x'.repeat(32);
    process.env['BETTER_AUTH_SECRET'] = 'y'.repeat(32);
    expect(getEncryptionSecret()).toBe('x'.repeat(32));
  });

  it('falls back to BETTER_AUTH_SECRET', () => {
    delete process.env['MANIFEST_ENCRYPTION_KEY'];
    process.env['BETTER_AUTH_SECRET'] = 'z'.repeat(32);
    expect(getEncryptionSecret()).toBe('z'.repeat(32));
  });

  it('throws when secret is too short', () => {
    process.env['BETTER_AUTH_SECRET'] = 'short';
    delete process.env['MANIFEST_ENCRYPTION_KEY'];
    expect(() => getEncryptionSecret()).toThrow('Encryption secret required');
  });
});
