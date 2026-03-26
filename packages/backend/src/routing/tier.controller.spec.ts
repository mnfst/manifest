import { NotFoundException } from '@nestjs/common';
import { TierController } from './tier.controller';
import { TierService } from './routing-core/tier.service';
import { ResolveAgentService } from './routing-core/resolve-agent.service';
import { Agent } from '../entities/agent.entity';

const mockUser = { id: 'user-1' } as never;
const mockAgentName = { agentName: 'test-agent' } as never;
const TEST_AGENT_ID = 'agent-001';

describe('TierController', () => {
  let controller: TierController;
  let mockTierService: Record<string, jest.Mock>;
  let mockResolveAgent: Record<string, jest.Mock>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockTierService = {
      getTiers: jest.fn().mockResolvedValue([]),
      setOverride: jest.fn().mockResolvedValue({}),
      clearOverride: jest.fn().mockResolvedValue(undefined),
      resetAllOverrides: jest.fn().mockResolvedValue(undefined),
      getFallbacks: jest.fn().mockResolvedValue([]),
      setFallbacks: jest.fn().mockResolvedValue([]),
      clearFallbacks: jest.fn().mockResolvedValue(undefined),
    };
    mockResolveAgent = {
      resolve: jest.fn().mockResolvedValue({ id: TEST_AGENT_ID, name: 'test-agent' } as Agent),
    };

    controller = new TierController(
      mockTierService as unknown as TierService,
      mockResolveAgent as unknown as ResolveAgentService,
    );
  });

  /* ── getTiers ── */

  describe('getTiers', () => {
    it('should delegate to service', async () => {
      const tiers = [{ tier: 'simple', override_model: null, auto_assigned_model: 'gpt-4o' }];
      mockTierService.getTiers.mockResolvedValue(tiers);

      const result = await controller.getTiers(mockUser, mockAgentName);

      expect(mockTierService.getTiers).toHaveBeenCalledWith(TEST_AGENT_ID, 'user-1');
      expect(result).toBe(tiers);
    });
  });

  /* ── setOverride ── */

  describe('setOverride', () => {
    it('should call service with tier and model', async () => {
      const updated = {
        tier: 'complex',
        override_model: 'claude-opus-4-6',
        override_provider: 'openrouter',
      };
      mockTierService.setOverride.mockResolvedValue(updated);

      const result = await controller.setOverride(mockUser, 'test-agent', 'complex', {
        model: 'claude-opus-4-6',
        provider: 'openrouter',
      });

      expect(mockTierService.setOverride).toHaveBeenCalledWith(
        TEST_AGENT_ID,
        'user-1',
        'complex',
        'claude-opus-4-6',
        'openrouter',
        undefined,
      );
      expect(result).toBe(updated);
    });
  });

  /* ── clearOverride ── */

  describe('clearOverride', () => {
    it('should return ok after clearing', async () => {
      const result = await controller.clearOverride(mockUser, 'test-agent', 'simple');

      expect(mockTierService.clearOverride).toHaveBeenCalledWith(TEST_AGENT_ID, 'simple');
      expect(result).toEqual({ ok: true });
    });
  });

  /* ── resetAllOverrides ── */

  describe('resetAllOverrides', () => {
    it('should return ok after resetting', async () => {
      const result = await controller.resetAllOverrides(mockUser, mockAgentName);

      expect(mockTierService.resetAllOverrides).toHaveBeenCalledWith(TEST_AGENT_ID);
      expect(result).toEqual({ ok: true });
    });
  });

  /* ── fallback endpoints ── */

  describe('fallback endpoints', () => {
    it('should delegate getFallbacks to service', async () => {
      mockTierService.getFallbacks.mockResolvedValue(['model-a']);
      const result = await controller.getFallbacks(mockUser, 'test-agent', 'standard');
      expect(mockTierService.getFallbacks).toHaveBeenCalledWith(TEST_AGENT_ID, 'standard');
      expect(result).toEqual(['model-a']);
    });

    it('should delegate setFallbacks to service', async () => {
      mockTierService.setFallbacks.mockResolvedValue(['model-a', 'model-b']);
      const result = await controller.setFallbacks(mockUser, 'test-agent', 'standard', {
        models: ['model-a', 'model-b'],
      });
      expect(mockTierService.setFallbacks).toHaveBeenCalledWith(TEST_AGENT_ID, 'standard', [
        'model-a',
        'model-b',
      ]);
      expect(result).toEqual(['model-a', 'model-b']);
    });

    it('should delegate clearFallbacks to service', async () => {
      const result = await controller.clearFallbacks(mockUser, 'test-agent', 'standard');
      expect(mockTierService.clearFallbacks).toHaveBeenCalledWith(TEST_AGENT_ID, 'standard');
      expect(result).toEqual({ ok: true });
    });
  });

  /* ── resolveAgent ── */

  describe('resolveAgent', () => {
    it('should throw NotFoundException when tenant is not found', async () => {
      mockResolveAgent.resolve.mockRejectedValue(new NotFoundException('Tenant not found'));

      await expect(controller.getTiers(mockUser, mockAgentName)).rejects.toThrow(NotFoundException);
    });
  });
});
