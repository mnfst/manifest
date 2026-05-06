import {
  PROVIDER_THINKING_DEFAULTS,
  filterParamDefaultsForProvider,
  manifestThinkingDefault,
  manifestThinkingParamDefaults,
  providerThinkingDefault,
} from '../src/thinking-defaults';

describe('providerThinkingDefault', () => {
  it('returns the registered default for known providers', () => {
    expect(providerThinkingDefault('deepseek')).toBe('enabled');
  });

  it('is case-insensitive on the provider id', () => {
    expect(providerThinkingDefault('DeepSeek')).toBe('enabled');
  });

  it('returns undefined for unknown or missing providers', () => {
    expect(providerThinkingDefault('openai')).toBeUndefined();
    expect(providerThinkingDefault(undefined)).toBeUndefined();
    expect(providerThinkingDefault('')).toBeUndefined();
  });

  it('exports the registry for callers that need to enumerate it', () => {
    expect(PROVIDER_THINKING_DEFAULTS.deepseek).toBe('enabled');
  });
});

describe('manifestThinkingDefault', () => {
  it('downgrades to disabled on complexity tiers when the provider defaults thinking on', () => {
    expect(manifestThinkingDefault('deepseek', 'simple')).toBe('disabled');
    expect(manifestThinkingDefault('deepseek', 'standard')).toBe('disabled');
    expect(manifestThinkingDefault('deepseek', 'complex')).toBe('disabled');
  });

  it('keeps the provider default on the reasoning tier', () => {
    expect(manifestThinkingDefault('deepseek', 'reasoning')).toBe('enabled');
  });

  it('stays neutral on the default tier (no complexity routing)', () => {
    expect(manifestThinkingDefault('deepseek', 'default')).toBe('enabled');
  });

  it('falls back to the provider default for unknown tiers', () => {
    expect(manifestThinkingDefault('deepseek', 'coding')).toBe('enabled');
    expect(manifestThinkingDefault('deepseek', undefined)).toBe('enabled');
  });

  it('returns undefined for providers without a registered default', () => {
    expect(manifestThinkingDefault('openai', 'simple')).toBeUndefined();
    expect(manifestThinkingDefault(undefined, 'standard')).toBeUndefined();
  });
});

describe('manifestThinkingParamDefaults', () => {
  it('returns the override payload when Manifest disagrees with the provider', () => {
    expect(manifestThinkingParamDefaults('deepseek', 'simple')).toEqual({
      thinking: { type: 'disabled' },
    });
  });

  it('returns null when Manifest agrees with the provider (no redundant field)', () => {
    expect(manifestThinkingParamDefaults('deepseek', 'reasoning')).toBeNull();
    expect(manifestThinkingParamDefaults('deepseek', 'default')).toBeNull();
  });

  it('returns null for providers without a known thinking default', () => {
    expect(manifestThinkingParamDefaults('openai', 'simple')).toBeNull();
    expect(manifestThinkingParamDefaults(undefined, 'simple')).toBeNull();
  });
});

describe('filterParamDefaultsForProvider', () => {
  it('passes through fields the provider supports', () => {
    expect(
      filterParamDefaultsForProvider({ thinking: { type: 'disabled' } }, 'deepseek'),
    ).toEqual({ thinking: { type: 'disabled' } });
  });

  it('drops fields whose provider has no registered default (slot reassigned to incompatible provider)', () => {
    expect(
      filterParamDefaultsForProvider({ thinking: { type: 'disabled' } }, 'openai'),
    ).toBeNull();
  });

  it('returns null for null/undefined inputs', () => {
    expect(filterParamDefaultsForProvider(null, 'deepseek')).toBeNull();
    expect(filterParamDefaultsForProvider(undefined, 'deepseek')).toBeNull();
  });

  it('returns null when no compatible fields remain', () => {
    expect(filterParamDefaultsForProvider({}, 'deepseek')).toBeNull();
  });
});
