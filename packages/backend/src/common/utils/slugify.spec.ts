import { slugify } from './slugify';

describe('slugify', () => {
  it('converts spaces to hyphens', () => {
    expect(slugify('My Cool Agent')).toBe('my-cool-agent');
  });

  it('converts underscores to hyphens', () => {
    expect(slugify('my_cool_agent')).toBe('my-cool-agent');
  });

  it('lowercases input', () => {
    expect(slugify('TestBot')).toBe('testbot');
  });

  it('removes special characters', () => {
    expect(slugify('agent@home!')).toBe('agenthome');
  });

  it('collapses consecutive hyphens', () => {
    expect(slugify('my---cool---agent')).toBe('my-cool-agent');
  });

  it('strips leading and trailing hyphens', () => {
    expect(slugify('--my-agent--')).toBe('my-agent');
  });

  it('handles mixed spaces and underscores', () => {
    expect(slugify('My Cool_Agent')).toBe('my-cool-agent');
  });

  it('returns empty string for empty input', () => {
    expect(slugify('')).toBe('');
  });

  it('returns empty string for whitespace-only input', () => {
    expect(slugify('   ')).toBe('');
  });

  it('returns empty string for special-chars-only input', () => {
    expect(slugify('!@#$%')).toBe('');
  });

  it('preserves already-valid slugs', () => {
    expect(slugify('my-agent')).toBe('my-agent');
  });

  it('handles single word', () => {
    expect(slugify('agent')).toBe('agent');
  });

  it('handles numbers', () => {
    expect(slugify('Agent 42')).toBe('agent-42');
  });

  it('trims surrounding whitespace', () => {
    expect(slugify('  My Agent  ')).toBe('my-agent');
  });
});
