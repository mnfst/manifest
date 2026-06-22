import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  AUTH_TYPES,
  MODEL_CAPABILITIES,
  compareProviderParamSpecs,
  getProviderModelCapabilities,
  getProviderParamSpecs,
  isParamApplicability,
  isProviderParamPath,
  normalizeProviderParamProviderId,
  providerParamValueIsValid,
  resolveProviderMetadataIdentity,
  underlyingGatewayModel,
  type AuthType,
  type JsonValue,
  type ModelCapability,
  type ModelParamDefinition,
  type ModelParamGroup,
  type ModelParamRange,
  type ModelParamType,
  type ProviderModelParamSpec,
  type ProviderParamSpec,
  type ProviderParamSpecCatalog,
} from 'manifest-shared';
import { MPS_CATALOG_SNAPSHOT } from './mps-catalog-snapshot';

const MODEL_PARAMETERS_API = 'https://modelparams.dev/api/v1/models.json';
const MODEL_PARAMETERS_BY_MODEL_API = 'https://modelparams.dev/api/v1/params';
const FETCH_TIMEOUT_MS = 10000;
const BY_MODEL_FETCH_TIMEOUT_MS = 1500;
const BY_MODEL_CACHE_MAX_ENTRIES = 256;
const BY_MODEL_MISS_CACHE_TTL_MS = 5 * 60 * 1000;
const SUBSCRIPTION_MODEL_SUFFIX = '-subscription';
const SHORT_CLAUDE_MODEL_RE = /^claude-(opus|sonnet|haiku)-/i;
const DOTTED_CLAUDE_MINOR_RE = /-(\d+)\.(\d{1,2})(?=$|-\d{8}$)/g;
const DATE_SUFFIX_RE = /-\d{4}-?\d{2}-?\d{2}$/;
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

interface ModelParametersByModelApiResponse {
  model?: unknown;
  params?: unknown;
}

interface ProviderlessModelParamsCacheEntry {
  params: readonly ModelParamDefinition[] | null;
  expiresAt: number | null;
}

@Injectable()
export class ProviderParamSpecService implements OnModuleInit {
  private readonly logger = new Logger(ProviderParamSpecService.name);
  // Seed from the bundled snapshot so the params catalog is never empty when
  // modelparams.dev is unreachable at boot (offline / blocked / migrated host).
  // refreshCache() overwrites this with fresh data on a successful fetch.
  private specs: ProviderParamSpecCatalog = freezeCatalog(
    parseModelParametersCatalog(MPS_CATALOG_SNAPSHOT) ?? [],
  );
  private readonly byModelParams = new Map<string, ProviderlessModelParamsCacheEntry>();
  private lastFetchedAt: Date | null = null;
  private etag: string | null = null;

  onModuleInit(): void {
    // Fire-and-forget so a slow modelparams.dev fetch can't delay app.listen()
    // and trip Railway's healthcheck (see #1894). The MPS catalog falls back to
    // its frozen default until the fetch lands.
    void this.refreshCache().catch((err) => {
      this.logger.warn(`Startup modelparams.dev refresh failed: ${err}`);
    });
  }

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async refreshCache(): Promise<number> {
    const { notModified, data, etag } = await this.fetchModelParametersData();
    if (notModified) {
      // 304 from the conditional GET — the catalog is byte-for-byte unchanged,
      // so the cached copy stays authoritative. Record the check, skip re-parse.
      this.lastFetchedAt = new Date();
      return this.specs.length;
    }
    if (!data) return 0;

    const catalog = parseModelParametersCatalog(data);
    if (!catalog) {
      this.logger.warn('modelparams.dev returned an invalid MPS catalog; keeping current cache');
      return 0;
    }

    this.specs = freezeCatalog(catalog);
    this.byModelParams.clear();
    // Adopt the ETag only now that the body parsed cleanly, so a malformed-but-new
    // 200 can't suppress a future re-fetch under the same ETag.
    if (etag) this.etag = etag;
    this.lastFetchedAt = new Date();
    this.logger.log(`modelparams.dev MPS catalog loaded: ${this.specs.length} models`);
    return catalog.length;
  }

  async list(): Promise<ProviderParamSpecCatalog> {
    return this.specs;
  }

  /**
   * Lightweight identity list (no params/descriptions) so the Routing page can
   * decide which model rows expose a "configure params" affordance without
   * downloading the whole catalog.
   */
  listModelIds(): Array<{ provider: string; authType: AuthType; model: string }> {
    return this.specs.map((entry) => {
      const provider = normalizeProviderParamProviderId(entry.provider);
      return {
        provider,
        authType: entry.authType,
        model: entry.model,
      };
    });
  }

  async getSpecs(
    providerId: string | undefined,
    authType: AuthType | undefined,
    model: string | undefined,
  ): Promise<readonly ProviderParamSpec[]> {
    const providerlessSpecs = await this.getProviderlessSpecs(providerId, authType, model);
    if (providerlessSpecs.length > 0) return providerlessSpecs;

    const directSpecs = getProviderParamSpecs(this.specs, providerId, authType, model);
    if (directSpecs.length > 0) return directSpecs;

    const metadata = providerMetadataIdentity(providerId, model);
    if (!metadata || metadataMatchesRoute(metadata, providerId, model)) return directSpecs;

    return getProviderParamSpecs(this.specs, metadata.provider, authType, metadata.model).map(
      (spec) => withRouteIdentity(spec, providerId, authType, model),
    );
  }

  async getCapabilities(
    providerId: string | undefined,
    authType: AuthType | undefined,
    model: string | undefined,
  ): Promise<readonly ModelCapability[] | null> {
    const direct = getProviderModelCapabilities(this.specs, providerId, authType, model);
    if (direct) return direct;

    const metadata = providerMetadataIdentity(providerId, model);
    if (!metadata || metadataMatchesRoute(metadata, providerId, model)) return direct;
    return getProviderModelCapabilities(this.specs, metadata.provider, authType, metadata.model);
  }

  getLastFetchedAt(): Date | null {
    return this.lastFetchedAt;
  }

  private async fetchModelParametersData(): Promise<{
    notModified: boolean;
    data: unknown | null;
    etag: string | null;
  }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const headers: Record<string, string> = {};
      if (this.etag) headers['If-None-Match'] = this.etag;
      const res = await fetch(MODEL_PARAMETERS_API, { signal: controller.signal, headers });
      // 304 Not Modified: nothing changed since the last successful fetch, so
      // the daily refresh costs a round-trip with no body transfer as the
      // catalog grows.
      if (res.status === 304) return { notModified: true, data: null, etag: null };
      if (!res.ok) {
        this.logger.warn(`modelparams.dev API returned ${res.status}`);
        return { notModified: false, data: null, etag: null };
      }
      // Return the candidate ETag without committing it — refreshCache adopts it
      // only after the body parses, so an invalid 200 can't poison the
      // conditional request and strand us on the stale cache.
      return {
        notModified: false,
        data: (await res.json()) as unknown,
        etag: res.headers.get('etag'),
      };
    } catch (err) {
      this.logger.warn(`Failed to fetch modelparams.dev data: ${err}`);
      return { notModified: false, data: null, etag: null };
    } finally {
      clearTimeout(timeout);
    }
  }

  private async getProviderlessSpecs(
    providerId: string | undefined,
    authType: AuthType | undefined,
    model: string | undefined,
  ): Promise<readonly ProviderParamSpec[]> {
    if (!providerId || !authType || !model || authType === 'local') return [];

    const provider = normalizeProviderParamProviderId(providerId);
    const metadata = resolveProviderMetadataIdentity(provider, model);
    const lookupProvider = metadata.provider
      ? normalizeProviderParamProviderId(metadata.provider)
      : provider;
    const slugs = providerlessModelParamSlugs(lookupProvider, authType, metadata.model);
    for (const slug of slugs) {
      const params = await this.fetchProviderlessModelParams(slug);
      if (!params || params.length === 0) continue;
      return params
        .map((param) => ({ provider, authType, model, ...param }))
        .sort(compareProviderParamSpecs);
    }
    return [];
  }

  private async fetchProviderlessModelParams(
    slug: string,
  ): Promise<readonly ModelParamDefinition[] | null> {
    const cached = this.byModelParams.get(slug);
    if (cached) {
      if (cached.expiresAt === null || cached.expiresAt > Date.now()) return cached.params;
      this.byModelParams.delete(slug);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), BY_MODEL_FETCH_TIMEOUT_MS);
    try {
      const url = `${MODEL_PARAMETERS_BY_MODEL_API}/${encodeURIComponent(slug)}.json`;
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) {
        return null;
      }

      const contentType = res.headers.get('content-type') ?? '';
      if (contentType && !contentType.toLowerCase().includes('application/json')) {
        this.cacheProviderlessModelParams(slug, null, true);
        return null;
      }
      const params = parseProviderlessModelParams((await res.json()) as unknown);
      this.cacheProviderlessModelParams(slug, params, params === null);
      return params;
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private cacheProviderlessModelParams(
    slug: string,
    params: readonly ModelParamDefinition[] | null,
    expires: boolean,
  ): void {
    this.byModelParams.delete(slug);
    this.byModelParams.set(slug, {
      params,
      expiresAt: expires ? Date.now() + BY_MODEL_MISS_CACHE_TTL_MS : null,
    });

    while (this.byModelParams.size > BY_MODEL_CACHE_MAX_ENTRIES) {
      const oldest = this.byModelParams.keys().next().value;
      if (oldest === undefined) break;
      this.byModelParams.delete(oldest);
    }
  }
}

function providerMetadataIdentity(
  providerId: string | undefined,
  model: string | undefined,
): { provider: string | undefined; model: string } | null {
  if (!model) return null;
  const normalizedProvider = providerId ? normalizeProviderParamProviderId(providerId) : providerId;
  return resolveProviderMetadataIdentity(normalizedProvider, model);
}

function metadataMatchesRoute(
  metadata: { provider: string | undefined; model: string },
  providerId: string | undefined,
  model: string | undefined,
): boolean {
  const normalizedProvider = providerId ? normalizeProviderParamProviderId(providerId) : providerId;
  return metadata.provider === normalizedProvider && metadata.model === model;
}

function withRouteIdentity(
  spec: ProviderParamSpec,
  providerId: string | undefined,
  authType: AuthType | undefined,
  model: string | undefined,
): ProviderParamSpec {
  if (!providerId || !authType || !model) return spec;
  return {
    ...spec,
    provider: normalizeProviderParamProviderId(providerId),
    authType,
    model,
  };
}

function providerlessModelParamSlugs(
  providerId: string,
  authType: AuthType,
  model: string,
): readonly string[] {
  const out: string[] = [];
  for (const base of providerlessModelBaseCandidates(providerId, model)) {
    for (const variant of providerlessModelSlugVariants(base)) {
      if (authType === 'subscription' && !variant.endsWith(SUBSCRIPTION_MODEL_SUFFIX)) {
        pushUnique(out, `${variant}${SUBSCRIPTION_MODEL_SUFFIX}`);
      }
      pushUnique(out, variant);
    }
  }
  return out;
}

function providerlessModelBaseCandidates(providerId: string, model: string): readonly string[] {
  const out: string[] = [];
  const add = (candidate: string | null | undefined): void => {
    if (!candidate) return;
    if (candidate.includes('/')) {
      const last = candidate.slice(candidate.lastIndexOf('/') + 1);
      pushUnique(out, last);
      return;
    }
    pushUnique(out, candidate);
  };

  add(underlyingGatewayModel(model));
  const normalizedProvider = providerId.toLowerCase();
  if (model.toLowerCase().startsWith(`${normalizedProvider}/`)) {
    add(model.slice(normalizedProvider.length + 1));
  }
  add(model);
  return out;
}

function providerlessModelSlugVariants(model: string): readonly string[] {
  const out: string[] = [];
  const stableModel = stripProviderlessDateSuffix(model);
  for (const candidate of [model, stableModel]) {
    const normalizedClaude = normalizeClaudeProviderlessSlug(candidate);
    pushUnique(out, normalizedClaude);
    pushUnique(out, candidate);
  }
  return out;
}

function normalizeClaudeProviderlessSlug(model: string): string {
  if (!SHORT_CLAUDE_MODEL_RE.test(model)) return model;
  return model.replace(DOTTED_CLAUDE_MINOR_RE, '-$1-$2');
}

function stripProviderlessDateSuffix(model: string): string {
  return model.replace(DATE_SUFFIX_RE, '');
}

function pushUnique(values: string[], value: string): void {
  if (value && !values.includes(value)) values.push(value);
}

function freezeCatalog(catalog: ProviderParamSpecCatalog): ProviderParamSpecCatalog {
  return Object.freeze(
    catalog
      .filter((entry) => entry.params.length > 0 || (entry.capabilities?.length ?? 0) > 0)
      .map((entry) =>
        Object.freeze({
          ...entry,
          ...(entry.capabilities ? { capabilities: Object.freeze([...entry.capabilities]) } : {}),
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

function parseProviderlessModelParams(raw: unknown): readonly ModelParamDefinition[] | null {
  if (!isRecord(raw)) return null;
  const response = raw as ModelParametersByModelApiResponse;
  if (!isNonEmptyString(response.model)) return null;
  if (!Array.isArray(response.params)) return null;

  const params = response.params
    .map(parseModelParamDefinition)
    .filter((param): param is ModelParamDefinition => param !== null);
  return params.length > 0 ? Object.freeze(params.sort(compareProviderParamSpecs)) : null;
}

function parseProviderModelParamSpec(raw: unknown): ProviderModelParamSpec | null {
  if (!isRecord(raw)) return null;
  if (!isNonEmptyString(raw.provider)) return null;
  if (!isAuthType(raw.authType)) return null;
  if (!isNonEmptyString(raw.model)) return null;
  if (raw.params !== undefined && !Array.isArray(raw.params)) return null;
  const capabilities =
    raw.capabilities === undefined ? undefined : parseModelCapabilities(raw.capabilities);
  if (raw.capabilities !== undefined && !capabilities) return null;

  const rawParams = Array.isArray(raw.params) ? raw.params : [];
  const params = rawParams
    .map(parseModelParamDefinition)
    .filter((param): param is ModelParamDefinition => param !== null);

  if (params.length === 0 && (!capabilities || capabilities.length === 0)) return null;
  return {
    provider: raw.provider,
    authType: raw.authType,
    model: raw.model,
    ...(capabilities ? { capabilities } : {}),
    params,
  };
}

function parseModelCapabilities(raw: unknown): readonly ModelCapability[] | null {
  if (!Array.isArray(raw)) return null;
  const seen = new Set<ModelCapability>();
  const out: ModelCapability[] = [];
  for (const value of raw) {
    if (!isModelCapability(value)) return null;
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
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

function isModelCapability(value: unknown): value is ModelCapability {
  return typeof value === 'string' && (MODEL_CAPABILITIES as readonly string[]).includes(value);
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
