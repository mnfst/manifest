import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getLastAuthMethod, setLastAuthMethod } from '../../src/services/last-auth-method';

const STORAGE_KEY = 'manifest:last-auth-method';

describe('last-auth-method', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null when nothing has been stored', () => {
    expect(getLastAuthMethod()).toBeNull();
  });

  it('round-trips a valid method', () => {
    setLastAuthMethod('google');
    expect(getLastAuthMethod()).toBe('google');
  });

  it('persists the latest write', () => {
    setLastAuthMethod('google');
    setLastAuthMethod('email');
    expect(getLastAuthMethod()).toBe('email');
  });

  it('accepts every supported provider', () => {
    for (const method of ['email', 'google', 'github', 'discord'] as const) {
      setLastAuthMethod(method);
      expect(getLastAuthMethod()).toBe(method);
    }
  });

  it('rejects unrecognized values stored under the key', () => {
    localStorage.setItem(STORAGE_KEY, 'twitter');
    expect(getLastAuthMethod()).toBeNull();
  });

  it('returns null when localStorage.getItem throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(getLastAuthMethod()).toBeNull();
  });

  it('swallows errors when localStorage.setItem throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    expect(() => setLastAuthMethod('github')).not.toThrow();
  });
});
