import { getEncryptionSecret, encrypt, decrypt, isEncrypted } from './crypto.util';

describe('getEncryptionSecret', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env['MANIFEST_ENCRYPTION_KEY'];
    delete process.env['BETTER_AUTH_SECRET'];
  });

  afterEach(() => {
    process.env = originalEnv;
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

  it('throws when no key is set', () => {
    expect(() => getEncryptionSecret()).toThrow(
      'Encryption secret required. Set MANIFEST_ENCRYPTION_KEY or BETTER_AUTH_SECRET (>=32 chars).',
    );
  });

  it('throws when key exists but is shorter than 32 chars', () => {
    process.env['BETTER_AUTH_SECRET'] = 'only-31-chars-long-xxxxxxxxxx!';
    expect(() => getEncryptionSecret()).toThrow('Encryption secret required.');
  });
});

describe('encrypt / decrypt', () => {
  const secret = 'test-secret-that-is-long-enough-for-scrypt';

  it('round-trips plaintext', () => {
    const plaintext = 'hello world';
    const ciphertext = encrypt(plaintext, secret);
    expect(decrypt(ciphertext, secret)).toBe(plaintext);
  });

  it('round-trips empty plaintext', () => {
    // AES-GCM must accept zero-length messages — cipher.update('', 'utf8') and
    // cipher.final() should produce a valid (empty) ciphertext + auth tag that
    // round-trips cleanly. Regression guard for any future refactor that
    // mishandles empty input (e.g. short-circuiting before final()).
    const ciphertext = encrypt('', secret);
    // Even an empty plaintext must produce the 4-part envelope.
    expect(ciphertext.split(':').length).toBe(4);
    expect(decrypt(ciphertext, secret)).toBe('');
  });

  it('round-trips unicode and multi-byte plaintext', () => {
    const plaintext = 'café — 日本語 — 🚀';
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

  it('decrypt throws when the wrong secret is used', () => {
    const ciphertext = encrypt('payload', secret);
    const wrongSecret = 'different-secret-also-long-enough-for-scrypt';
    expect(() => decrypt(ciphertext, wrongSecret)).toThrow();
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

  it('returns false when Buffer.from throws (catch branch)', () => {
    // The catch branch in isEncrypted only fires if Buffer.from itself throws.
    // We stub it to throw on any base64 decode call, then assert (a) the
    // function still returns false (i.e. the catch is actually entered) and
    // (b) our mock was invoked with the 'base64' encoding — without (b), a
    // refactor that stopped calling Buffer.from would pass silently and leave
    // the catch branch uncovered.
    const originalFrom = Buffer.from.bind(Buffer);
    const mockFrom = jest.fn().mockImplementation((value: unknown, encoding?: string) => {
      if (encoding === 'base64') throw new Error('mocked');
      return originalFrom(value as string, encoding as BufferEncoding);
    });
    Buffer.from = mockFrom as unknown as typeof Buffer.from;

    try {
      expect(isEncrypted('a:b:c:d')).toBe(false);
      // Confirm the catch branch was actually exercised — at least one
      // base64 decode attempt must have happened before the throw.
      const base64Calls = mockFrom.mock.calls.filter((args) => args[1] === 'base64');
      expect(base64Calls.length).toBeGreaterThan(0);
    } finally {
      Buffer.from = originalFrom as unknown as typeof Buffer.from;
    }
  });

  it('returns false when a part round-trips to a different base64 string', () => {
    // Buffer.from('AB', 'base64').toString('base64') === 'AA==' (re-encoded
    // form), so a non-canonical base64 part that does not round-trip cleanly
    // must be rejected as not-encrypted. This guards the
    // `buf.toString('base64') !== part` branch inside isEncrypted.
    expect(isEncrypted('AB:AB:AB:AB')).toBe(false);
  });
});
