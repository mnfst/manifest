import { BadRequestException } from '@nestjs/common';
import { SpecificityController } from '../specificity.controller';
import { SpecificityService } from '../routing-core/specificity.service';
import { ResolveAgentService } from '../routing-core/resolve-agent.service';
import { TenantContext } from '../../common/decorators/tenant-context.decorator';

const mockAgent = { id: 'agent-1', name: 'test-agent', tenant_id: 'tenant-1' };
const ctx: TenantContext = { tenantId: 'tenant-1', userId: 'user-1' };

describe('SpecificityController', () => {
  let controller: SpecificityController;
  let mockSpecificityService: {
    getAssignments: jest.Mock;
    setOverride: jest.Mock;
    toggleCategory: jest.Mock;
    clearOverride: jest.Mock;
    resetAll: jest.Mock;
    setFallbacks: jest.Mock;
    clearFallbacks: jest.Mock;
    setParamDefaults: jest.Mock;
  };
  let mockResolveAgentService: { resolve: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    mockSpecificityService = {
      getAssignments: jest.fn().mockResolvedValue([]),
      setOverride: jest.fn().mockResolvedValue({ id: 'sa-1', category: 'coding' }),
      toggleCategory: jest.fn().mockResolvedValue({ id: 'sa-1', is_active: true }),
      clearOverride: jest.fn().mockResolvedValue(undefined),
      resetAll: jest.fn().mockResolvedValue(undefined),
      setFallbacks: jest.fn().mockResolvedValue([]),
      clearFallbacks: jest.fn().mockResolvedValue(undefined),
      setParamDefaults: jest.fn(),
    };
    mockResolveAgentService = {
      resolve: jest.fn().mockResolvedValue(mockAgent),
    };
    controller = new SpecificityController(
      mockSpecificityService as unknown as SpecificityService,
      mockResolveAgentService as unknown as ResolveAgentService,
    );
  });

  describe('getAssignments', () => {
    it('should resolve agent and return assignments', async () => {
      const assignments = [{ id: 'sa-1', category: 'coding', is_active: true }];
      mockSpecificityService.getAssignments.mockResolvedValue(assignments);

      const result = await controller.getAssignments(ctx, { agentName: 'test-agent' });

      expect(mockResolveAgentService.resolve).toHaveBeenCalledWith('tenant-1', 'test-agent');
      expect(mockSpecificityService.getAssignments).toHaveBeenCalledWith('agent-1');
      expect(result).toBe(assignments);
    });
  });

  describe('setOverride', () => {
    it('should validate category, resolve agent, and set override', async () => {
      const body = { model: 'gpt-4o', provider: 'openai', authType: 'api_key' as const };
      const override = { id: 'sa-1', category: 'coding', override_model: 'gpt-4o' };
      mockSpecificityService.setOverride.mockResolvedValue(override);

      const result = await controller.setOverride(ctx, 'test-agent', 'coding', body);

      expect(mockResolveAgentService.resolve).toHaveBeenCalledWith('tenant-1', 'test-agent');
      expect(mockSpecificityService.setOverride).toHaveBeenCalledWith(
        'agent-1',
        'tenant-1',
        'coding',
        'gpt-4o',
        'openai',
        'api_key',
        undefined,
      );
      expect(result).toBe(override);
    });

    it('should throw BadRequestException for invalid category', async () => {
      const body = { model: 'gpt-4o' };

      await expect(controller.setOverride(ctx, 'test-agent', 'invalid_cat', body)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('toggleCategory', () => {
    it('should validate category, resolve agent, and toggle', async () => {
      const body = { active: true };
      const toggled = { id: 'sa-1', is_active: true };
      mockSpecificityService.toggleCategory.mockResolvedValue(toggled);

      const result = await controller.toggleCategory(ctx, 'test-agent', 'web_browsing', body);

      expect(mockResolveAgentService.resolve).toHaveBeenCalledWith('tenant-1', 'test-agent');
      expect(mockSpecificityService.toggleCategory).toHaveBeenCalledWith(
        'agent-1',
        'web_browsing',
        true,
      );
      expect(result).toBe(toggled);
    });

    it('should throw BadRequestException for invalid category', async () => {
      await expect(
        controller.toggleCategory(ctx, 'test-agent', 'bad', { active: false }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('clearOverride', () => {
    it('should validate category, resolve agent, and clear override', async () => {
      const result = await controller.clearOverride(ctx, 'test-agent', 'data_analysis');

      expect(mockResolveAgentService.resolve).toHaveBeenCalledWith('tenant-1', 'test-agent');
      expect(mockSpecificityService.clearOverride).toHaveBeenCalledWith('agent-1', 'data_analysis');
      expect(result).toEqual({ ok: true });
    });

    it('should throw BadRequestException for invalid category', async () => {
      await expect(controller.clearOverride(ctx, 'test-agent', 'not_a_category')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('resetAll', () => {
    it('should resolve agent and reset all assignments', async () => {
      const result = await controller.resetAll(ctx, { agentName: 'test-agent' });

      expect(mockResolveAgentService.resolve).toHaveBeenCalledWith('tenant-1', 'test-agent');
      expect(mockSpecificityService.resetAll).toHaveBeenCalledWith('agent-1');
      expect(result).toEqual({ ok: true });
    });
  });

  describe('validateCategory', () => {
    it('should accept all valid categories', async () => {
      for (const cat of ['coding', 'web_browsing', 'data_analysis']) {
        mockResolveAgentService.resolve.mockResolvedValue(mockAgent);
        await expect(controller.clearOverride(ctx, 'test-agent', cat)).resolves.toEqual({
          ok: true,
        });
      }
    });

    it('should include valid categories in error message', async () => {
      try {
        await controller.clearOverride(ctx, 'test-agent', 'unknown');
        fail('Should have thrown');
      } catch (e) {
        expect((e as BadRequestException).message).toContain('coding');
        expect((e as BadRequestException).message).toContain('web_browsing');
        expect((e as BadRequestException).message).toContain('data_analysis');
        expect((e as BadRequestException).message).toContain('unknown');
      }
    });
  });

  describe('setFallbacks', () => {
    it('should resolve agent and call service.setFallbacks', async () => {
      mockSpecificityService.setFallbacks.mockResolvedValue(['model-a']);
      const result = await controller.setFallbacks(ctx, 'test-agent', 'coding', {
        models: ['model-a'],
      });
      expect(mockResolveAgentService.resolve).toHaveBeenCalledWith('tenant-1', 'test-agent');
      expect(mockSpecificityService.setFallbacks).toHaveBeenCalledWith(
        'agent-1',
        'tenant-1',
        'coding',
        ['model-a'],
        undefined,
      );
      expect(result).toEqual(['model-a']);
    });

    it('should reject invalid category', async () => {
      await expect(
        controller.setFallbacks(ctx, 'test-agent', 'invalid', { models: ['m'] }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('clearFallbacks', () => {
    it('should resolve agent and call service.clearFallbacks', async () => {
      const result = await controller.clearFallbacks(ctx, 'test-agent', 'coding');
      expect(mockResolveAgentService.resolve).toHaveBeenCalledWith('tenant-1', 'test-agent');
      expect(mockSpecificityService.clearFallbacks).toHaveBeenCalledWith('agent-1', 'coding');
      expect(result).toEqual({ ok: true });
    });

    it('should reject invalid category', async () => {
      await expect(controller.clearFallbacks(ctx, 'test-agent', 'invalid')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
