import { Injectable } from '@nestjs/common';
import {
  compareProviderParamSpecs,
  getProviderParamSpecs,
  MODEL_PARAMETERS_SCHEMA,
  type AuthType,
  type ProviderParamSpec,
  type ProviderParamSpecCatalog,
} from 'manifest-shared';

@Injectable()
export class ProviderParamSpecService {
  private readonly specs: ProviderParamSpecCatalog = Object.freeze(
    [...MODEL_PARAMETERS_SCHEMA].sort(compareProviderParamSpecs),
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
