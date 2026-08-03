import { Test } from '@nestjs/testing';
import { ModelsDevSyncService } from '../../../database/models-dev-sync.service';
import { ProviderClient } from '../provider-client';
import { ReasoningContentCache } from '../reasoning-content-cache';
import { ModelsDevReasoningCatalog } from '../reasoning-model-catalog';

describe('reasoning catalog dependency injection', () => {
  it('hands the models.dev catalog to the cache and the provider client', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ReasoningContentCache,
        ProviderClient,
        ModelsDevReasoningCatalog,
        { provide: ModelsDevSyncService, useValue: { lookupModel: () => null } },
      ],
    }).compile();

    const catalog = moduleRef.get(ModelsDevReasoningCatalog);
    expect(moduleRef.get(ReasoningContentCache).modelCatalog).toBe(catalog);
    expect(
      (moduleRef.get(ProviderClient) as unknown as { reasoningCatalog?: unknown }).reasoningCatalog,
    ).toBe(catalog);
  });
});
