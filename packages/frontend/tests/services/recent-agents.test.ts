import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  markAgentCreated,
  isRecentlyCreated,
  clearRecentAgent,
  markSetupPending,
  isSetupPending,
  clearSetupPending,
} from '../../src/services/recent-agents';

describe('recent-agents', () => {
  beforeEach(() => {
    clearRecentAgent('test-slug');
    clearRecentAgent('another-slug');
  });

  it('returns false for unknown slug', () => {
    expect(isRecentlyCreated('unknown')).toBe(false);
  });

  it('returns true after marking a slug as created', () => {
    markAgentCreated('test-slug');
    expect(isRecentlyCreated('test-slug')).toBe(true);
  });

  it('returns false after clearing a slug', () => {
    markAgentCreated('test-slug');
    clearRecentAgent('test-slug');
    expect(isRecentlyCreated('test-slug')).toBe(false);
  });

  it('tracks multiple slugs independently', () => {
    markAgentCreated('test-slug');
    markAgentCreated('another-slug');
    expect(isRecentlyCreated('test-slug')).toBe(true);
    expect(isRecentlyCreated('another-slug')).toBe(true);
    clearRecentAgent('test-slug');
    expect(isRecentlyCreated('test-slug')).toBe(false);
    expect(isRecentlyCreated('another-slug')).toBe(true);
  });

  it('clearRecentAgent is safe to call on non-existent slug', () => {
    expect(() => clearRecentAgent('never-added')).not.toThrow();
  });
});

describe('recent-agents setup pending (persistent)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('returns false for a slug that was never marked pending', () => {
    expect(isSetupPending('test-slug')).toBe(false);
  });

  it('persists the pending flag to localStorage and reads it back', () => {
    markSetupPending('test-slug');
    expect(localStorage.getItem('setup_pending_test-slug')).toBe('1');
    expect(isSetupPending('test-slug')).toBe(true);
  });

  it('survives a simulated reload (re-reading from localStorage)', () => {
    markSetupPending('test-slug');
    // isSetupPending reads straight from localStorage, no in-memory state.
    expect(isSetupPending('test-slug')).toBe(true);
  });

  it('clearSetupPending removes the flag', () => {
    markSetupPending('test-slug');
    clearSetupPending('test-slug');
    expect(localStorage.getItem('setup_pending_test-slug')).toBeNull();
    expect(isSetupPending('test-slug')).toBe(false);
  });

  it('tracks pending slugs independently', () => {
    markSetupPending('test-slug');
    markSetupPending('another-slug');
    expect(isSetupPending('test-slug')).toBe(true);
    expect(isSetupPending('another-slug')).toBe(true);
    clearSetupPending('test-slug');
    expect(isSetupPending('test-slug')).toBe(false);
    expect(isSetupPending('another-slug')).toBe(true);
  });

  it('markSetupPending swallows storage errors', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(() => markSetupPending('test-slug')).not.toThrow();
  });

  it('isSetupPending returns false when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(isSetupPending('test-slug')).toBe(false);
  });

  it('clearSetupPending swallows storage errors', () => {
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(() => clearSetupPending('test-slug')).not.toThrow();
  });
});
