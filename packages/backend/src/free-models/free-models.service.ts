import { Injectable } from '@nestjs/common';
import { FreeModelsSyncService } from './free-models-sync.service';
import { PROVIDER_METADATA } from './free-models-provider-metadata';

export interface FreeModelDto {
  id: string | null;
  name: string;
  context: string;
  max_output: string;
  modality: string;
  rate_limit: string;
}

export interface FreeProviderDto {
  name: string;
  logo: string | null;
  description: string;
  tags: string[];
  api_key_url: string;
  base_url: string | null;
  warning: string | null;
  country: string;
  flag: string;
  models: FreeModelDto[];
}

export interface FreeModelsResponse {
  providers: FreeProviderDto[];
  last_synced_at: string | null;
}

@Injectable()
export class FreeModelsService {
  constructor(private readonly syncService: FreeModelsSyncService) {}

  getAll(): FreeModelsResponse {
    const githubProviders = this.syncService.getAll();
    const lastSyncedAt = this.syncService.getLastFetchedAt()?.toISOString() ?? null;

    const providers = githubProviders.map((gp) => {
      const meta = PROVIDER_METADATA[gp.name];
      return {
        name: meta?.displayName ?? gp.name,
        logo: meta?.logo ?? null,
        description: gp.description,
        tags: meta?.tags ?? [],
        api_key_url: gp.url,
        base_url: gp.baseUrl,
        warning: meta?.warning ?? null,
        country: gp.country,
        flag: gp.flag,
        models: gp.models.map((m) => ({
          id: m.id ?? null,
          name: m.name,
          context: m.context,
          max_output: m.maxOutput,
          modality: m.modality,
          rate_limit: m.rateLimit,
        })),
      };
    });

    return { providers, last_synced_at: lastSyncedAt };
  }
}
