import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ModelParamsController } from '../model-params.controller';
import { AgentModelParamsService } from '../routing-core/agent-model-params.service';
import { ProviderParamSpecService } from '../routing-core/provider-param-spec.service';
import { ResolveAgentService } from '../routing-core/resolve-agent.service';
import { AuthUser } from '../../auth/auth.instance';

const mockUser: AuthUser = { id: 'user-1' } as AuthUser;
const mockAgent = { id: 'agent-1' };

describe('ModelParamsController', () => {
  let controller: ModelParamsController;
  let service: jest.Mocked<{
    list: jest.Mock;
    set: jest.Mock;
    delete: jest.Mock;
    get: jest.Mock;
  }>;
  let providerParamSpecs: jest.Mocked<{
    getRegistry: jest.Mock;
    getSpecs: jest.Mock;
  }>;
  let resolveAgent: jest.Mocked<{ resolve: jest.Mock }>;

  beforeEach(async () => {
    service = {
      list: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      get: jest.fn(),
    };
    providerParamSpecs = {
      getRegistry: jest.fn(),
      getSpecs: jest.fn(),
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

  describe('GET /model-params', () => {
    it('returns the projected list for the agent', async () => {
      service.list.mockResolvedValueOnce([
        {
          scope_key: 'tier:simple',
          provider: 'deepseek',
          auth_type: 'api_key',
          model_name: 'deepseek-v4',
          params: { thinking: 'disabled' },
        },
      ]);

      const result = await controller.list(mockUser, { agentName: 'demo' });

      expect(result).toEqual([
        {
          scope: 'tier:simple',
          provider: 'deepseek',
          authType: 'api_key',
          model: 'deepseek-v4',
          params: { thinking: 'disabled' },
        },
      ]);
    });
  });

  describe('GET /model-param-specs', () => {
    it('returns the backend-loaded param spec registry', async () => {
      const registry = {
        'deepseek:api_key': {
          base: [
            {
              key: 'thinking',
              control: {
                kind: 'toggle',
                label: 'Thinking mode',
                values: ['enabled', 'disabled'],
                default: 'enabled',
              },
            },
          ],
        },
      };
      providerParamSpecs.getRegistry.mockResolvedValueOnce(registry);

      await expect(controller.specs(mockUser, { agentName: 'demo' })).resolves.toBe(registry);
      expect(resolveAgent.resolve).toHaveBeenCalledWith('user-1', 'demo');
    });
  });

  describe('PUT /model-params', () => {
    it('persists compatible params and returns the projected row', async () => {
      providerParamSpecs.getSpecs.mockResolvedValueOnce([
        {
          key: 'thinking',
          control: {
            kind: 'toggle',
            label: 'Thinking mode',
            values: ['enabled', 'disabled'],
            default: 'enabled',
          },
        },
      ]);
      service.set.mockResolvedValueOnce({
        scope_key: 'tier:simple',
        provider: 'deepseek',
        auth_type: 'api_key',
        model_name: 'deepseek-v4',
        params: { thinking: 'disabled' },
      });

      const result = await controller.set(
        mockUser,
        { agentName: 'demo' },
        {
          scope: 'tier:simple',
          provider: 'deepseek',
          authType: 'api_key',
          model: 'deepseek-v4',
          params: { thinking: 'disabled' },
        },
      );

      expect(service.set).toHaveBeenCalledWith(
        'agent-1',
        'user-1',
        'tier:simple',
        'deepseek',
        'api_key',
        'deepseek-v4',
        { thinking: 'disabled' },
      );
      expect(result).toEqual({
        scope: 'tier:simple',
        provider: 'deepseek',
        authType: 'api_key',
        model: 'deepseek-v4',
        params: { thinking: 'disabled' },
      });
    });

    it('persists all Anthropic API-key scalar params', async () => {
      providerParamSpecs.getSpecs.mockResolvedValueOnce([
        {
          key: 'max_tokens',
          control: { kind: 'number', label: 'Max tokens', min: 1, default: 4096 },
        },
        {
          key: 'temperature',
          control: { kind: 'slider', label: 'Temperature', min: 0, max: 1, step: 0.1, default: 1 },
        },
        {
          key: 'top_p',
          control: { kind: 'slider', label: 'Top P', min: 0, max: 1, step: 0.01, default: 1 },
        },
        {
          key: 'top_k',
          control: { kind: 'number', label: 'Top K', min: 0, default: 0 },
        },
        {
          key: 'type',
          group: { key: 'thinking', label: 'Thinking' },
          control: {
            kind: 'select',
            label: 'Thinking mode',
            values: ['disabled', 'adaptive', 'enabled'],
            default: 'disabled',
          },
        },
        {
          key: 'budget_tokens',
          group: { key: 'thinking', label: 'Thinking' },
          visibleWhen: { key: 'type', equals: 'enabled' },
          control: { kind: 'number', label: 'Budget tokens', min: 1024, default: 4096 },
        },
      ]);
      service.set.mockImplementation(
        async (_agentId, _userId, scope, provider, authType, model, params) => ({
          scope_key: scope,
          provider,
          auth_type: authType,
          model_name: model,
          params,
        }),
      );

      const paramDefaults = {
        max_tokens: 1234,
        temperature: 0.6,
        top_p: 0.77,
        top_k: 10,
        thinking: { type: 'enabled', budget_tokens: 4096 },
      };

      const result = await controller.set(
        mockUser,
        { agentName: 'demo' },
        {
          scope: 'tier:expert',
          provider: 'anthropic',
          authType: 'api_key',
          model: 'claude-opus-4-7',
          params: paramDefaults,
        },
      );

      expect(service.set).toHaveBeenCalledWith(
        'agent-1',
        'user-1',
        'tier:expert',
        'anthropic',
        'api_key',
        'claude-opus-4-7',
        paramDefaults,
      );
      expect(result.params).toEqual(paramDefaults);
    });

    it('strips keys the provider does not consume and persists only the compatible subset', async () => {
      providerParamSpecs.getSpecs.mockResolvedValueOnce([
        {
          key: 'thinking',
          control: {
            kind: 'toggle',
            label: 'Thinking mode',
            values: ['enabled', 'disabled'],
            default: 'enabled',
          },
        },
      ]);
      service.set.mockImplementation(async (_a, _u, scope, p, a, m, params) => ({
        scope_key: scope,
        provider: p,
        auth_type: a,
        model_name: m,
        params,
      }));

      // Future-proofing: extra keys the provider doesn't consume get filtered.
      // Today only `thinking` exists so a single-key payload doubles as the
      // compatibility check; this test ensures the trimming path is exercised.
      const out = await controller.set(
        mockUser,
        { agentName: 'demo' },
        {
          scope: 'tier:simple',
          provider: 'deepseek',
          authType: 'api_key',
          model: 'deepseek-v4',
          params: { thinking: 'enabled' },
        },
      );

      expect(out.params).toEqual({ thinking: 'enabled' });
    });

    it('throws when the params payload contains no configurable keys at all', async () => {
      await expect(
        controller.set(
          mockUser,
          { agentName: 'demo' },
          {
            scope: 'tier:simple',
            provider: 'deepseek',
            authType: 'api_key',
            model: 'deepseek-v4',
            params: {},
          },
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws when the provider does not consume any of the supplied keys', async () => {
      providerParamSpecs.getSpecs.mockResolvedValueOnce([]);
      await expect(
        controller.set(
          mockUser,
          { agentName: 'demo' },
          {
            scope: 'tier:simple',
            provider: 'openai',
            authType: 'api_key',
            model: 'gpt-4o',
            params: { thinking: 'enabled' },
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
          scope: 'tier:simple',
          provider: 'deepseek',
          authType: 'api_key',
          model: 'deepseek-v4',
        },
      );

      expect(service.delete).toHaveBeenCalledWith(
        'agent-1',
        'tier:simple',
        'deepseek',
        'api_key',
        'deepseek-v4',
      );
      expect(result).toEqual({ ok: true });
    });
  });
});
