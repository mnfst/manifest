import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { TierController } from './tier.controller';
import { TierService } from './routing-core/tier.service';
import { ResolveAgentService } from './routing-core/resolve-agent.service';
import { Agent } from '../entities/agent.entity';
import { AutofixService } from './autofix/autofix.service';
import type { TenantContext } from '../common/decorators/tenant-context.decorator';

describe('TierController', () => {
  const ctx: TenantContext = { tenantId: 'tenant-1', userId: 'user-1' };
  const agent = {
    id: 'agent-1',
    name: 'demo',
    tenant_id: 'tenant-1',
    complexity_routing_enabled: true,
    autofix_enabled: false,
    autofix_max_attempts: 3,
  };
  let tierService: jest.Mocked<Partial<TierService>>;
  let resolveAgentService: { resolve: jest.Mock; invalidate: jest.Mock };
  let agentRepo: jest.Mocked<Partial<Repository<Agent>>>;
  let autofixService: { invalidateConfig: jest.Mock };
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
    resolveAgentService = {
      resolve: jest.fn().mockResolvedValue(agent),
      invalidate: jest.fn(),
    };
    agentRepo = {
      update: jest.fn().mockResolvedValue(undefined),
    };
    autofixService = { invalidateConfig: jest.fn() };
    controller = new TierController(
      tierService as unknown as TierService,
      resolveAgentService as unknown as ResolveAgentService,
      agentRepo as unknown as Repository<Agent>,
      autofixService as unknown as AutofixService,
    );
  });

  it('GET /tiers returns tier rows for the agent', async () => {
    (tierService.getTiers as jest.Mock).mockResolvedValue([{ tier: 'simple' }]);
    const rows = await controller.getTiers(ctx, { agentName: 'demo' });
    expect(rows).toEqual([{ tier: 'simple' }]);
    expect(tierService.getTiers).toHaveBeenCalledWith('agent-1', 'tenant-1');
  });

  it('PUT /tiers/:tier accepts the default slot', async () => {
    (tierService.setOverride as jest.Mock).mockResolvedValue({
      tier: 'default',
      override_model: 'm',
    });
    const out = await controller.setOverride(ctx, 'demo', 'default', { model: 'm' });
    expect(out).toEqual({ tier: 'default', override_model: 'm' });
    expect(tierService.setOverride).toHaveBeenCalledWith(
      'agent-1',
      'tenant-1',
      'default',
      'm',
      undefined,
      undefined,
      undefined,
    );
  });

  it('PUT /tiers/:tier rejects unknown slots', async () => {
    await expect(
      controller.setOverride(ctx, 'demo', 'nonsense', { model: 'm' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tierService.setOverride).not.toHaveBeenCalled();
  });

  it('DELETE /tiers/:tier clears the override for valid slots', async () => {
    const out = await controller.clearOverride(ctx, 'demo', 'default');
    expect(out).toEqual({ ok: true });
    expect(tierService.clearOverride).toHaveBeenCalledWith('agent-1', 'default');
  });

  it('DELETE /tiers/:tier rejects unknown slots', async () => {
    await expect(controller.clearOverride(ctx, 'demo', 'bogus')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('POST /tiers/reset-all clears every override', async () => {
    const out = await controller.resetAllOverrides(ctx, { agentName: 'demo' });
    expect(out).toEqual({ ok: true });
    expect(tierService.resetAllOverrides).toHaveBeenCalledWith('agent-1');
  });

  it('GET/PUT/DELETE /tiers/:tier/fallbacks validate the slot', async () => {
    (tierService.getFallbacks as jest.Mock).mockResolvedValue(['m1']);
    expect(await controller.getFallbacks(ctx, 'demo', 'default')).toEqual(['m1']);

    (tierService.setFallbacks as jest.Mock).mockResolvedValue(['m1', 'm2']);
    expect(await controller.setFallbacks(ctx, 'demo', 'default', { models: ['m1', 'm2'] })).toEqual(
      ['m1', 'm2'],
    );

    expect(await controller.clearFallbacks(ctx, 'demo', 'default')).toEqual({ ok: true });

    await expect(controller.getFallbacks(ctx, 'demo', 'bogus')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      controller.setFallbacks(ctx, 'demo', 'bogus', { models: ['m'] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.clearFallbacks(ctx, 'demo', 'bogus')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('GET complexity/status returns the current flag', async () => {
    const result = await controller.getComplexityStatus(ctx, 'demo');
    expect(result).toEqual({ enabled: true });
  });

  it('POST complexity/toggle flips the flag and invalidates cache', async () => {
    const result = await controller.toggleComplexity(ctx, 'demo');
    expect(result).toEqual({ enabled: false });
    expect(agentRepo.update).toHaveBeenCalledWith('agent-1', {
      complexity_routing_enabled: false,
    });
    expect(resolveAgentService.invalidate).toHaveBeenCalledWith('tenant-1', 'demo');
  });

  it('GET autofix returns the enabled flag and budget', async () => {
    expect(await controller.getAutofix(ctx, 'demo')).toEqual({ enabled: false, maxAttempts: 3 });
  });

  it('PATCH autofix updates both fields and invalidates cache', async () => {
    const out = await controller.updateAutofix(ctx, 'demo', { enabled: true, maxAttempts: 5 });
    expect(out).toEqual({ enabled: true, maxAttempts: 5 });
    expect(agentRepo.update).toHaveBeenCalledWith('agent-1', {
      autofix_enabled: true,
      autofix_max_attempts: 5,
    });
    expect(resolveAgentService.invalidate).toHaveBeenCalledWith('tenant-1', 'demo');
    expect(autofixService.invalidateConfig).toHaveBeenCalledWith('tenant-1', 'agent-1');
  });

  it('PATCH autofix updates only the provided field', async () => {
    const out = await controller.updateAutofix(ctx, 'demo', { enabled: true });
    expect(out).toEqual({ enabled: true, maxAttempts: 3 });
    expect(agentRepo.update).toHaveBeenCalledWith('agent-1', { autofix_enabled: true });
  });

  it('PATCH autofix with an empty body is a no-op and echoes current values', async () => {
    const out = await controller.updateAutofix(ctx, 'demo', {});
    expect(out).toEqual({ enabled: false, maxAttempts: 3 });
    expect(agentRepo.update).not.toHaveBeenCalled();
    expect(resolveAgentService.invalidate).not.toHaveBeenCalled();
  });

  it('PATCH response-mode sets the mode for a valid tier', async () => {
    tierService.setResponseMode = jest
      .fn()
      .mockResolvedValue({ tier: 'standard', response_mode: 'buffered' });
    const out = await controller.setResponseMode(ctx, 'demo', 'standard', {
      response_mode: 'buffered',
    });
    expect(out).toEqual({ tier: 'standard', response_mode: 'buffered' });
    expect(tierService.setResponseMode).toHaveBeenCalledWith('agent-1', 'standard', 'buffered');
  });

  it('PATCH response-mode rejects a missing response_mode', async () => {
    await expect(controller.setResponseMode(ctx, 'demo', 'standard', {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  // P1-A: tier write endpoint must 404 for the reserved "Playground" agent
  it('PUT /tiers/:tier throws NotFoundException when resolve rejects the Playground agent', async () => {
    resolveAgentService.resolve.mockRejectedValueOnce(
      new NotFoundException('Agent "Playground" not found'),
    );
    await expect(
      controller.setOverride(ctx, 'Playground', 'default', { model: 'm' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(tierService.setOverride).not.toHaveBeenCalled();
  });
});
