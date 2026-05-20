import { Injectable } from '@nestjs/common';
import {
  compareProviderParamSpecs,
  getProviderParamSpecs,
  MODEL_PARAMETERS_SCHEMA,
  type AuthType,
  type ProviderModelParamSpec,
  type ProviderParamSpec,
  type ProviderParamSpecCatalog,
} from 'manifest-shared';

@Injectable()
export class ProviderParamSpecService {
  private readonly specs: ProviderParamSpecCatalog = Object.freeze(
    MODEL_PARAMETERS_SCHEMA.map((entry) =>
      Object.freeze({
        ...entry,
        params: Object.freeze([...entry.params].sort(compareProviderParamSpecs)),
      }),
    ).sort(compareProviderModelParamSpecs),
  );

  async list(): Promise<ProviderParamSpecCatalog> {
    return this.specs;
  }

  async getSpecs(
    providerId: string | undefined,
    authType: AuthType | undefined,
    model: string | undefined,
  ): Promise<readonly ProviderParamSpec[]> {
    return getProviderParamSpecs(this.specs, providerId, authType, model);
  }
}

function compareProviderModelParamSpecs(
  a: ProviderModelParamSpec,
  b: ProviderModelParamSpec,
): number {
  const providerDelta = a.provider.localeCompare(b.provider);
  if (providerDelta !== 0) return providerDelta;

  const authDelta = a.authType.localeCompare(b.authType);
  if (authDelta !== 0) return authDelta;

  return a.model.localeCompare(b.model);
}
