import { BadRequestException } from '@nestjs/common';
import { assertProviderRegionSupported } from './provider-region-validation';

describe('assertProviderRegionSupported', () => {
  it('allows omitted region', () => {
    expect(() => assertProviderRegionSupported('openai', 'api_key', undefined)).not.toThrow();
  });

  it('allows Qwen regions', () => {
    expect(() => assertProviderRegionSupported('qwen', 'api_key', 'auto')).not.toThrow();
  });

  it('rejects Qwen regions for non-API-key auth types', () => {
    expect(() => assertProviderRegionSupported('qwen', 'subscription', 'auto')).toThrow(
      BadRequestException,
    );
  });

  it('allows subscription endpoint regions from shared config', () => {
    expect(() => assertProviderRegionSupported('minimax', 'subscription', 'global')).not.toThrow();
  });

  it('rejects region for unsupported providers', () => {
    expect(() => assertProviderRegionSupported('openai', 'api_key', 'global')).toThrow(
      BadRequestException,
    );
  });
});
