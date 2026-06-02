import { extractToolName } from '../types';

describe('extractToolName', () => {
  it('returns the top-level name (Anthropic-style tool)', () => {
    expect(extractToolName({ name: 'str_replace' })).toBe('str_replace');
  });

  it('falls back to function.name (OpenAI-style tool)', () => {
    expect(extractToolName({ function: { name: 'apply_patch' } })).toBe('apply_patch');
  });

  it('returns null when no tool name is present', () => {
    expect(extractToolName({})).toBeNull();
    expect(extractToolName({ function: {} })).toBeNull();
  });
});
