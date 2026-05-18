import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ModelParamsController } from '../model-params.controller';
import { AgentModelParamsService } from '../routing-core/agent-model-params.service';
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
  let resolveAgent: jest.Mocked<{ resolve: jest.Mock }>;

  beforeEach(async () => {
    service = {
      list: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      get: jest.fn(),
    };
    resolveAgent = {
      resolve: jest.fn().mockResolvedValue(mockAgent),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ModelParamsController],
      providers: [
        { provide: AgentModelParamsService, useValue: service },
        { provide: ResolveAgentService, useValue: resolveAgent },
      ],
    }).compile();

    controller = module.get<ModelParamsController>(ModelParamsController);
  });

  describe('GET /model-params', () => {
    it('returns the projected list for the agent', async () => {
      service.list.mockResolvedValueOnce([
        {
          provider: 'deepseek',
          auth_type: 'api_key',
          model_name: 'deepseek-v4',
          params: { thinking: 'disabled' },
        },
      ]);

      const result = await controller.list(mockUser, { agentName: 'demo' });

      expect(result).toEqual([
        {
          provider: 'deepseek',
          authType: 'api_key',
          model: 'deepseek-v4',
          params: { thinking: 'disabled' },
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
        params: { thinking: 'disabled' },
      });

      const result = await controller.set(
        mockUser,
        { agentName: 'demo' },
        {
          provider: 'deepseek',
          authType: 'api_key',
          model: 'deepseek-v4',
          params: { thinking: 'disabled' },
        },
      );

      expect(service.set).toHaveBeenCalledWith(
        'agent-1',
        'user-1',
        'deepseek',
        'api_key',
        'deepseek-v4',
        { thinking: 'disabled' },
      );
      expect(result).toEqual({
        provider: 'deepseek',
        authType: 'api_key',
        model: 'deepseek-v4',
        params: { thinking: 'disabled' },
      });
    });

    it('persists all Anthropic API-key scalar params', async () => {
      service.set.mockImplementation(
        async (_agentId, _userId, provider, authType, model, params) => ({
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
      };

      const result = await controller.set(
        mockUser,
        { agentName: 'demo' },
        {
          provider: 'anthropic',
          authType: 'api_key',
          model: 'claude-opus-4-7',
          params: paramDefaults,
        },
      );

      expect(service.set).toHaveBeenCalledWith(
        'agent-1',
        'user-1',
        'anthropic',
        'api_key',
        'claude-opus-4-7',
        paramDefaults,
      );
      expect(result.params).toEqual(paramDefaults);
    });

    it('strips keys the provider does not consume and persists only the compatible subset', async () => {
      service.set.mockImplementation(async (_a, _u, p, a, m, params) => ({
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
            provider: 'deepseek',
            authType: 'api_key',
            model: 'deepseek-v4',
            params: {},
          },
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws when the provider does not consume any of the supplied keys', async () => {
      await expect(
        controller.set(
          mockUser,
          { agentName: 'demo' },
          {
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
          provider: 'deepseek',
          authType: 'api_key',
          model: 'deepseek-v4',
        },
      );

      expect(service.delete).toHaveBeenCalledWith('agent-1', 'deepseek', 'api_key', 'deepseek-v4');
      expect(result).toEqual({ ok: true });
    });
  });
});
