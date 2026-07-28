import {
  getManifestCreditsBaseUrl,
  getManifestCreditsMasterKey,
  getManifestCreditsMaxBudgetUsd,
  getManifestCreditsAutoAllowlist,
  getManifestCreditsKeyGenerateUrl,
  getManifestCreditsModelsUrl,
  isManifestCreditsAutoEligible,
} from './manifest-credits';

describe('Manifest Credits config', () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
    delete process.env['MANIFEST_CREDITS_BASE_URL'];
    delete process.env['MANIFEST_CREDITS_MASTER_KEY'];
    delete process.env['MANIFEST_CREDITS_MAX_BUDGET'];
    delete process.env['MANIFEST_CREDITS_AUTO_PROVISION_ALLOWLIST'];
  });

  afterAll(() => {
    process.env = env;
  });

  it('defaults base URL to credits.manifest.build', () => {
    expect(getManifestCreditsBaseUrl()).toBe('https://credits.manifest.build');
  });

  it('strips trailing slash from base URL', () => {
    process.env['MANIFEST_CREDITS_BASE_URL'] = 'https://credits.example.com/';
    expect(getManifestCreditsBaseUrl()).toBe('https://credits.example.com');
  });

  it('builds credits API URLs from the base URL', () => {
    expect(getManifestCreditsModelsUrl()).toBe('https://credits.manifest.build/v1/models');
    expect(getManifestCreditsKeyGenerateUrl()).toBe('https://credits.manifest.build/key/generate');
  });

  it('defaults max budget to 10', () => {
    expect(getManifestCreditsMaxBudgetUsd()).toBe(10);
  });

  it('accepts a non-negative max budget and rejects invalid values', () => {
    process.env['MANIFEST_CREDITS_MAX_BUDGET'] = '12.5';
    expect(getManifestCreditsMaxBudgetUsd()).toBe(12.5);
    process.env['MANIFEST_CREDITS_MAX_BUDGET'] = '-1';
    expect(getManifestCreditsMaxBudgetUsd()).toBe(10);
    process.env['MANIFEST_CREDITS_MAX_BUDGET'] = 'invalid';
    expect(getManifestCreditsMaxBudgetUsd()).toBe(10);
  });

  it('parses allowlist emails', () => {
    process.env['MANIFEST_CREDITS_AUTO_PROVISION_ALLOWLIST'] = 'A@x.com, b@y.com ';
    expect(getManifestCreditsAutoAllowlist()).toEqual(['a@x.com', 'b@y.com']);
  });

  it('auto-eligible requires master key', () => {
    expect(isManifestCreditsAutoEligible('a@x.com')).toBe(false);
    process.env['MANIFEST_CREDITS_MASTER_KEY'] = 'sk-test';
    expect(isManifestCreditsAutoEligible('a@x.com')).toBe(true);
  });

  it('honors allowlist when set', () => {
    process.env['MANIFEST_CREDITS_MASTER_KEY'] = 'sk-test';
    process.env['MANIFEST_CREDITS_AUTO_PROVISION_ALLOWLIST'] = 'guillaume.gay@protonmail.com';
    expect(isManifestCreditsAutoEligible('guillaume.gay@protonmail.com')).toBe(true);
    expect(isManifestCreditsAutoEligible('other@example.com')).toBe(false);
    expect(getManifestCreditsMasterKey()).toBe('sk-test');
  });
});
