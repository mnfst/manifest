import {
  getLitellmBaseUrl,
  getLitellmMasterKey,
  getLitellmMaxBudgetUsd,
  getLitellmAutoAllowlist,
  isLitellmAutoEligible,
} from './litellm';

describe('litellm config', () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
    delete process.env['LITELLM_BASE_URL'];
    delete process.env['LITELLM_MASTER_KEY'];
    delete process.env['LITELLM_MANIFEST_MAX_BUDGET'];
    delete process.env['LITELLM_AUTO_PROVISION_ALLOWLIST'];
  });

  afterAll(() => {
    process.env = env;
  });

  it('defaults base URL to litellm.manifest.build', () => {
    expect(getLitellmBaseUrl()).toBe('https://litellm.manifest.build');
  });

  it('strips trailing slash from base URL', () => {
    process.env['LITELLM_BASE_URL'] = 'https://example.com/litellm/';
    expect(getLitellmBaseUrl()).toBe('https://example.com/litellm');
  });

  it('defaults max budget to 10', () => {
    expect(getLitellmMaxBudgetUsd()).toBe(10);
  });

  it('parses allowlist emails', () => {
    process.env['LITELLM_AUTO_PROVISION_ALLOWLIST'] = 'A@x.com, b@y.com ';
    expect(getLitellmAutoAllowlist()).toEqual(['a@x.com', 'b@y.com']);
  });

  it('auto-eligible requires master key', () => {
    expect(isLitellmAutoEligible('a@x.com')).toBe(false);
    process.env['LITELLM_MASTER_KEY'] = 'sk-test';
    expect(isLitellmAutoEligible('a@x.com')).toBe(true);
  });

  it('honors allowlist when set', () => {
    process.env['LITELLM_MASTER_KEY'] = 'sk-test';
    process.env['LITELLM_AUTO_PROVISION_ALLOWLIST'] = 'guillaume.gay@protonmail.com';
    expect(isLitellmAutoEligible('guillaume.gay@protonmail.com')).toBe(true);
    expect(isLitellmAutoEligible('other@example.com')).toBe(false);
    expect(getLitellmMasterKey()).toBe('sk-test');
  });
});
