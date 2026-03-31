import { HttpException } from '@nestjs/common';
import { OpenaiOauthController } from './oauth/openai-oauth.controller';
import { OpenaiOauthService } from './oauth/openai-oauth.service';
import { ResolveAgentService } from './routing-core/resolve-agent.service';
import { ProviderKeyService } from './routing-core/provider-key.service';
import { ProviderService } from './routing-core/provider.service';
import { Request, Response } from 'express';

describe('OpenaiOauthController', () => {
  let controller: OpenaiOauthController;
  let oauthService: jest.Mocked<OpenaiOauthService>;
  let resolveAgent: jest.Mocked<ResolveAgentService>;
  let providerKeyService: jest.Mocked<ProviderKeyService>;
  let providerService: jest.Mocked<ProviderService>;

  beforeEach(() => {
    oauthService = {
      generateAuthorizationUrl: jest.fn(),
      revokeToken: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<OpenaiOauthService>;

    resolveAgent = {
      resolve: jest.fn(),
    } as unknown as jest.Mocked<ResolveAgentService>;

    providerKeyService = {
      getProviderApiKey: jest.fn(),
    } as unknown as jest.Mocked<ProviderKeyService>;

    providerService = {
      removeProvider: jest.fn().mockResolvedValue({ notifications: [] }),
    } as unknown as jest.Mocked<ProviderService>;

    controller = new OpenaiOauthController(
      oauthService,
      resolveAgent,
      providerKeyService,
      providerService,
    );
  });

  describe('authorize', () => {
    it('resolves agent and returns authorize URL', async () => {
      resolveAgent.resolve.mockResolvedValue({ id: 'agent-id-1' } as never);
      oauthService.generateAuthorizationUrl.mockResolvedValue('https://auth.openai.com/oauth/...');

      const req = {
        protocol: 'http',
        get: jest.fn().mockReturnValue('localhost:3001'),
      } as unknown as Request;

      const result = await controller.authorize('my-agent', { id: 'user-1' } as never, req);

      expect(resolveAgent.resolve).toHaveBeenCalledWith('user-1', 'my-agent');
      expect(oauthService.generateAuthorizationUrl).toHaveBeenCalledWith(
        'agent-id-1',
        'user-1',
        'http://localhost:3001',
      );
      expect(result).toEqual({ url: 'https://auth.openai.com/oauth/...' });
    });

    it('throws 400 when agentName is missing', async () => {
      const req = {
        protocol: 'http',
        get: jest.fn().mockReturnValue('localhost:3001'),
      } as unknown as Request;

      await expect(
        controller.authorize(undefined as unknown as string, { id: 'user-1' } as never, req),
      ).rejects.toThrow(HttpException);
    });

    it('throws 400 when agentName is empty string', async () => {
      const req = {
        protocol: 'http',
        get: jest.fn().mockReturnValue('localhost:3001'),
      } as unknown as Request;

      await expect(controller.authorize('', { id: 'user-1' } as never, req)).rejects.toThrow(
        HttpException,
      );
    });

    it('throws 503 when callback server port is unavailable', async () => {
      resolveAgent.resolve.mockResolvedValue({ id: 'agent-id-1' } as never);
      oauthService.generateAuthorizationUrl.mockRejectedValue(
        new Error("Port 1455 is already in use. Run 'lsof -i :1455' to find the process."),
      );

      const req = {
        protocol: 'http',
        get: jest.fn().mockReturnValue('localhost:3001'),
      } as unknown as Request;

      await expect(
        controller.authorize('my-agent', { id: 'user-1' } as never, req),
      ).rejects.toThrow(HttpException);
    });

    it('throws 503 with generic message when non-Error is thrown', async () => {
      resolveAgent.resolve.mockResolvedValue({ id: 'agent-id-1' } as never);
      oauthService.generateAuthorizationUrl.mockRejectedValue('string-error');

      const req = {
        protocol: 'http',
        get: jest.fn().mockReturnValue('localhost:3001'),
      } as unknown as Request;

      await expect(
        controller.authorize('my-agent', { id: 'user-1' } as never, req),
      ).rejects.toThrow('Failed to start OAuth callback server');
    });
  });

  describe('revoke', () => {
    it('throws 400 when agentName is missing', async () => {
      await expect(
        controller.revoke(undefined as unknown as string, { id: 'user-1' } as never),
      ).rejects.toThrow(HttpException);
    });

    it('throws 400 when agentName is empty string', async () => {
      await expect(controller.revoke('', { id: 'user-1' } as never)).rejects.toThrow(HttpException);
    });

    it('revokes both access and refresh tokens from stored blob', async () => {
      resolveAgent.resolve.mockResolvedValue({ id: 'agent-id-1' } as never);
      const blob = JSON.stringify({ t: 'access-tok', r: 'refresh-tok', e: Date.now() + 3600000 });
      providerKeyService.getProviderApiKey.mockResolvedValue(blob);

      const result = await controller.revoke('my-agent', { id: 'user-1' } as never);

      expect(providerKeyService.getProviderApiKey).toHaveBeenCalledWith(
        'agent-id-1',
        'openai',
        'subscription',
      );
      expect(oauthService.revokeToken).toHaveBeenCalledWith('access-tok');
      expect(oauthService.revokeToken).toHaveBeenCalledWith('refresh-tok');
      expect(providerService.removeProvider).toHaveBeenCalledWith(
        'agent-id-1',
        'openai',
        'subscription',
      );
      expect(result).toEqual({ ok: true });
    });

    it('returns ok even when no stored token exists', async () => {
      resolveAgent.resolve.mockResolvedValue({ id: 'agent-id-1' } as never);
      providerKeyService.getProviderApiKey.mockResolvedValue(null);

      const result = await controller.revoke('my-agent', { id: 'user-1' } as never);

      expect(oauthService.revokeToken).not.toHaveBeenCalled();
      expect(providerService.removeProvider).toHaveBeenCalledWith(
        'agent-id-1',
        'openai',
        'subscription',
      );
      expect(result).toEqual({ ok: true });
    });

    it('returns ok when token blob is not valid JSON', async () => {
      resolveAgent.resolve.mockResolvedValue({ id: 'agent-id-1' } as never);
      providerKeyService.getProviderApiKey.mockResolvedValue('not-json');

      const result = await controller.revoke('my-agent', { id: 'user-1' } as never);

      expect(oauthService.revokeToken).not.toHaveBeenCalled();
      expect(providerService.removeProvider).toHaveBeenCalledWith(
        'agent-id-1',
        'openai',
        'subscription',
      );
      expect(result).toEqual({ ok: true });
    });
  });

  describe('callback (POST)', () => {
    beforeEach(() => {
      oauthService.exchangeCode = jest.fn().mockResolvedValue(undefined);
    });

    it('exchanges code and returns ok', async () => {
      const result = await controller.callback('auth-code', 'state-123', { id: 'user-1' } as never);

      expect(oauthService.exchangeCode).toHaveBeenCalledWith('state-123', 'auth-code');
      expect(result).toEqual({ ok: true });
    });

    it('throws 400 when code is missing', async () => {
      await expect(controller.callback('', 'state-123', { id: 'user-1' } as never)).rejects.toThrow(
        HttpException,
      );
    });

    it('throws 400 when state is missing', async () => {
      await expect(controller.callback('auth-code', '', { id: 'user-1' } as never)).rejects.toThrow(
        HttpException,
      );
    });

    it('throws 400 when exchange fails', async () => {
      oauthService.exchangeCode = jest.fn().mockRejectedValue(new Error('Invalid state'));

      await expect(
        controller.callback('auth-code', 'bad-state', { id: 'user-1' } as never),
      ).rejects.toThrow(HttpException);
    });

    it('throws 400 with generic message when exchange throws non-Error', async () => {
      oauthService.exchangeCode = jest.fn().mockRejectedValue('string-error');

      await expect(
        controller.callback('auth-code', 'bad-state', { id: 'user-1' } as never),
      ).rejects.toThrow('Token exchange failed');
    });
  });

  describe('done', () => {
    let res: jest.Mocked<Response>;

    beforeEach(() => {
      res = {
        setHeader: jest.fn(),
        send: jest.fn(),
      } as unknown as jest.Mocked<Response>;
    });

    it('returns success HTML when ok=1 with nonce-based CSP', () => {
      controller.done('1', res);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/html');
      const cspCall = res.setHeader.mock.calls.find((c) => c[0] === 'Content-Security-Policy');
      expect(cspCall).toBeDefined();
      expect(cspCall![1]).toMatch(/^default-src 'none'; script-src 'nonce-[A-Za-z0-9+/=]+'$/);
      expect(res.send).toHaveBeenCalledWith(expect.stringContaining('manifest-oauth-success'));
      expect(res.send).toHaveBeenCalledWith(expect.stringContaining('Login successful'));
      expect(res.send).toHaveBeenCalledWith(expect.stringContaining('BroadcastChannel'));
      // Script tag should include the nonce
      const html = res.send.mock.calls[0][0] as string;
      expect(html).toMatch(/nonce="[A-Za-z0-9+/=]+"/);
    });

    it('returns error HTML when ok=0 with nonce-based CSP', () => {
      controller.done('0', res);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/html');
      const cspCall = res.setHeader.mock.calls.find((c) => c[0] === 'Content-Security-Policy');
      expect(cspCall).toBeDefined();
      expect(cspCall![1]).toMatch(/^default-src 'none'; script-src 'nonce-[A-Za-z0-9+/=]+'$/);
      expect(res.send).toHaveBeenCalledWith(expect.stringContaining('manifest-oauth-error'));
      expect(res.send).toHaveBeenCalledWith(expect.stringContaining('Login failed'));
      expect(res.send).toHaveBeenCalledWith(expect.stringContaining('BroadcastChannel'));
    });
  });
});
