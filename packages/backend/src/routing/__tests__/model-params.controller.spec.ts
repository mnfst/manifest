import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ModelParamsController } from '../model-params.controller';
import { AgentModelParamsService } from '../routing-core/agent-model-params.service';
import { ProviderParamSpecService } from '../routing-core/provider-param-spec.service';
import { ResolveAgentService } from '../routing-core/resolve-agent.service';
import { AuthUser } from '../../auth/auth.instance';
import type { ProviderParamSpecCatalog } from 'manifest-shared';

const mockUser: AuthUser = { id: 'user-1' } as AuthUser;
const mockAgent = { id: 'agent-1' };
const specs: ProviderParamSpecCatalog = [
  {
    provider: 'deepseek',
    authType: 'api_key',
    model: 'deepseek-v4',
    path: 'thinking.type',
    type: 'enum',
    label: 'Thinking mode',
    default: 'enabled',
    values: ['enabled', 'disabled'],
    group: 'reasoning',
  },
];

describe('ModelParamsController', () => {
  let controller: ModelParamsController;
  let service: jest.Mocked<{
    list: jest.Mock;
    set: jest.Mock;
    delete: jest.Mock;
    get: jest.Mock;
  }>;
  let providerParamSpecs: jest.Mocked<{ list: jest.Mock; getSpecs: jest.Mock }>;
  let resolveAgent: jest.Mocked<{ resolve: jest.Mock }>;

  beforeEach(async () => {
    service = {
      list: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      get: jest.fn(),
    };
    providerParamSpecs = {
      list: jest.fn().mockResolvedValue(specs),
      getSpecs: jest.fn().mockResolvedValue(specs),
    };
    resolveAgent = {
      resolve: jest.fn().mockResolvedValue(mockAgent),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ModelParamsController],
      providers: [
        { provide: AgentModelParamsService, useValue: service },
        { provide: ProviderParamSpecService, useValue: providerParamSpecs },
        { provide: ResolveAgentService, useValue: resolveAgent },
      ],
    }).compile();

    controller = module.get<ModelParamsController>(ModelParamsController);
  });

  describe('GET /model-param-specs', () => {
    it('returns the provider param spec catalog for the resolved agent', async () => {
      const result = await controller.specs(mockUser, { agentName: 'demo' });
      expect(resolveAgent.resolve).toHaveBeenCalledWith('user-1', 'demo');
      expect(result).toBe(specs);
    });
  });

  describe('GET /model-params', () => {
    it('returns the projected list for the agent', async () => {
      service.list.mockResolvedValueOnce([
        {
          provider: 'deepseek',
          auth_type: 'api_key',
          model_name: 'deepseek-v4',
          scope_key: 'tier:default',
          params: { thinking: { type: 'disabled' } },
        },
      ]);

      const result = await controller.list(mockUser, { agentName: 'demo' });

      expect(result).toEqual([
        {
          provider: 'deepseek',
          authType: 'api_key',
          model: 'deepseek-v4',
          scope: 'tier:default',
          params: { thinking: { type: 'disabled' } },
        },
      ]);
    });
  });

  describe('PUT /model-params', () => {
    it('persists compatible params and returns the projected row', async () => {
      service.set.mockResolvedValueOnce({
        provider: 'deepseek',
        auth_type: 'api_key',
        model_name: 'deepseek-v4',
        scope_key: 'tier:default',
        params: { thinking: { type: 'disabled' } },
      });

      const result = await controller.set(
        mockUser,
        { agentName: 'demo' },
        {
          scope: 'tier:default',
          provider: 'deepseek',
          authType: 'api_key',
          model: 'deepseek-v4',
          params: { thinking: { type: 'disabled' } },
        },
      );

      expect(providerParamSpecs.getSpecs).toHaveBeenCalledWith(
        'deepseek',
        'api_key',
        'deepseek-v4',
      );
      expect(service.set).toHaveBeenCalledWith(
        'agent-1',
        'user-1',
        'tier:default',
        'deepseek',
        'api_key',
        'deepseek-v4',
        { thinking: { type: 'disabled' } },
      );
      expect(result).toEqual({
        provider: 'deepseek',
        authType: 'api_key',
        model: 'deepseek-v4',
        scope: 'tier:default',
        params: { thinking: { type: 'disabled' } },
      });
    });

    it('strips keys the provider does not consume and persists only the compatible subset', async () => {
      service.set.mockImplementation(async (_agent, _user, scope, p, a, m, params) => ({
        provider: p,
        auth_type: a,
        model_name: m,
        scope_key: scope,
        params,
      }));

      const out = await controller.set(
        mockUser,
        { agentName: 'demo' },
        {
          scope: 'tier:default',
          provider: 'deepseek',
          authType: 'api_key',
          model: 'deepseek-v4',
          params: { temperature: 0.2, thinking: { type: 'enabled' } },
        },
      );

      expect(out.params).toEqual({ thinking: { type: 'enabled' } });
    });

    it('throws when the params payload contains no configurable keys at all', async () => {
      await expect(
        controller.set(
          mockUser,
          { agentName: 'demo' },
          {
            scope: 'tier:default',
            provider: 'deepseek',
            authType: 'api_key',
            model: 'deepseek-v4',
            params: {},
          },
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws when the model has no compatible specs', async () => {
      providerParamSpecs.getSpecs.mockResolvedValueOnce([]);
      await expect(
        controller.set(
          mockUser,
          { agentName: 'demo' },
          {
            scope: 'tier:default',
            provider: 'openai',
            authType: 'api_key',
            model: 'gpt-4o',
            params: { thinking: { type: 'enabled' } },
          },
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('DELETE /model-params', () => {
    it('removes the row and returns ok', async () => {
      const result = await controller.remove(
        mockUser,
        { agentName: 'demo' },
        {
          scope: 'tier:default',
          provider: 'deepseek',
          authType: 'api_key',
          model: 'deepseek-v4',
        },
      );

      expect(service.delete).toHaveBeenCalledWith(
        'agent-1',
        'tier:default',
        'deepseek',
        'api_key',
        'deepseek-v4',
      );
      expect(result).toEqual({ ok: true });
    });
  });
});
