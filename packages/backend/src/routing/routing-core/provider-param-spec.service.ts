import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  AUTH_TYPES,
  compareProviderParamSpecs,
  getProviderParamSpecs,
  isParamApplicability,
  isProviderParamPath,
  providerParamValueIsValid,
  type AuthType,
  type JsonValue,
  type ModelParamDefinition,
  type ModelParamGroup,
  type ModelParamRange,
  type ModelParamType,
  type ProviderModelParamSpec,
  type ProviderParamSpec,
  type ProviderParamSpecCatalog,
} from 'manifest-shared';

const MODEL_PARAMETERS_API = 'https://modelparameters.dev/api/v1/models.json';
const FETCH_TIMEOUT_MS = 10000;
const MODEL_PARAM_TYPES: readonly ModelParamType[] = [
  'boolean',
  'enum',
  'integer',
  'number',
  'string',
];
const MODEL_PARAM_GROUPS: readonly ModelParamGroup[] = [
  'generation_length',
  'sampling',
  'reasoning',
  'tooling',
  'output_format',
  'observability',
  'provider_metadata',
];
const API_LEVEL_PARAM_PATHS = new Set(['stream']);

interface ModelParametersApiResponse {
  models?: unknown;
}

@Injectable()
export class ProviderParamSpecService implements OnModuleInit {
  private readonly logger = new Logger(ProviderParamSpecService.name);
  private specs: ProviderParamSpecCatalog = freezeCatalog([]);
  private lastFetchedAt: Date | null = null;

  async onModuleInit(): Promise<void> {
    try {
      await this.refreshCache();
    } catch (err) {
      this.logger.warn(`Startup modelparameters.dev refresh failed: ${err}`);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async refreshCache(): Promise<number> {
    const raw = await this.fetchModelParametersData();
    if (!raw) return 0;

    const catalog = parseModelParametersCatalog(raw);
    if (!catalog) {
      this.logger.warn(
        'modelparameters.dev returned an invalid MPS catalog; keeping current cache',
      );
      return 0;
    }

    this.specs = freezeCatalog(catalog);
    this.lastFetchedAt = new Date();
    this.logger.log(`modelparameters.dev MPS catalog loaded: ${this.specs.length} models`);
    return catalog.length;
  }

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

  getLastFetchedAt(): Date | null {
    return this.lastFetchedAt;
  }

  private async fetchModelParametersData(): Promise<unknown | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(MODEL_PARAMETERS_API, { signal: controller.signal });
      if (!res.ok) {
        this.logger.warn(`modelparameters.dev API returned ${res.status}`);
        return null;
      }
      return (await res.json()) as unknown;
    } catch (err) {
      this.logger.warn(`Failed to fetch modelparameters.dev data: ${err}`);
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
}

function freezeCatalog(catalog: ProviderParamSpecCatalog): ProviderParamSpecCatalog {
  return Object.freeze(
    catalog
      .filter((entry) => entry.params.length > 0)
      .map((entry) =>
        Object.freeze({
          ...entry,
          params: Object.freeze([...entry.params].sort(compareProviderParamSpecs)),
        }),
      )
      .sort(compareProviderModelParamSpecs),
  );
}

function parseModelParametersCatalog(raw: unknown): ProviderParamSpecCatalog | null {
  if (!isRecord(raw)) return null;
  const models = (raw as ModelParametersApiResponse).models;
  if (!Array.isArray(models)) return null;

  const catalog: ProviderModelParamSpec[] = [];
  for (const model of models) {
    const entry = parseProviderModelParamSpec(model);
    if (entry) catalog.push(entry);
  }
  return catalog.length > 0 ? catalog : null;
}

function parseProviderModelParamSpec(raw: unknown): ProviderModelParamSpec | null {
  if (!isRecord(raw)) return null;
  if (!isNonEmptyString(raw.provider)) return null;
  if (!isAuthType(raw.authType)) return null;
  if (!isNonEmptyString(raw.model)) return null;
  if (!Array.isArray(raw.params)) return null;

  const params = raw.params
    .map(parseModelParamDefinition)
    .filter((param): param is ModelParamDefinition => param !== null);

  if (params.length === 0) return null;
  return {
    provider: raw.provider,
    authType: raw.authType,
    model: raw.model,
    params,
  };
}

function parseModelParamDefinition(raw: unknown): ModelParamDefinition | null {
  if (!isRecord(raw)) return null;
  if (!isNonEmptyString(raw.path) || !isProviderParamPath(raw.path)) return null;
  if (API_LEVEL_PARAM_PATHS.has(raw.path)) return null;
  if (!isModelParamType(raw.type)) return null;
  if (!isNonEmptyString(raw.label)) return null;
  if (!isNonEmptyString(raw.description)) return null;
  if (!isModelParamGroup(raw.group)) return null;
  const range = raw.range === undefined ? undefined : parseRange(raw.range);
  if (raw.range !== undefined && !range) return null;
  const values = raw.values === undefined ? undefined : parseJsonValues(raw.values);
  if (raw.values !== undefined && !values) return null;
  if (raw.type === 'enum' && (!values || values.length === 0)) return null;
  const applicability =
    raw.applicability === undefined
      ? undefined
      : isParamApplicability(raw.applicability)
        ? raw.applicability
        : null;
  if (raw.applicability !== undefined && !applicability) return null;

  const spec: ModelParamDefinition = {
    path: raw.path,
    type: raw.type,
    label: raw.label,
    description: raw.description,
    group: raw.group,
    ...(raw.default !== undefined ? { default: raw.default as JsonValue } : {}),
    ...(values ? { values } : {}),
    ...(range ? { range } : {}),
    ...(applicability ? { applicability } : {}),
  };

  if (raw.default !== undefined && !providerParamValueIsValid(spec, raw.default)) return null;
  return spec;
}

function parseRange(raw: unknown): ModelParamRange | null {
  if (!isRecord(raw)) return null;
  const range: ModelParamRange = {};
  if (raw.min !== undefined) {
    if (!isFiniteNumber(raw.min)) return null;
    range.min = raw.min;
  }
  if (raw.max !== undefined) {
    if (!isFiniteNumber(raw.max)) return null;
    range.max = raw.max;
  }
  if (raw.step !== undefined) {
    if (!isFiniteNumber(raw.step) || raw.step <= 0) return null;
    range.step = raw.step;
  }
  return range;
}

function parseJsonValues(raw: unknown): readonly JsonValue[] | null {
  if (!Array.isArray(raw)) return null;
  if (raw.length === 0) return null;
  return raw.every(isJsonValue) ? raw : null;
}

function isModelParamType(value: unknown): value is ModelParamType {
  return typeof value === 'string' && MODEL_PARAM_TYPES.includes(value as ModelParamType);
}

function isModelParamGroup(value: unknown): value is ModelParamGroup {
  return typeof value === 'string' && MODEL_PARAM_GROUPS.includes(value as ModelParamGroup);
}

function isAuthType(value: unknown): value is AuthType {
  return typeof value === 'string' && (AUTH_TYPES as readonly string[]).includes(value);
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null) return true;
  const type = typeof value;
  if (type === 'string' || type === 'number' || type === 'boolean') return true;
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (!isRecord(value)) return false;
  return Object.values(value).every(isJsonValue);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
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
