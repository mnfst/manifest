import { HttpException, HttpStatus } from '@nestjs/common';
import { KiroOauthController } from './oauth/kiro-oauth.controller';
import { KiroOauthService } from './oauth/kiro-oauth.service';
import { ResolveAgentService } from './routing-core/resolve-agent.service';

describe('KiroOauthController', () => {
  let controller: KiroOauthController;
  let oauthService: jest.Mocked<KiroOauthService>;
  let resolveAgent: jest.Mocked<ResolveAgentService>;

  beforeEach(() => {
    oauthService = {
      connectFromCli: jest.fn(),
    } as unknown as jest.Mocked<KiroOauthService>;

    resolveAgent = {
      resolve: jest.fn(),
    } as unknown as jest.Mocked<ResolveAgentService>;

    controller = new KiroOauthController(oauthService, resolveAgent);
  });

  it('connects Kiro from the resolved agent CLI session', async () => {
    resolveAgent.resolve.mockResolvedValue({ id: 'agent-id-1' } as never);
    oauthService.connectFromCli.mockResolvedValue({
      ok: true,
      expiresAt: '2026-05-26T08:33:56.000Z',
      authMethod: 'social',
      provider: 'github',
    });

    const result = await controller.connectFromCli('my-agent', { id: 'user-1' } as never);

    expect(resolveAgent.resolve).toHaveBeenCalledWith('user-1', 'my-agent');
    expect(oauthService.connectFromCli).toHaveBeenCalledWith('agent-id-1', 'user-1');
    expect(result.ok).toBe(true);
  });

  it('throws 400 when agentName is missing', async () => {
    await expect(controller.connectFromCli('', { id: 'user-1' } as never)).rejects.toThrow(
      HttpException,
    );
  });

  it('maps CLI connection failures to 503', async () => {
    resolveAgent.resolve.mockResolvedValue({ id: 'agent-id-1' } as never);
    oauthService.connectFromCli.mockRejectedValue(new Error('Kiro CLI is not logged in'));

    await expect(
      controller.connectFromCli('my-agent', { id: 'user-1' } as never),
    ).rejects.toMatchObject({
      message: 'Kiro CLI is not logged in',
      status: HttpStatus.SERVICE_UNAVAILABLE,
    });
  });
});
