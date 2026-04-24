import { BadRequestException } from '@nestjs/common';
import { TierController } from './tier.controller';
import { TierService } from './routing-core/tier.service';
import { ResolveAgentService } from './routing-core/resolve-agent.service';
import type { AuthUser } from '../auth/auth.instance';

describe('TierController', () => {
  const user = { id: 'user-1' } as AuthUser;
  const agent = { id: 'agent-1', name: 'demo' };
  let tierService: jest.Mocked<Partial<TierService>>;
  let resolveAgentService: { resolve: jest.Mock };
  let controller: TierController;

  beforeEach(() => {
    tierService = {
      getTiers: jest.fn().mockResolvedValue([]),
      setOverride: jest.fn(),
      clearOverride: jest.fn().mockResolvedValue(undefined),
      resetAllOverrides: jest.fn().mockResolvedValue(undefined),
      getFallbacks: jest.fn().mockResolvedValue([]),
      setFallbacks: jest.fn().mockResolvedValue([]),
      clearFallbacks: jest.fn().mockResolvedValue(undefined),
    };
    resolveAgentService = { resolve: jest.fn().mockResolvedValue(agent) };
    controller = new TierController(
      tierService as unknown as TierService,
      resolveAgentService as unknown as ResolveAgentService,
    );
  });

  it('GET /tiers returns tier rows for the agent', async () => {
    (tierService.getTiers as jest.Mock).mockResolvedValue([{ tier: 'simple' }]);
    const rows = await controller.getTiers(user, { agentName: 'demo' });
    expect(rows).toEqual([{ tier: 'simple' }]);
    expect(tierService.getTiers).toHaveBeenCalledWith('agent-1', 'user-1');
  });

  it('PUT /tiers/:tier accepts the default slot', async () => {
    (tierService.setOverride as jest.Mock).mockResolvedValue({
      tier: 'default',
      override_model: 'm',
    });
    const out = await controller.setOverride(user, 'demo', 'default', { model: 'm' });
    expect(out).toEqual({ tier: 'default', override_model: 'm' });
    expect(tierService.setOverride).toHaveBeenCalledWith(
      'agent-1',
      'user-1',
      'default',
      'm',
      undefined,
      undefined,
    );
  });

  it('PUT /tiers/:tier rejects unknown slots', async () => {
    await expect(
      controller.setOverride(user, 'demo', 'nonsense', { model: 'm' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tierService.setOverride).not.toHaveBeenCalled();
  });

  it('DELETE /tiers/:tier clears the override for valid slots', async () => {
    const out = await controller.clearOverride(user, 'demo', 'default');
    expect(out).toEqual({ ok: true });
    expect(tierService.clearOverride).toHaveBeenCalledWith('agent-1', 'default');
  });

  it('DELETE /tiers/:tier rejects unknown slots', async () => {
    await expect(controller.clearOverride(user, 'demo', 'bogus')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('POST /tiers/reset-all clears every override', async () => {
    const out = await controller.resetAllOverrides(user, { agentName: 'demo' });
    expect(out).toEqual({ ok: true });
    expect(tierService.resetAllOverrides).toHaveBeenCalledWith('agent-1');
  });

  it('GET/PUT/DELETE /tiers/:tier/fallbacks validate the slot', async () => {
    (tierService.getFallbacks as jest.Mock).mockResolvedValue(['m1']);
    expect(await controller.getFallbacks(user, 'demo', 'default')).toEqual(['m1']);

    (tierService.setFallbacks as jest.Mock).mockResolvedValue(['m1', 'm2']);
    expect(
      await controller.setFallbacks(user, 'demo', 'default', { models: ['m1', 'm2'] }),
    ).toEqual(['m1', 'm2']);

    expect(await controller.clearFallbacks(user, 'demo', 'default')).toEqual({ ok: true });

    await expect(controller.getFallbacks(user, 'demo', 'bogus')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      controller.setFallbacks(user, 'demo', 'bogus', { models: ['m'] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.clearFallbacks(user, 'demo', 'bogus')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
