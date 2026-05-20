import { MODEL_PARAMETERS_SCHEMA } from 'manifest-shared';
import { ProviderParamSpecService } from '../provider-param-spec.service';

describe('ProviderParamSpecService', () => {
  it('returns the bundled MPS catalog', async () => {
    const service = new ProviderParamSpecService();

    await expect(service.list()).resolves.toHaveLength(MODEL_PARAMETERS_SCHEMA.length);
  });

  it('filters specs by provider, auth type, and model', async () => {
    const service = new ProviderParamSpecService();

    const apiSpecs = await service.getSpecs('anthropic', 'api_key', 'claude-sonnet-4-6');
    const subscriptionSpecs = await service.getSpecs(
      'anthropic',
      'subscription',
      'claude-sonnet-4-6',
    );

    expect(apiSpecs.map((spec) => spec.path)).toContain('thinking.type');
    expect(subscriptionSpecs.map((spec) => spec.path)).toEqual([]);
  });
});
