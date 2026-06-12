import { HeaderTierController } from './header-tier.controller';
import type { HeaderTierService } from './header-tier.service';
import type { ResolveAgentService } from '../routing-core/resolve-agent.service';
import type { TenantContext } from '../../common/decorators/tenant-context.decorator';

function makeController(overrides?: { tenant_id?: string }) {
  const service = {
    list: jest.fn().mockResolvedValue(['tiers']),
    create: jest.fn().mockResolvedValue({ id: 'ht-1' }),
    update: jest.fn().mockResolvedValue({ id: 'ht-1', name: 'Updated' }),
    delete: jest.fn().mockResolvedValue(undefined),
    reorder: jest.fn().mockResolvedValue(undefined),
    setOverride: jest.fn().mockResolvedValue({ id: 'ht-1' }),
    clearOverride: jest.fn().mockResolvedValue(undefined),
    setFallbacks: jest.fn().mockResolvedValue(['m']),
    clearFallbacks: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<HeaderTierService>;

  const tenant_id = overrides && 'tenant_id' in overrides ? overrides.tenant_id : 'tenant-1';
  const resolveAgentService = {
    resolve: jest.fn().mockResolvedValue({ id: 'agent-1', tenant_id }),
  } as unknown as jest.Mocked<ResolveAgentService>;

  const controller = new HeaderTierController(service, resolveAgentService);
  return { controller, service, resolveAgentService };
}

const ctx: TenantContext = { tenantId: 'tenant-1', userId: 'user-1' };

describe('HeaderTierController', () => {
  it('list resolves the agent then delegates to the service', async () => {
    const { controller, service, resolveAgentService } = makeController();
    const out = await controller.list(ctx, 'my-agent');
    expect(resolveAgentService.resolve).toHaveBeenCalledWith('tenant-1', 'my-agent');
    expect(service.list).toHaveBeenCalledWith('agent-1');
    expect(out).toEqual(['tiers']);
  });

  it('create forwards the resolved tenant_id and body', async () => {
    const { controller, service } = makeController({ tenant_id: 't1' });
    const body = {
      name: 'Premium',
      header_key: 'x',
      header_value: 'y',
      badge_color: 'indigo' as const,
    };
    const out = await controller.create(ctx, 'my-agent', body);
    expect(service.create).toHaveBeenCalledWith('agent-1', 't1', body);
    expect(out).toEqual({ id: 'ht-1' });
  });

  it('update calls service.update with the patch', async () => {
    const { controller, service } = makeController();
    await controller.update(ctx, 'my-agent', 'ht-1', { name: 'Updated' });
    expect(service.update).toHaveBeenCalledWith('agent-1', 'ht-1', { name: 'Updated' });
  });

  it('delete returns ok and calls service.delete', async () => {
    const { controller, service } = makeController();
    const out = await controller.delete(ctx, 'my-agent', 'ht-1');
    expect(service.delete).toHaveBeenCalledWith('agent-1', 'ht-1');
    expect(out).toEqual({ ok: true });
  });

  it('reorder returns ok and forwards the id list', async () => {
    const { controller, service } = makeController();
    const out = await controller.reorder(ctx, 'my-agent', { ids: ['a', 'b'] });
    expect(service.reorder).toHaveBeenCalledWith('agent-1', ['a', 'b']);
    expect(out).toEqual({ ok: true });
  });

  it('reorder rejects a missing body', async () => {
    const { controller, service } = makeController();
    await expect(controller.reorder(ctx, 'my-agent', undefined as never)).rejects.toThrow(
      /ids must be an array/,
    );
    expect(service.reorder).not.toHaveBeenCalled();
  });

  it('reorder rejects a non-array ids property', async () => {
    const { controller, service } = makeController();
    await expect(
      controller.reorder(ctx, 'my-agent', { ids: 'abc' as unknown as string[] }),
    ).rejects.toThrow(/ids must be an array/);
    expect(service.reorder).not.toHaveBeenCalled();
  });

  it('setOverride forwards model/provider/authType', async () => {
    const { controller, service } = makeController();
    await controller.setOverride(ctx, 'my-agent', 'ht-1', {
      model: 'gpt-4o',
      provider: 'OpenAI',
      authType: 'api_key',
    });
    expect(service.setOverride).toHaveBeenCalledWith(
      'agent-1',
      'tenant-1',
      'ht-1',
      'gpt-4o',
      'OpenAI',
      'api_key',
      undefined,
    );
  });

  it('setOverride forwards route keyLabel when present', async () => {
    const { controller, service } = makeController();
    await controller.setOverride(ctx, 'my-agent', 'ht-1', {
      model: 'gpt-4o',
      provider: 'OpenAI',
      authType: 'api_key',
      route: {
        model: 'gpt-4o',
        provider: 'openai',
        authType: 'api_key',
        keyLabel: 'Personal',
      },
    });
    expect(service.setOverride).toHaveBeenCalledWith(
      'agent-1',
      'tenant-1',
      'ht-1',
      'gpt-4o',
      'openai',
      'api_key',
      'Personal',
    );
  });

  it('clearOverride returns ok', async () => {
    const { controller, service } = makeController();
    const out = await controller.clearOverride(ctx, 'my-agent', 'ht-1');
    expect(service.clearOverride).toHaveBeenCalledWith('agent-1', 'ht-1');
    expect(out).toEqual({ ok: true });
  });

  it('setFallbacks forwards models', async () => {
    const { controller, service } = makeController();
    const out = await controller.setFallbacks(ctx, 'my-agent', 'ht-1', { models: ['a'] });
    expect(service.setFallbacks).toHaveBeenCalledWith(
      'agent-1',
      'tenant-1',
      'ht-1',
      ['a'],
      undefined,
    );
    expect(out).toEqual(['m']);
  });

  it('clearFallbacks returns ok', async () => {
    const { controller, service } = makeController();
    const out = await controller.clearFallbacks(ctx, 'my-agent', 'ht-1');
    expect(service.clearFallbacks).toHaveBeenCalledWith('agent-1', 'ht-1');
    expect(out).toEqual({ ok: true });
  });
});
