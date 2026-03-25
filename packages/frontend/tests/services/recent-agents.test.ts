import { describe, it, expect, beforeEach } from 'vitest';
import { markAgentCreated, isRecentlyCreated, clearRecentAgent } from '../../src/services/recent-agents';

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
