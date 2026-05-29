import { headerTierNameToModelAlias, isSafeHeaderTierModelAlias } from '../src/header-tier-alias';

describe('headerTierNameToModelAlias', () => {
  it('kebab-cases spaces and underscores while keeping . @ :', () => {
    expect(headerTierNameToModelAlias('Super')).toBe('super');
    expect(headerTierNameToModelAlias('Web Browsing')).toBe('web-browsing');
    expect(headerTierNameToModelAlias('GPT 5.5')).toBe('gpt-5.5');
    expect(headerTierNameToModelAlias('tier:v2@beta')).toBe('tier:v2@beta');
    expect(headerTierNameToModelAlias('foo__bar')).toBe('foo-bar');
  });

  it('strips characters outside the allowed set', () => {
    expect(headerTierNameToModelAlias('tier@v2!')).toBe('tier@v2');
    expect(headerTierNameToModelAlias('!!!')).toBe('');
  });
});

describe('isSafeHeaderTierModelAlias', () => {
  it('allows non-empty aliases without slashes', () => {
    expect(isSafeHeaderTierModelAlias('gpt-5.5')).toBe(true);
    expect(isSafeHeaderTierModelAlias('tier:v2@beta')).toBe(true);
  });

  it('rejects empty values and slashes', () => {
    expect(isSafeHeaderTierModelAlias('')).toBe(false);
    expect(isSafeHeaderTierModelAlias('   ')).toBe(false);
    expect(isSafeHeaderTierModelAlias('openai/gpt-4o')).toBe(false);
  });
});
