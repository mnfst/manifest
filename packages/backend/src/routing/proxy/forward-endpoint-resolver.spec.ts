import { resolveForwardEndpoint } from './forward-endpoint-resolver';

const fakeLogger = () => ({ warn: jest.fn() });

describe('resolveForwardEndpoint', () => {
  it('leaves the model untouched and sets no override for a plain provider', () => {
    const out = resolveForwardEndpoint({
      provider: 'openai',
      authType: 'api_key',
      model: 'gpt-4o',
    });
    expect(out.forwardModel).toBe('gpt-4o');
    expect(out.customEndpoint).toBeUndefined();
  });

  it('strips the copilot/ prefix', () => {
    const out = resolveForwardEndpoint({
      provider: 'copilot',
      authType: 'subscription',
      model: 'copilot/gpt-4o',
    });
    expect(out.forwardModel).toBe('gpt-4o');
    expect(out.customEndpoint).toBeUndefined();
  });

  it('builds the minimax region endpoint from a valid resource_url and strips the prefix', () => {
    const out = resolveForwardEndpoint({
      provider: 'minimax',
      authType: 'subscription',
      model: 'minimax/abab',
      resourceUrl: 'https://api.minimaxi.com/anthropic',
    });
    expect(out.forwardModel).toBe('abab');
    expect(out.customEndpoint?.baseUrl).toContain('api.minimaxi.com');
  });

  it('warns and builds no endpoint for an invalid minimax resource_url (still strips prefix)', () => {
    const logger = fakeLogger();
    const out = resolveForwardEndpoint({
      provider: 'minimax',
      authType: 'subscription',
      model: 'minimax/abab',
      resourceUrl: 'https://evil.example/anthropic',
      logger,
    });
    expect(out.forwardModel).toBe('abab');
    expect(out.customEndpoint).toBeUndefined();
    expect(logger.warn).toHaveBeenCalled();
  });

  it('falls back to the persisted cn region for a minimax token without a resource_url', () => {
    const out = resolveForwardEndpoint({
      provider: 'minimax',
      authType: 'subscription',
      model: 'minimax/abab',
      providerRegion: 'cn',
    });
    expect(out.customEndpoint).toBeDefined();
    expect(out.forwardModel).toBe('abab');
  });

  it('sets no minimax override for a non-cn region without a resource_url', () => {
    const out = resolveForwardEndpoint({
      provider: 'minimax',
      authType: 'subscription',
      model: 'minimax/abab',
      providerRegion: 'global',
    });
    expect(out.customEndpoint).toBeUndefined();
  });

  it('builds the zai cn endpoint and strips the z-ai/ prefix', () => {
    const out = resolveForwardEndpoint({
      provider: 'zai',
      authType: 'subscription',
      model: 'z-ai/glm-4.6',
      providerRegion: 'cn',
    });
    expect(out.forwardModel).toBe('glm-4.6');
    expect(out.customEndpoint).toBeDefined();
  });

  it('strips the zai/ prefix variant', () => {
    const out = resolveForwardEndpoint({
      provider: 'zai',
      authType: 'subscription',
      model: 'zai/glm-4.6',
      providerRegion: 'global',
    });
    expect(out.forwardModel).toBe('glm-4.6');
    // global zai needs no override
    expect(out.customEndpoint).toBeUndefined();
  });

  it('builds the Xiaomi Token Plan region endpoint and strips the xiaomi/ prefix', () => {
    const out = resolveForwardEndpoint({
      provider: 'xiaomi',
      authType: 'subscription',
      model: 'xiaomi/mimo-v2.5-pro',
      providerRegion: 'ams',
    });
    expect(out.forwardModel).toBe('mimo-v2.5-pro');
    expect(out.customEndpoint?.baseUrl).toBe('https://token-plan-ams.xiaomimimo.com');
  });

  it('builds the Xiaomi Token Plan endpoint for provider aliases', () => {
    const out = resolveForwardEndpoint({
      provider: 'mimo',
      authType: 'subscription',
      model: 'mimo/mimo-v2.5-pro',
      providerRegion: 'sgp',
    });
    expect(out.forwardModel).toBe('mimo-v2.5-pro');
    expect(out.customEndpoint?.baseUrl).toBe('https://token-plan-sgp.xiaomimimo.com');
  });

  it('strips the xiaomi-mimo/ model prefix variant', () => {
    const out = resolveForwardEndpoint({
      provider: 'xiaomi-mimo',
      authType: 'subscription',
      model: 'xiaomi-mimo/mimo-v2.5-pro',
      providerRegion: 'cn',
    });
    expect(out.forwardModel).toBe('mimo-v2.5-pro');
    expect(out.customEndpoint?.baseUrl).toBe('https://token-plan-cn.xiaomimimo.com');
  });

  it('sets no Xiaomi override for an unknown persisted region', () => {
    const out = resolveForwardEndpoint({
      provider: 'xiaomi',
      authType: 'subscription',
      model: 'xiaomi/mimo-v2.5-pro',
      providerRegion: null,
    });
    expect(out.forwardModel).toBe('mimo-v2.5-pro');
    expect(out.customEndpoint).toBeUndefined();
  });

  it('builds the qwen region endpoint for a resolved region', () => {
    const out = resolveForwardEndpoint({
      provider: 'qwen',
      authType: 'api_key',
      model: 'qwen-max',
      providerRegion: 'beijing',
    });
    expect(out.customEndpoint).toBeDefined();
  });

  it('builds the AWS Bedrock Mantle endpoint for a selected region', () => {
    const out = resolveForwardEndpoint({
      provider: 'bedrock',
      authType: 'api_key',
      model: 'mistral.ministral-3-8b-instruct',
      providerRegion: 'eu-west-1',
    });
    expect(out.forwardModel).toBe('mistral.ministral-3-8b-instruct');
    expect(out.customEndpoint?.baseUrl).toBe('https://bedrock-mantle.eu-west-1.api.aws');
  });

  it('sets no qwen override for an unresolved region', () => {
    const out = resolveForwardEndpoint({
      provider: 'qwen',
      authType: 'api_key',
      model: 'qwen-max',
      providerRegion: null,
    });
    expect(out.customEndpoint).toBeUndefined();
  });

  it('builds a custom-provider endpoint and forwards the bare model id', () => {
    const out = resolveForwardEndpoint({
      provider: 'custom:abc',
      authType: 'api_key',
      model: 'custom:abc/meta-llama/Llama-3.1-8B',
      customProvider: { base_url: 'https://nebius.example/v1', api_kind: 'openai' },
    });
    expect(out.customEndpoint).toBeDefined();
    expect(out.forwardModel).toBe('meta-llama/Llama-3.1-8B');
  });

  it('sets no override for a custom provider whose row is missing', () => {
    const out = resolveForwardEndpoint({
      provider: 'custom:gone',
      authType: 'api_key',
      model: 'custom:gone/foo',
      customProvider: null,
    });
    expect(out.customEndpoint).toBeUndefined();
  });
});
