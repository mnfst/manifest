import { HttpException, HttpStatus } from '@nestjs/common';
import { MinimaxOauthController } from './minimax-oauth.controller';
import { MinimaxOauthService } from './minimax-oauth.service';
import { ResolveAgentService } from '../../routing-core/resolve-agent.service';
import { ProviderService } from '../../routing-core/provider.service';

describe('MinimaxOauthController', () => {
  let controller: MinimaxOauthController;
  let oauthService: jest.Mocked<MinimaxOauthService>;
  let resolveAgent: jest.Mocked<ResolveAgentService>;
  let providerService: jest.Mocked<ProviderService>;

  beforeEach(() => {
    oauthService = {
      startAuthorization: jest.fn(),
      pollAuthorization: jest.fn(),
    } as unknown as jest.Mocked<MinimaxOauthService>;

    resolveAgent = {
      resolve: jest.fn(),
    } as unknown as jest.Mocked<ResolveAgentService>;

    providerService = {
      removeProvider: jest.fn().mockResolvedValue({ notifications: [] }),
    } as unknown as jest.Mocked<ProviderService>;

    controller = new MinimaxOauthController(oauthService, resolveAgent, providerService);
  });

  it('starts MiniMax OAuth for the resolved agent', async () => {
    resolveAgent.resolve.mockResolvedValue({ id: 'agent-id-1', tenant_id: 'tenant-1' } as never);
    oauthService.startAuthorization.mockResolvedValue({
      flowId: 'flow-1',
      userCode: 'ABCD-1234',
      verificationUri: 'https://www.minimax.io/verify',
      expiresAt: Date.now() + 60_000,
      pollIntervalMs: 2000,
    });

    const result = await controller.start('my-agent', 'cn', {
      tenantId: 'tenant-1',
      userId: 'user-1',
    } as never);

    expect(resolveAgent.resolve).toHaveBeenCalledWith('tenant-1', 'my-agent');
    expect(oauthService.startAuthorization).toHaveBeenCalledWith(
      'agent-id-1',
      'tenant-1',
      'cn',
      'user-1',
    );
    expect(result.flowId).toBe('flow-1');
  });

  it('throws 400 when agentName is missing', async () => {
    await expect(
      controller.start('', 'global', { tenantId: 'tenant-1', userId: 'user-1' } as never),
    ).rejects.toThrow(HttpException);
  });

  it('throws 400 when region is invalid', async () => {
    await expect(
      controller.start('my-agent', 'mars', { tenantId: 'tenant-1', userId: 'user-1' } as never),
    ).rejects.toThrow(HttpException);
  });

  it('polls MiniMax OAuth state', async () => {
    oauthService.pollAuthorization.mockResolvedValue({ status: 'pending' });

    const result = await controller.poll('flow-1', {
      tenantId: 'tenant-1',
      userId: 'user-1',
    } as never);

    expect(oauthService.pollAuthorization).toHaveBeenCalledWith('flow-1', 'tenant-1');
    expect(result).toEqual({ status: 'pending' });
  });

  it('throws 400 when flowId is missing', async () => {
    await expect(
      controller.poll('', { tenantId: 'tenant-1', userId: 'user-1' } as never),
    ).rejects.toThrow(HttpException);
  });

  it('maps startAuthorization failures to 503', async () => {
    resolveAgent.resolve.mockResolvedValue({ id: 'agent-id-1', tenant_id: 'tenant-1' } as never);
    oauthService.startAuthorization.mockRejectedValue(new Error('MiniMax unavailable'));

    await expect(
      controller.start('my-agent', 'global', { tenantId: 'tenant-1', userId: 'user-1' } as never),
    ).rejects.toMatchObject({
      message: 'MiniMax unavailable',
      status: HttpStatus.SERVICE_UNAVAILABLE,
    });
  });

  it('maps pollAuthorization failures to 503', async () => {
    oauthService.pollAuthorization.mockRejectedValue(new Error('MiniMax poll unavailable'));

    await expect(
      controller.poll('flow-1', { tenantId: 'tenant-1', userId: 'user-1' } as never),
    ).rejects.toMatchObject({
      message: 'MiniMax poll unavailable',
      status: HttpStatus.SERVICE_UNAVAILABLE,
    });
  });

  it('throws 400 when revoke agentName is missing', async () => {
    await expect(
      controller.revoke('', undefined, { tenantId: 'tenant-1', userId: 'user-1' } as never),
    ).rejects.toThrow(HttpException);
  });

  it('removes all MiniMax subscription records for the resolved agent', async () => {
    resolveAgent.resolve.mockResolvedValue({ id: 'agent-id-1', tenant_id: 'tenant-1' } as never);

    const result = await controller.revoke('my-agent', undefined, {
      tenantId: 'tenant-1',
      userId: 'user-1',
    } as never);

    expect(resolveAgent.resolve).toHaveBeenCalledWith('tenant-1', 'my-agent');
    expect(providerService.removeProvider).toHaveBeenCalledWith(
      'agent-id-1',
      'tenant-1',
      'minimax',
      'subscription',
      undefined,
    );
    expect(result).toEqual({ ok: true, notifications: [] });
  });

  it('removes only the labeled MiniMax subscription record', async () => {
    resolveAgent.resolve.mockResolvedValue({ id: 'agent-id-1', tenant_id: 'tenant-1' } as never);

    const result = await controller.revoke('my-agent', 'Key 2', {
      tenantId: 'tenant-1',
      userId: 'user-1',
    } as never);

    expect(providerService.removeProvider).toHaveBeenCalledWith(
      'agent-id-1',
      'tenant-1',
      'minimax',
      'subscription',
      'Key 2',
    );
    expect(result).toEqual({ ok: true, notifications: [] });
  });

  it('rejects repeated revoke label query parameters', async () => {
    await expect(
      controller.revoke('my-agent', ['Key 1', 'Key 2'], {
        tenantId: 'tenant-1',
        userId: 'user-1',
      } as never),
    ).rejects.toMatchObject({
      message: 'label query parameter must be a string',
      status: HttpStatus.BAD_REQUEST,
    });
    expect(resolveAgent.resolve).not.toHaveBeenCalled();
    expect(providerService.removeProvider).not.toHaveBeenCalled();
  });
});
