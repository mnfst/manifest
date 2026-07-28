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
  };
  let tierService: jest.Mocked<Partial<TierService>>;
  let resolveAgentService: { resolve: jest.Mock; invalidate: jest.Mock };
  let agentRepo: jest.Mocked<Partial<Repository<Agent>>>;
  let autofixService: {
    invalidateConfig: jest.Mock;
    resolveEnabled: jest.Mock;
    hasAccess: jest.Mock;
  };
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
    autofixService = {
      invalidateConfig: jest.fn(),
      // Mirror the real resolver: explicit flag wins, NULL inherits a default.
      resolveEnabled: jest.fn((stored: boolean | null) => stored ?? false),
      // Default: tenant has early access, so the toggle is available.
      hasAccess: jest.fn().mockResolvedValue(true),
    };
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

  it('GET autofix returns the enabled flag and availability', async () => {
    expect(await controller.getAutofix(ctx, 'demo')).toEqual({ enabled: false, available: true });
  });

  it('GET autofix resolves the mode default via the service when the flag is unset (null)', async () => {
    // A NULL stored flag is handed to the service, which resolves the
    // deployment-mode default (here stubbed to ON).
    resolveAgentService.resolve.mockResolvedValueOnce({ ...agent, autofix_enabled: null });
    autofixService.resolveEnabled.mockReturnValueOnce(true);
    expect(await controller.getAutofix(ctx, 'demo')).toEqual({ enabled: true, available: true });
    expect(autofixService.resolveEnabled).toHaveBeenCalledWith(null);
  });

  it('GET autofix reports available=false for a tenant without early access', async () => {
    resolveAgentService.resolve.mockResolvedValueOnce({ ...agent, autofix_enabled: null });
    autofixService.resolveEnabled.mockReturnValueOnce(true);
    autofixService.hasAccess.mockResolvedValueOnce(false);
    expect(await controller.getAutofix(ctx, 'demo')).toEqual({ enabled: false, available: false });
    expect(autofixService.resolveEnabled).not.toHaveBeenCalled();
  });

  it('PATCH autofix updates the enabled flag and invalidates cache', async () => {
    const out = await controller.updateAutofix(ctx, 'demo', { enabled: true });
    expect(out).toEqual({ enabled: true, available: true });
    expect(agentRepo.update).toHaveBeenCalledWith('agent-1', { autofix_enabled: true });
    expect(resolveAgentService.invalidate).toHaveBeenCalledWith('tenant-1', 'demo');
    expect(autofixService.invalidateConfig).toHaveBeenCalledWith('tenant-1', 'agent-1');
  });

  it('PATCH autofix with an empty body is a no-op and echoes the current value', async () => {
    const out = await controller.updateAutofix(ctx, 'demo', {});
    expect(out).toEqual({ enabled: false, available: true });
    expect(agentRepo.update).not.toHaveBeenCalled();
    expect(resolveAgentService.invalidate).not.toHaveBeenCalled();
  });

  it('PATCH autofix treats a null enabled as a no-op (never resets the flag to null)', async () => {
    // @IsOptional() lets `{"enabled": null}` past validation; the controller must
    // not write null (which would wipe the stored flag) nor echo `enabled: null`.
    const out = await controller.updateAutofix(ctx, 'demo', {
      enabled: null as unknown as boolean,
    });
    expect(out).toEqual({ enabled: false, available: true });
    expect(agentRepo.update).not.toHaveBeenCalled();
    expect(resolveAgentService.invalidate).not.toHaveBeenCalled();
  });

  it('PATCH autofix does not write when the tenant lacks early access', async () => {
    resolveAgentService.resolve.mockResolvedValueOnce({ ...agent, autofix_enabled: null });
    autofixService.resolveEnabled.mockReturnValueOnce(true);
    autofixService.hasAccess.mockResolvedValueOnce(false);
    const out = await controller.updateAutofix(ctx, 'demo', { enabled: true });
    expect(out).toEqual({ enabled: false, available: false });
    expect(agentRepo.update).not.toHaveBeenCalled();
    expect(autofixService.invalidateConfig).not.toHaveBeenCalled();
    expect(autofixService.resolveEnabled).not.toHaveBeenCalled();
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
