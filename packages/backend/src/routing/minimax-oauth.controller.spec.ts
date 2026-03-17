import { HttpException, HttpStatus } from '@nestjs/common';
import { MinimaxOauthController } from './minimax-oauth.controller';
import { MinimaxOauthService } from './minimax-oauth.service';
import { ResolveAgentService } from './resolve-agent.service';

describe('MinimaxOauthController', () => {
  let controller: MinimaxOauthController;
  let oauthService: jest.Mocked<MinimaxOauthService>;
  let resolveAgent: jest.Mocked<ResolveAgentService>;

  beforeEach(() => {
    oauthService = {
      startAuthorization: jest.fn(),
      pollAuthorization: jest.fn(),
    } as unknown as jest.Mocked<MinimaxOauthService>;

    resolveAgent = {
      resolve: jest.fn(),
    } as unknown as jest.Mocked<ResolveAgentService>;

    controller = new MinimaxOauthController(oauthService, resolveAgent);
  });

  it('starts MiniMax OAuth for the resolved agent', async () => {
    resolveAgent.resolve.mockResolvedValue({ id: 'agent-id-1' } as never);
    oauthService.startAuthorization.mockResolvedValue({
      flowId: 'flow-1',
      userCode: 'ABCD-1234',
      verificationUri: 'https://www.minimax.io/verify',
      expiresAt: Date.now() + 60_000,
      pollIntervalMs: 2000,
    });

    const result = await controller.start('my-agent', 'cn', { id: 'user-1' } as never);

    expect(resolveAgent.resolve).toHaveBeenCalledWith('user-1', 'my-agent');
    expect(oauthService.startAuthorization).toHaveBeenCalledWith('agent-id-1', 'user-1', 'cn');
    expect(result.flowId).toBe('flow-1');
  });

  it('throws 400 when agentName is missing', async () => {
    await expect(controller.start('', 'global', { id: 'user-1' } as never)).rejects.toThrow(
      HttpException,
    );
  });

  it('throws 400 when region is invalid', async () => {
    await expect(controller.start('my-agent', 'mars', { id: 'user-1' } as never)).rejects.toThrow(
      HttpException,
    );
  });

  it('polls MiniMax OAuth state', async () => {
    oauthService.pollAuthorization.mockResolvedValue({ status: 'pending' });

    const result = await controller.poll('flow-1', { id: 'user-1' } as never);

    expect(oauthService.pollAuthorization).toHaveBeenCalledWith('flow-1', 'user-1');
    expect(result).toEqual({ status: 'pending' });
  });

  it('throws 400 when flowId is missing', async () => {
    await expect(controller.poll('', { id: 'user-1' } as never)).rejects.toThrow(HttpException);
  });

  it('maps startAuthorization failures to 503', async () => {
    resolveAgent.resolve.mockResolvedValue({ id: 'agent-id-1' } as never);
    oauthService.startAuthorization.mockRejectedValue(new Error('MiniMax unavailable'));

    await expect(
      controller.start('my-agent', 'global', { id: 'user-1' } as never),
    ).rejects.toMatchObject({
      message: 'MiniMax unavailable',
      status: HttpStatus.SERVICE_UNAVAILABLE,
    });
  });

  it('maps pollAuthorization failures to 503', async () => {
    oauthService.pollAuthorization.mockRejectedValue(new Error('MiniMax poll unavailable'));

    await expect(controller.poll('flow-1', { id: 'user-1' } as never)).rejects.toMatchObject({
      message: 'MiniMax poll unavailable',
      status: HttpStatus.SERVICE_UNAVAILABLE,
    });
  });
});
