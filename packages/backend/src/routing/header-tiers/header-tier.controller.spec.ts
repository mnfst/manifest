import { HeaderTierController } from './header-tier.controller';
import type { HeaderTierService } from './header-tier.service';
import type { ResolveAgentService } from '../routing-core/resolve-agent.service';
import type { TenantCacheService } from '../../common/services/tenant-cache.service';
import type { AuthUser } from '../../auth/auth.instance';

function makeController(overrides?: { tenantId?: string | null }) {
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

  const resolveAgentService = {
    resolve: jest.fn().mockResolvedValue({ id: 'agent-1' }),
  } as unknown as jest.Mocked<ResolveAgentService>;

  const tenantId = overrides && 'tenantId' in overrides ? overrides.tenantId : 'tenant-1';
  const tenantCache = {
    resolve: jest.fn().mockResolvedValue(tenantId),
  } as unknown as jest.Mocked<TenantCacheService>;

  const controller = new HeaderTierController(service, resolveAgentService, tenantCache);
  return { controller, service, resolveAgentService, tenantCache };
}

const user = { id: 'user-1' } as AuthUser;

describe('HeaderTierController', () => {
  it('list resolves the agent then delegates to the service', async () => {
    const { controller, service, resolveAgentService } = makeController();
    const out = await controller.list(user, 'my-agent');
    expect(resolveAgentService.resolve).toHaveBeenCalledWith('user-1', 'my-agent');
    expect(service.list).toHaveBeenCalledWith('agent-1');
    expect(out).toEqual(['tiers']);
  });

  it('create forwards the resolved tenantId (or null) and body', async () => {
    const { controller, service } = makeController({ tenantId: 't1' });
    const body = {
      name: 'Premium',
      header_key: 'x',
      header_value: 'y',
      badge_color: 'indigo' as const,
    };
    const out = await controller.create(user, 'my-agent', body);
    expect(service.create).toHaveBeenCalledWith('agent-1', 'user-1', 't1', body);
    expect(out).toEqual({ id: 'ht-1' });
  });

  it('create defaults tenantId to null when the cache has no resolution', async () => {
    const { controller, service } = makeController({ tenantId: null });
    await controller.create(user, 'my-agent', {
      name: 'X',
      header_key: 'x',
      header_value: 'y',
      badge_color: 'indigo',
    });
    expect(service.create).toHaveBeenCalledWith('agent-1', 'user-1', null, expect.any(Object));
  });

  it('update calls service.update with the patch', async () => {
    const { controller, service } = makeController();
    await controller.update(user, 'my-agent', 'ht-1', { name: 'Updated' });
    expect(service.update).toHaveBeenCalledWith('agent-1', 'ht-1', { name: 'Updated' });
  });

  it('delete returns ok and calls service.delete', async () => {
    const { controller, service } = makeController();
    const out = await controller.delete(user, 'my-agent', 'ht-1');
    expect(service.delete).toHaveBeenCalledWith('agent-1', 'ht-1');
    expect(out).toEqual({ ok: true });
  });

  it('reorder returns ok and forwards the id list', async () => {
    const { controller, service } = makeController();
    const out = await controller.reorder(user, 'my-agent', { ids: ['a', 'b'] });
    expect(service.reorder).toHaveBeenCalledWith('agent-1', ['a', 'b']);
    expect(out).toEqual({ ok: true });
  });

  it('reorder rejects a missing body', async () => {
    const { controller, service } = makeController();
    await expect(controller.reorder(user, 'my-agent', undefined as never)).rejects.toThrow(
      /ids must be an array/,
    );
    expect(service.reorder).not.toHaveBeenCalled();
  });

  it('reorder rejects a non-array ids property', async () => {
    const { controller, service } = makeController();
    await expect(
      controller.reorder(user, 'my-agent', { ids: 'abc' as unknown as string[] }),
    ).rejects.toThrow(/ids must be an array/);
    expect(service.reorder).not.toHaveBeenCalled();
  });

  it('setOverride forwards model/provider/authType', async () => {
    const { controller, service } = makeController();
    await controller.setOverride(user, 'my-agent', 'ht-1', {
      model: 'gpt-4o',
      provider: 'OpenAI',
      authType: 'api_key',
    });
    expect(service.setOverride).toHaveBeenCalledWith(
      'agent-1',
      'ht-1',
      'gpt-4o',
      'OpenAI',
      'api_key',
    );
  });

  it('clearOverride returns ok', async () => {
    const { controller, service } = makeController();
    const out = await controller.clearOverride(user, 'my-agent', 'ht-1');
    expect(service.clearOverride).toHaveBeenCalledWith('agent-1', 'ht-1');
    expect(out).toEqual({ ok: true });
  });

  it('setFallbacks forwards models', async () => {
    const { controller, service } = makeController();
    const out = await controller.setFallbacks(user, 'my-agent', 'ht-1', { models: ['a'] });
    expect(service.setFallbacks).toHaveBeenCalledWith('agent-1', 'ht-1', ['a']);
    expect(out).toEqual(['m']);
  });

  it('clearFallbacks returns ok', async () => {
    const { controller, service } = makeController();
    const out = await controller.clearFallbacks(user, 'my-agent', 'ht-1');
    expect(service.clearFallbacks).toHaveBeenCalledWith('agent-1', 'ht-1');
    expect(out).toEqual({ ok: true });
  });
});
