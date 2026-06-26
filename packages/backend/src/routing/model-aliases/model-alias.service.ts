import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import {
  DEFAULT_OUTPUT_MODALITY,
  DEFAULT_RESPONSE_MODE,
  SPECIFICITY_CATEGORIES,
  TIER_SLOTS,
  isModelRoute,
  isModelRouteArray,
  isResponseMode,
  setProviderParamValue,
  type AuthType,
  type ModelRoute,
  type ProviderParamSpec,
  type RequestParamDefaults,
  type ResponseMode,
  type SpecificityCategory,
  type TierSlot,
} from 'manifest-shared';
import type { DiscoveredModel } from '../../model-discovery/model-fetcher';
import { ModelDiscoveryService } from '../../model-discovery/model-discovery.service';
import {
  EXPOSED_MODEL_SOURCE_KINDS,
  ExposedModelRoute,
  type ExposedModelSourceKind,
} from '../../entities/exposed-model-route.entity';
import { ResolveResponse } from '../dto/resolve-response';
import { ResolveService } from '../resolve/resolve.service';
import { HeaderTierService } from '../header-tiers/header-tier.service';
import { ProviderKeyService } from '../routing-core/provider-key.service';
import { ProviderParamSpecService } from '../routing-core/provider-param-spec.service';
import { effectiveRoutesForResponseMode } from '../routing-core/response-mode-guard';
import {
  CreateModelAliasDto,
  MAX_MODEL_ALIAS_DISPLAY_NAME_LENGTH,
  MAX_MODEL_ALIAS_ID_LENGTH,
  UpdateModelAliasDto,
} from './model-alias.dto';

const RESERVED_MODEL_IDS = new Set(['auto', 'manifest/auto']);
const MODEL_ID_RE = /^[^\s\x00-\x1F\x7F]+$/;
const REASONING_EFFORT_SUFFIXES = ['minimal', 'none', 'low', 'medium', 'high', 'xhigh'] as const;

export type ModelAliasResolution =
  | { kind: 'auto' }
  | {
      kind: 'resolved';
      resolved: ResolveResponse;
      requestParams?: RequestParamDefaults | null;
      scopeKey?: string;
      acceptsReasoningEffortHeader?: boolean;
    };

interface NormalizedAliasInput {
  model_id: string;
  display_name: string | null;
  enabled: boolean;
  source_kind: ExposedModelSourceKind;
  source_key: string | null;
  route: ModelRoute | null;
  fallback_routes: ModelRoute[] | null;
  request_params: RequestParamDefaults | null;
  response_mode: ResponseMode;
}

interface AliasInputShape {
  model_id?: unknown;
  display_name?: unknown;
  enabled?: boolean;
  source_kind?: unknown;
  source_key?: unknown;
  route?: unknown;
  fallback_routes?: unknown;
  request_params?: unknown;
  response_mode?: unknown;
}

@Injectable()
export class ModelAliasService {
  constructor(
    @InjectRepository(ExposedModelRoute)
    private readonly repo: Repository<ExposedModelRoute>,
    private readonly discoveryService: ModelDiscoveryService,
    private readonly resolveService: ResolveService,
    private readonly headerTierService: HeaderTierService,
    private readonly providerKeyService: ProviderKeyService,
    private readonly providerParamSpecs: ProviderParamSpecService,
  ) {}

  async list(agentId: string): Promise<ExposedModelRoute[]> {
    return this.repo.find({ where: { agent_id: agentId }, order: { model_id: 'ASC' } });
  }

  async listEnabled(agentId: string): Promise<ExposedModelRoute[]> {
    return this.repo.find({
      where: { agent_id: agentId, enabled: true },
      order: { model_id: 'ASC' },
    });
  }

  async create(
    agentId: string,
    tenantId: string,
    input: CreateModelAliasDto,
  ): Promise<ExposedModelRoute> {
    const normalized = await this.normalizeInput(agentId, tenantId, input);
    const now = new Date().toISOString();
    const record = Object.assign(new ExposedModelRoute(), {
      id: randomUUID(),
      tenant_id: tenantId,
      agent_id: agentId,
      created_at: now,
      updated_at: now,
      ...normalized,
    });
    try {
      await this.repo.save(record);
    } catch (error) {
      this.throwDuplicateIfNeeded(error, normalized.model_id);
      throw error;
    }
    return record;
  }

  async update(
    agentId: string,
    tenantId: string,
    id: string,
    patch: UpdateModelAliasDto,
  ): Promise<ExposedModelRoute> {
    const existing = await this.findOrThrow(agentId, id);
    const merged = await this.normalizeInput(agentId, tenantId, {
      model_id: patch.model_id ?? existing.model_id,
      display_name:
        patch.display_name === undefined
          ? (existing.display_name ?? undefined)
          : patch.display_name,
      enabled: existing.enabled,
      source_kind: patch.source_kind ?? existing.source_kind,
      source_key:
        patch.source_key === undefined ? (existing.source_key ?? undefined) : patch.source_key,
      route: patch.route === undefined ? (existing.route ?? undefined) : patch.route,
      fallback_routes:
        patch.fallback_routes === undefined
          ? (existing.fallback_routes ?? undefined)
          : patch.fallback_routes,
      request_params:
        patch.request_params === undefined
          ? (existing.request_params ?? undefined)
          : patch.request_params,
      response_mode: patch.response_mode ?? existing.response_mode,
    });
    Object.assign(existing, merged, { updated_at: new Date().toISOString() });
    try {
      await this.repo.save(existing);
    } catch (error) {
      this.throwDuplicateIfNeeded(error, merged.model_id);
      throw error;
    }
    return existing;
  }

  async setEnabled(agentId: string, id: string, enabled: boolean): Promise<ExposedModelRoute> {
    const row = await this.findOrThrow(agentId, id);
    row.enabled = enabled;
    row.updated_at = new Date().toISOString();
    await this.repo.save(row);
    return row;
  }

  async delete(agentId: string, id: string): Promise<void> {
    const row = await this.findOrThrow(agentId, id);
    await this.repo.delete(row.id);
  }

  async resolveModelRequest(
    agentId: string,
    tenantId: string,
    requestedModel: unknown,
  ): Promise<ModelAliasResolution> {
    if (typeof requestedModel !== 'string' || requestedModel.trim() === '') {
      return { kind: 'auto' };
    }
    const modelId = requestedModel.trim();
    const lower = modelId.toLowerCase();
    if (RESERVED_MODEL_IDS.has(lower)) return { kind: 'auto' };

    const alias = await this.findByModelId(agentId, modelId);
    if (alias) {
      if (!alias.enabled) {
        throw new NotFoundException(
          `Model alias "${modelId}" is disabled. Enable it or use manifest/auto.`,
        );
      }
      return {
        kind: 'resolved',
        resolved: await this.resolveAlias(agentId, tenantId, alias),
        requestParams: alias.source_kind === 'direct' ? (alias.request_params ?? null) : undefined,
        scopeKey: alias.source_kind === 'direct' ? `model-alias:${alias.id}` : undefined,
        acceptsReasoningEffortHeader: alias.source_kind === 'direct',
      };
    }

    const rawDirect = await this.resolveRawDirect(agentId, tenantId, modelId);
    if (rawDirect === 'ambiguous') {
      throw new BadRequestException(
        `Model "${modelId}" matches multiple provider/auth routes. Configure an alias to choose one explicitly.`,
      );
    }
    if (rawDirect) {
      return {
        kind: 'resolved',
        resolved: rawDirect.resolved,
        requestParams: rawDirect.requestParams,
        scopeKey: `direct-model:${rawDirect.resolved.route?.provider}:${rawDirect.resolved.route?.authType}:${rawDirect.resolved.route?.model}`,
        acceptsReasoningEffortHeader: true,
      };
    }

    throw new NotFoundException(
      `Model "${modelId}" is not exposed for this agent. Use manifest/auto or configure a model alias.`,
    );
  }

  private async resolveAlias(
    agentId: string,
    tenantId: string,
    alias: ExposedModelRoute,
  ): Promise<ResolveResponse> {
    if (alias.source_kind === 'tier') {
      return this.resolveService.resolveForTier(
        agentId,
        tenantId,
        this.requiredTierSlot(alias.source_key),
        'model-alias',
      );
    }
    if (alias.source_kind === 'specificity') {
      return this.resolveService.resolveForSpecificityCategory(
        agentId,
        tenantId,
        this.requiredSpecificityCategory(alias.source_key),
        'model-alias',
      );
    }
    if (alias.source_kind === 'header_tier') {
      return this.resolveService.resolveForHeaderTierId(
        agentId,
        tenantId,
        this.requiredSourceKey(alias.source_key, 'header_tier'),
        'model-alias',
      );
    }

    const route = isModelRoute(alias.route) ? alias.route : null;
    if (!route) {
      throw new BadRequestException(`Alias "${alias.model_id}" has no direct route configured.`);
    }
    const responseMode = alias.response_mode ?? DEFAULT_RESPONSE_MODE;
    const fallbackRoutes = isModelRouteArray(alias.fallback_routes) ? alias.fallback_routes : null;
    const enrichedRoute = await this.enrichRouteKeyLabel(agentId, tenantId, route);
    const effective = effectiveRoutesForResponseMode(responseMode, enrichedRoute, fallbackRoutes);
    return {
      tier: 'default',
      route: effective.primaryRoute,
      fallback_routes: effective.fallbackRoutes,
      output_modality: DEFAULT_OUTPUT_MODALITY,
      response_mode: responseMode,
      confidence: 1,
      score: 0,
      reason: 'direct-model',
    };
  }

  private async resolveRawDirect(
    agentId: string,
    tenantId: string,
    modelId: string,
  ): Promise<
    { resolved: ResolveResponse; requestParams: RequestParamDefaults | null } | 'ambiguous' | null
  > {
    const exact = await this.findRawDirectCandidates(agentId, tenantId, modelId);
    if (exact.length > 1) return 'ambiguous';
    if (exact.length === 1) return this.buildRawDirectResolution(agentId, tenantId, exact[0], null);

    const suffix = parseReasoningSuffix(modelId);
    if (!suffix) return null;

    const withSuffix = await this.findRawDirectCandidates(agentId, tenantId, suffix.baseModelId);
    if (withSuffix.length > 1) return 'ambiguous';
    if (withSuffix.length !== 1) return null;

    const requestParams = await this.requestParamsForReasoningEffort(withSuffix[0], suffix.effort);
    return this.buildRawDirectResolution(agentId, tenantId, withSuffix[0], requestParams);
  }

  async requestParamsForReasoningEffort(
    route: ModelRoute,
    effort: string,
  ): Promise<RequestParamDefaults> {
    const normalized = normalizeReasoningEffort(effort);
    const specs = await this.providerParamSpecs.getSpecs(
      route.provider,
      route.authType,
      route.model,
    );
    const candidates = specs.filter(isReasoningEffortSpec);
    const spec = candidates.find(
      (candidate) =>
        !candidate.values ||
        candidate.values.some(
          (value) => typeof value === 'string' && value.toLowerCase() === normalized,
        ),
    );
    if (!spec) {
      if (candidates.length === 0) {
        throw new BadRequestException(
          `Reasoning effort is not supported for ${route.provider}/${route.model}.`,
        );
      }
      throw new BadRequestException(
        `Reasoning effort "${normalized}" is not supported for ${route.provider}/${route.model}.`,
      );
    }
    return setProviderParamValue({}, spec.path, normalized);
  }

  private async buildRawDirectResolution(
    agentId: string,
    tenantId: string,
    route: ModelRoute,
    requestParams: RequestParamDefaults | null,
  ): Promise<{ resolved: ResolveResponse; requestParams: RequestParamDefaults | null }> {
    const enrichedRoute = await this.enrichRouteKeyLabel(agentId, tenantId, route);
    return {
      requestParams,
      resolved: {
        tier: 'default',
        route: enrichedRoute,
        fallback_routes: null,
        output_modality: DEFAULT_OUTPUT_MODALITY,
        response_mode: DEFAULT_RESPONSE_MODE,
        confidence: 1,
        score: 0,
        reason: 'direct-model',
      },
    };
  }

  private async findRawDirectCandidates(
    agentId: string,
    tenantId: string,
    modelId: string,
  ): Promise<ModelRoute[]> {
    const requested = modelId.toLowerCase();
    const models = await this.discoveryService.getModelsForAgent(tenantId, agentId);
    const candidates = models
      .filter((model): model is DiscoveredModel & { authType: AuthType } => !!model.authType)
      .filter((model) => this.publicRouteIds(model).includes(requested))
      .map<ModelRoute>((model) => ({
        provider: model.provider,
        authType: model.authType,
        model: model.id,
      }));
    return dedupeRoutes(candidates);
  }

  private publicRouteIds(model: DiscoveredModel & { authType: AuthType }): string[] {
    const provider = model.provider.toLowerCase();
    const modelId = model.id.toLowerCase();
    const ids = new Set<string>();
    if (modelId.startsWith(`${provider}/`)) {
      ids.add(modelId);
    } else {
      ids.add(`${provider}/${modelId}`);
    }
    ids.add(`${provider}-${authModeSlug(model.authType)}/${modelId}`);
    return [...ids];
  }

  private async normalizeInput(
    agentId: string,
    tenantId: string,
    input: AliasInputShape,
  ): Promise<NormalizedAliasInput> {
    const modelId = this.validateModelId(input.model_id);
    const displayName = normalizeDisplayName(input.display_name);
    const sourceKind = this.validateSourceKind(input.source_kind);
    const sourceKey = await this.validateSourceKey(agentId, sourceKind, input.source_key);
    const route = isModelRoute(input.route) ? normalizeRoute(input.route) : null;
    const fallbackRoutes = isModelRouteArray(input.fallback_routes)
      ? input.fallback_routes.map(normalizeRoute)
      : null;
    const requestParams = normalizeRequestParams(input.request_params);
    const responseMode = input.response_mode ?? DEFAULT_RESPONSE_MODE;
    if (!isResponseMode(responseMode)) throw new BadRequestException('Invalid response_mode');

    if (sourceKind === 'direct' && !route) {
      throw new BadRequestException('Direct aliases require a route.');
    }
    if (sourceKind !== 'direct' && route) {
      throw new BadRequestException('Only direct aliases can store a route.');
    }
    if (sourceKind !== 'direct' && requestParams) {
      throw new BadRequestException('Only direct aliases can store request_params.');
    }
    if (route) await this.validateRouteAvailable(agentId, tenantId, route);
    if (fallbackRoutes) {
      for (const fallbackRoute of fallbackRoutes) {
        await this.validateRouteAvailable(agentId, tenantId, fallbackRoute);
      }
    }

    return {
      model_id: modelId,
      display_name: displayName,
      enabled: input.enabled ?? true,
      source_kind: sourceKind,
      source_key: sourceKey,
      route,
      fallback_routes: fallbackRoutes,
      request_params: requestParams,
      response_mode: responseMode,
    };
  }

  private validateModelId(value: unknown): string {
    if (typeof value !== 'string') throw new BadRequestException('model_id is required');
    const modelId = value.trim();
    if (!modelId) throw new BadRequestException('model_id is required');
    if (modelId.length > MAX_MODEL_ALIAS_ID_LENGTH) {
      throw new BadRequestException(
        `model_id must be ${MAX_MODEL_ALIAS_ID_LENGTH} characters or less`,
      );
    }
    if (!MODEL_ID_RE.test(modelId)) {
      throw new BadRequestException('model_id cannot contain whitespace or control characters');
    }
    if (RESERVED_MODEL_IDS.has(modelId.toLowerCase())) {
      throw new BadRequestException(`${modelId} is reserved by Manifest.`);
    }
    return modelId;
  }

  private validateSourceKind(value: unknown): ExposedModelSourceKind {
    if (
      typeof value === 'string' &&
      (EXPOSED_MODEL_SOURCE_KINDS as readonly string[]).includes(value)
    ) {
      return value as ExposedModelSourceKind;
    }
    throw new BadRequestException(
      `source_kind must be one of: ${EXPOSED_MODEL_SOURCE_KINDS.join(', ')}`,
    );
  }

  private async validateSourceKey(
    agentId: string,
    kind: ExposedModelSourceKind,
    value: unknown,
  ): Promise<string | null> {
    if (kind === 'direct') return null;
    const key = this.requiredSourceKey(typeof value === 'string' ? value.trim() : null, kind);
    if (kind === 'tier') this.requiredTierSlot(key);
    if (kind === 'specificity') this.requiredSpecificityCategory(key);
    if (kind === 'header_tier') {
      const tiers = await this.headerTierService.list(agentId);
      if (!tiers.some((tier) => tier.id === key)) {
        throw new BadRequestException(`Unknown header tier: ${key}`);
      }
    }
    return key;
  }

  private requiredSourceKey(
    value: string | null | undefined,
    kind: ExposedModelSourceKind,
  ): string {
    if (!value) throw new BadRequestException(`${kind} aliases require source_key.`);
    return value;
  }

  private requiredTierSlot(value: string | null | undefined): TierSlot {
    const key = this.requiredSourceKey(value, 'tier');
    if (!(TIER_SLOTS as readonly string[]).includes(key)) {
      throw new BadRequestException(`Invalid tier source_key: ${key}`);
    }
    return key as TierSlot;
  }

  private requiredSpecificityCategory(value: string | null | undefined): SpecificityCategory {
    const key = this.requiredSourceKey(value, 'specificity');
    if (!(SPECIFICITY_CATEGORIES as readonly string[]).includes(key)) {
      throw new BadRequestException(`Invalid specificity source_key: ${key}`);
    }
    return key as SpecificityCategory;
  }

  private async validateRouteAvailable(
    agentId: string,
    tenantId: string,
    route: ModelRoute,
  ): Promise<void> {
    const models = await this.discoveryService.getModelsForAgent(tenantId, agentId);
    const comparable = models.filter(
      (model) =>
        model.provider.toLowerCase() === route.provider.toLowerCase() &&
        model.authType === route.authType,
    );
    if (comparable.length === 0) return;
    if (comparable.some((model) => model.id === route.model)) return;
    throw new BadRequestException(
      `Model "${route.model}" is not available for ${route.provider}/${route.authType}.`,
    );
  }

  private async enrichRouteKeyLabel(
    agentId: string,
    tenantId: string,
    route: ModelRoute,
  ): Promise<ModelRoute> {
    if (route.keyLabel) return route;
    const label = await this.providerKeyService.getDefaultKeyLabel(
      tenantId,
      route.provider,
      route.authType,
      agentId,
    );
    return label ? { ...route, keyLabel: label } : route;
  }

  private async findOrThrow(agentId: string, id: string): Promise<ExposedModelRoute> {
    const row = await this.repo.findOne({ where: { id, agent_id: agentId } });
    if (!row) throw new NotFoundException('Model alias not found');
    return row;
  }

  private async findByModelId(agentId: string, modelId: string): Promise<ExposedModelRoute | null> {
    return this.repo
      .createQueryBuilder('alias')
      .where('alias.agent_id = :agentId', { agentId })
      .andWhere('LOWER(alias.model_id) = :modelId', { modelId: modelId.toLowerCase() })
      .getOne();
  }

  private throwDuplicateIfNeeded(error: unknown, modelId: string): never | void {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: unknown }).code === '23505'
    ) {
      throw new BadRequestException(`Model alias "${modelId}" already exists for this agent.`);
    }
  }
}

function normalizeDisplayName(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_MODEL_ALIAS_DISPLAY_NAME_LENGTH);
}

function normalizeRoute(route: ModelRoute): ModelRoute {
  const keyLabel = route.keyLabel?.trim();
  return {
    provider: route.provider.trim(),
    authType: route.authType,
    model: route.model.trim(),
    ...(keyLabel ? { keyLabel } : {}),
  };
}

function normalizeRequestParams(value: unknown): RequestParamDefaults | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as RequestParamDefaults;
}

function authModeSlug(authType: AuthType): string {
  if (authType === 'api_key') return 'api';
  return authType;
}

function parseReasoningSuffix(modelId: string): { baseModelId: string; effort: string } | null {
  const lower = modelId.toLowerCase();
  for (const effort of REASONING_EFFORT_SUFFIXES) {
    const suffix = `-${effort}`;
    if (!lower.endsWith(suffix)) continue;
    const baseModelId = modelId.slice(0, -suffix.length);
    if (!baseModelId) return null;
    return { baseModelId, effort };
  }
  return null;
}

function normalizeReasoningEffort(effort: string): string {
  const normalized = effort.trim().toLowerCase();
  if (!normalized || /[\s\x00-\x1F\x7F]/.test(normalized)) {
    throw new BadRequestException('Reasoning effort must be a non-empty token.');
  }
  return normalized;
}

function isReasoningEffortSpec(spec: ProviderParamSpec): boolean {
  if (spec.group !== 'reasoning') return false;
  const path = spec.path.toLowerCase();
  if (path === 'reasoning_effort') return true;
  if (path.endsWith('.effort')) return true;
  if (path.endsWith('thinkinglevel')) return true;
  const label = spec.label.toLowerCase();
  return spec.type === 'enum' && label.includes('effort');
}

function dedupeRoutes(routes: ModelRoute[]): ModelRoute[] {
  const seen = new Set<string>();
  const out: ModelRoute[] = [];
  for (const route of routes) {
    const key = [
      route.provider.toLowerCase(),
      route.authType,
      route.model,
      route.keyLabel?.trim().toLowerCase() ?? '',
    ].join('\u0000');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(route);
  }
  return out;
}
