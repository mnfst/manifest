import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { ModelRoute, ProviderParamSpec } from 'manifest-shared';
import { ExposedModelRoute } from '../../entities/exposed-model-route.entity';
import type { ModelDiscoveryService } from '../../model-discovery/model-discovery.service';
import type { ResolveService } from '../resolve/resolve.service';
import type { HeaderTierService } from '../header-tiers/header-tier.service';
import type { ProviderKeyService } from '../routing-core/provider-key.service';
import type { ProviderParamSpecService } from '../routing-core/provider-param-spec.service';
import { ModelAliasService } from './model-alias.service';

const route = (provider: string, authType: ModelRoute['authType'], model: string): ModelRoute => ({
  provider,
  authType,
  model,
});

const dtoRoute = (
  provider: string,
  authType: ModelRoute['authType'],
  model: string,
): { provider: string; authType: ModelRoute['authType']; model: string } => ({
  provider,
  authType,
  model,
});

describe('ModelAliasService', () => {
  let rows: ExposedModelRoute[];
  let repo: jest.Mocked<
    Pick<
      Repository<ExposedModelRoute>,
      'find' | 'findOne' | 'save' | 'delete' | 'createQueryBuilder'
    >
  >;
  let discoveryService: jest.Mocked<Pick<ModelDiscoveryService, 'getModelsForAgent'>>;
  let resolveService: jest.Mocked<
    Pick<
      ResolveService,
      'resolveForTier' | 'resolveForSpecificityCategory' | 'resolveForHeaderTierId'
    >
  >;
  let headerTierService: jest.Mocked<Pick<HeaderTierService, 'list'>>;
  let providerKeyService: jest.Mocked<Pick<ProviderKeyService, 'getDefaultKeyLabel'>>;
  let providerParamSpecs: jest.Mocked<Pick<ProviderParamSpecService, 'getSpecs'>>;
  let service: ModelAliasService;

  beforeEach(() => {
    rows = [];
    repo = {
      find: jest.fn(async ({ where } = {}) => {
        const criteria = where as Partial<ExposedModelRoute> | undefined;
        return rows.filter((row) =>
          Object.entries(criteria ?? {}).every(
            ([key, value]) => row[key as keyof ExposedModelRoute] === value,
          ),
        );
      }),
      findOne: jest.fn(async ({ where }) => {
        const criteria = where as Partial<ExposedModelRoute>;
        return (
          rows.find((row) =>
            Object.entries(criteria).every(
              ([key, value]) => row[key as keyof ExposedModelRoute] === value,
            ),
          ) ?? null
        );
      }),
      save: jest.fn(async (row: ExposedModelRoute) => {
        const index = rows.findIndex((existing) => existing.id === row.id);
        if (
          rows.some(
            (existing) =>
              existing.id !== row.id &&
              existing.agent_id === row.agent_id &&
              existing.model_id.toLowerCase() === row.model_id.toLowerCase(),
          )
        ) {
          throw Object.assign(new Error('duplicate'), { code: '23505' });
        }
        if (index >= 0) rows[index] = row;
        else rows.push(row);
        return row;
      }),
      delete: jest.fn(async (id: string) => {
        rows = rows.filter((row) => row.id !== id);
        return { affected: 1, raw: [] };
      }),
      createQueryBuilder: jest.fn(() => {
        const params: { agentId?: string; modelId?: string } = {};
        const builder: {
          where: jest.Mock;
          andWhere: jest.Mock;
          getOne: jest.Mock;
        } = {
          where: jest.fn((_sql: string, next: typeof params): typeof builder => {
            Object.assign(params, next);
            return builder;
          }),
          andWhere: jest.fn((_sql: string, next: typeof params): typeof builder => {
            Object.assign(params, next);
            return builder;
          }),
          getOne: jest.fn(async () => {
            if (!params.agentId || !params.modelId) return null;
            return (
              rows.find(
                (row) =>
                  row.agent_id === params.agentId && row.model_id.toLowerCase() === params.modelId,
              ) ?? null
            );
          }),
        };
        return builder;
      }),
    } as never;
    discoveryService = { getModelsForAgent: jest.fn().mockResolvedValue([]) };
    resolveService = {
      resolveForTier: jest.fn(),
      resolveForSpecificityCategory: jest.fn(),
      resolveForHeaderTierId: jest.fn(),
    };
    headerTierService = { list: jest.fn().mockResolvedValue([{ id: 'header-1' }]) };
    providerKeyService = { getDefaultKeyLabel: jest.fn().mockResolvedValue('Default') };
    providerParamSpecs = { getSpecs: jest.fn().mockResolvedValue([]) };
    service = new ModelAliasService(
      repo as unknown as Repository<ExposedModelRoute>,
      discoveryService as unknown as ModelDiscoveryService,
      resolveService as unknown as ResolveService,
      headerTierService as unknown as HeaderTierService,
      providerKeyService as unknown as ProviderKeyService,
      providerParamSpecs as unknown as ProviderParamSpecService,
    );
  });

  it('rejects reserved alias ids', async () => {
    await expect(
      service.create('agent-1', 'tenant-1', {
        model_id: 'manifest/auto',
        source_kind: 'tier',
        source_key: 'default',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('enforces case-insensitive uniqueness per agent', async () => {
    await service.create('agent-1', 'tenant-1', {
      model_id: 'OpenAI-API/gpt-5',
      source_kind: 'direct',
      route: dtoRoute('openai', 'api_key', 'gpt-5'),
    });

    await expect(
      service.create('agent-1', 'tenant-1', {
        model_id: 'openai-api/GPT-5',
        source_kind: 'direct',
        route: dtoRoute('openai', 'api_key', 'gpt-5'),
      }),
    ).rejects.toThrow(/already exists/);
  });

  it('rejects disabled aliases during proxy resolution', async () => {
    await service.create('agent-1', 'tenant-1', {
      model_id: 'openai-api/gpt-5',
      enabled: false,
      source_kind: 'direct',
      route: dtoRoute('openai', 'api_key', 'gpt-5'),
    });

    await expect(
      service.resolveModelRequest('agent-1', 'tenant-1', 'openai-api/gpt-5'),
    ).rejects.toThrow(NotFoundException);
  });

  it('returns unmatched for unknown model ids so the proxy can try upstream ids', async () => {
    await expect(
      service.resolveModelRequest('agent-1', 'tenant-1', 'openai/gpt-5'),
    ).resolves.toEqual({ kind: 'unmatched' });
  });

  it('resolves direct aliases without calling scorer-backed resolver methods', async () => {
    await service.create('agent-1', 'tenant-1', {
      model_id: 'openai-api/gpt-5-high',
      source_kind: 'direct',
      route: dtoRoute('openai', 'api_key', 'gpt-5'),
      request_params: { reasoning_effort: 'high' },
    });

    const result = await service.resolveModelRequest(
      'agent-1',
      'tenant-1',
      'openai-api/gpt-5-high',
    );

    expect(result.kind).toBe('resolved');
    if (result.kind === 'resolved') {
      expect(result.resolved.reason).toBe('direct-model');
      expect(result.resolved.route).toEqual({
        provider: 'openai',
        authType: 'api_key',
        model: 'gpt-5',
        keyLabel: 'Default',
      });
      expect(result.requestParams).toEqual({ reasoning_effort: 'high' });
    }
    expect(resolveService.resolveForTier).not.toHaveBeenCalled();
  });

  it('resolves tier aliases through the current tier route', async () => {
    resolveService.resolveForTier.mockResolvedValue({
      tier: 'reasoning',
      route: route('anthropic', 'subscription', 'claude-sonnet-4'),
      fallback_routes: null,
      confidence: 1,
      score: 0,
      reason: 'model-alias',
    });
    await service.create('agent-1', 'tenant-1', {
      model_id: 'manifest/tier-reasoning',
      source_kind: 'tier',
      source_key: 'reasoning',
    });

    const result = await service.resolveModelRequest(
      'agent-1',
      'tenant-1',
      'manifest/tier-reasoning',
    );

    expect(result.kind).toBe('resolved');
    expect(resolveService.resolveForTier).toHaveBeenCalledWith(
      'agent-1',
      'tenant-1',
      'reasoning',
      'model-alias',
    );
  });

  it('rejects ambiguous raw provider/model routes', async () => {
    discoveryService.getModelsForAgent.mockResolvedValue([
      {
        id: 'gpt-5',
        displayName: 'GPT-5',
        provider: 'openai',
        authType: 'api_key',
      },
      {
        id: 'gpt-5',
        displayName: 'GPT-5',
        provider: 'openai',
        authType: 'subscription',
      },
    ] as never);

    await expect(
      service.resolveModelRequest('agent-1', 'tenant-1', 'openai/gpt-5'),
    ).rejects.toThrow(/multiple provider\/auth routes/);
  });

  it('supports raw auth-qualified reasoning aliases', async () => {
    discoveryService.getModelsForAgent.mockResolvedValue([
      {
        id: 'gpt-5',
        displayName: 'GPT-5',
        provider: 'openai',
        authType: 'api_key',
      },
    ] as never);
    providerParamSpecs.getSpecs.mockResolvedValue([
      {
        provider: 'openai',
        authType: 'api_key',
        model: 'gpt-5',
        path: 'reasoning_effort',
        label: 'Reasoning effort',
        description: '',
        group: 'reasoning',
        type: 'enum',
        values: ['low', 'medium', 'high'],
      } as ProviderParamSpec,
    ]);

    const result = await service.resolveModelRequest(
      'agent-1',
      'tenant-1',
      'openai-api/gpt-5-high',
    );

    expect(result.kind).toBe('resolved');
    if (result.kind === 'resolved') {
      expect(result.resolved.route?.model).toBe('gpt-5');
      expect(result.requestParams).toEqual({ reasoning_effort: 'high' });
    }
  });

  it('supports upstream canonical subscription model ids as raw direct routes', async () => {
    discoveryService.getModelsForAgent.mockResolvedValue([
      {
        id: 'gpt-5',
        displayName: 'GPT-5',
        provider: 'openai',
        authType: 'subscription',
      },
    ] as never);

    const result = await service.resolveModelRequest(
      'agent-1',
      'tenant-1',
      'openai/gpt-5-subscription',
    );

    expect(result.kind).toBe('resolved');
    if (result.kind === 'resolved') {
      expect(result.resolved.route).toEqual({
        provider: 'openai',
        authType: 'subscription',
        model: 'gpt-5',
        keyLabel: 'Default',
      });
    }
  });

  it('maps reasoning effort to provider-specific thinking level params', async () => {
    providerParamSpecs.getSpecs.mockResolvedValue([
      {
        provider: 'gemini',
        authType: 'api_key',
        model: 'gemini-3.5-flash',
        path: 'generationConfig.thinkingConfig.thinkingLevel',
        label: 'Thinking level',
        description: '',
        group: 'reasoning',
        type: 'enum',
        values: ['low', 'medium', 'high'],
      } as ProviderParamSpec,
    ]);

    await expect(
      service.requestParamsForReasoningEffort(
        route('gemini', 'api_key', 'gemini-3.5-flash'),
        'High',
      ),
    ).resolves.toEqual({
      generationConfig: { thinkingConfig: { thinkingLevel: 'high' } },
    });
  });

  it('rejects unsupported reasoning efforts for known reasoning params', async () => {
    providerParamSpecs.getSpecs.mockResolvedValue([
      {
        provider: 'openai',
        authType: 'api_key',
        model: 'gpt-5',
        path: 'reasoning_effort',
        label: 'Reasoning effort',
        description: '',
        group: 'reasoning',
        type: 'enum',
        values: ['low', 'medium', 'high'],
      } as ProviderParamSpec,
    ]);

    await expect(
      service.requestParamsForReasoningEffort(route('openai', 'api_key', 'gpt-5'), 'xhigh'),
    ).rejects.toThrow(BadRequestException);
  });

  it('does not treat reasoning summary enums as effort params', async () => {
    providerParamSpecs.getSpecs.mockResolvedValue([
      {
        provider: 'openai',
        authType: 'subscription',
        model: 'gpt-5.1-codex',
        path: 'reasoning.summary',
        label: 'Reasoning summary',
        description: 'Controls the level of reasoning summary returned with the response.',
        group: 'reasoning',
        type: 'enum',
        values: ['auto', 'concise', 'detailed', 'none'],
      } as ProviderParamSpec,
    ]);

    await expect(
      service.requestParamsForReasoningEffort(
        route('openai', 'subscription', 'gpt-5.1-codex'),
        'none',
      ),
    ).rejects.toThrow(/not supported/);
  });
});
