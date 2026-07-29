import {
  getManagedFreeLiteLlmAutoAllowlist,
  getManagedFreeLiteLlmBaseUrl,
  getManagedFreeLiteLlmMasterKey,
  getManagedFreeLiteLlmMaxBudgetUsd,
  getManagedFreeProviderConfig,
  isManagedFreeLiteLlmAutoEligible,
} from './managed-free-providers';

describe('managed free provider config', () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
    delete process.env['LITELLM_BASE_URL'];
    delete process.env['LITELLM_MASTER_KEY'];
    delete process.env['LITELLM_GEMINI_FREE_MAX_BUDGET'];
    delete process.env['LITELLM_AUTO_PROVISION_ALLOWLIST'];
  });

  afterAll(() => {
    process.env = env;
  });

  it('defaults to the internal LiteLLM gateway', () => {
    expect(getManagedFreeLiteLlmBaseUrl()).toBe('https://litellm.manifest.build');
  });

  it('strips trailing slashes from the base URL', () => {
    process.env['LITELLM_BASE_URL'] = 'https://example.com/litellm/';
    expect(getManagedFreeLiteLlmBaseUrl()).toBe('https://example.com/litellm');
  });

  it('defaults the maximum budget to 10', () => {
    const config = getManagedFreeProviderConfig('gemini-free')!;
    expect(getManagedFreeLiteLlmMaxBudgetUsd(config)).toBe(10);
  });

  it('parses allowlisted emails', () => {
    process.env['LITELLM_AUTO_PROVISION_ALLOWLIST'] = 'A@x.com, b@y.com ';
    expect(getManagedFreeLiteLlmAutoAllowlist()).toEqual(['a@x.com', 'b@y.com']);
  });

  it('requires the master key for automatic provisioning', () => {
    expect(isManagedFreeLiteLlmAutoEligible('a@x.com')).toBe(false);
    process.env['LITELLM_MASTER_KEY'] = 'sk-test';
    expect(isManagedFreeLiteLlmAutoEligible('a@x.com')).toBe(true);
    expect(getManagedFreeLiteLlmMasterKey()).toBe('sk-test');
  });

  it('honors the allowlist when configured', () => {
    process.env['LITELLM_MASTER_KEY'] = 'sk-test';
    process.env['LITELLM_AUTO_PROVISION_ALLOWLIST'] = 'allowed@example.com';
    expect(isManagedFreeLiteLlmAutoEligible('allowed@example.com')).toBe(true);
    expect(isManagedFreeLiteLlmAutoEligible('other@example.com')).toBe(false);
  });

  it('keeps Gemini-specific values in one copyable config entry', () => {
    expect(getManagedFreeProviderConfig('gemini-free')).toMatchObject({
      id: 'gemini-free',
      displayName: 'Gemini Free',
      litellmModels: ['gemini/*'],
      catalogModelIdPrefix: 'gemini-',
      preferredModelIdPrefix: 'gemini/',
      maxBudgetEnvVar: 'LITELLM_GEMINI_FREE_MAX_BUDGET',
    });
  });
});
