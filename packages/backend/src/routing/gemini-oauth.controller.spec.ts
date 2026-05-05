import { HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GeminiOauthController } from './oauth/gemini-oauth.controller';
import { GeminiOauthService } from './oauth/gemini-oauth.service';
import { ResolveAgentService } from './routing-core/resolve-agent.service';
import { ProviderKeyService } from './routing-core/provider-key.service';
import { ProviderService } from './routing-core/provider.service';
import { Request, Response } from 'express';

describe('GeminiOauthController', () => {
  let controller: GeminiOauthController;
  let oauthService: jest.Mocked<GeminiOauthService>;
  let resolveAgent: jest.Mocked<ResolveAgentService>;
  let providerKeyService: jest.Mocked<ProviderKeyService>;
  let providerService: jest.Mocked<ProviderService>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    oauthService = {
      generateAuthorizationUrl: jest.fn(),
      revokeToken: jest.fn().mockResolvedValue(undefined),
      exchangeCode: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<GeminiOauthService>;

    resolveAgent = { resolve: jest.fn() } as unknown as jest.Mocked<ResolveAgentService>;

    providerKeyService = {
      getProviderApiKey: jest.fn(),
    } as unknown as jest.Mocked<ProviderKeyService>;

    providerService = {
      removeProvider: jest.fn().mockResolvedValue({ notifications: [] }),
    } as unknown as jest.Mocked<ProviderService>;

    configService = {
      get: jest.fn().mockReturnValue(undefined),
    } as unknown as jest.Mocked<ConfigService>;

    controller = new GeminiOauthController(
      oauthService,
      resolveAgent,
      providerKeyService,
      providerService,
      configService,
    );
  });

  function buildReq(host = 'localhost:3001'): Request {
    return {
      protocol: 'http',
      get: jest.fn().mockReturnValue(host),
    } as unknown as Request;
  }

  describe('authorize', () => {
    it('returns the authorize URL for a valid agent', async () => {
      resolveAgent.resolve.mockResolvedValue({ id: 'agent-1' } as never);
      oauthService.generateAuthorizationUrl.mockResolvedValue(
        'https://accounts.google.com/o/oauth2/v2/auth?...',
      );

      const result = await controller.authorize('my-agent', { id: 'u-1' } as never, buildReq());

      expect(resolveAgent.resolve).toHaveBeenCalledWith('u-1', 'my-agent');
      expect(oauthService.generateAuthorizationUrl).toHaveBeenCalledWith(
        'agent-1',
        'u-1',
        'http://localhost:3001',
      );
      expect(result).toEqual({ url: 'https://accounts.google.com/o/oauth2/v2/auth?...' });
    });

    it('throws 400 when agentName is missing', async () => {
      await expect(
        controller.authorize(undefined as unknown as string, { id: 'u-1' } as never, buildReq()),
      ).rejects.toThrow(HttpException);
    });

    it('throws 400 when agentName is empty', async () => {
      await expect(controller.authorize('', { id: 'u-1' } as never, buildReq())).rejects.toThrow(
        HttpException,
      );
    });

    it('uses BETTER_AUTH_URL when configured, ignoring Host header', async () => {
      resolveAgent.resolve.mockResolvedValue({ id: 'agent-1' } as never);
      oauthService.generateAuthorizationUrl.mockResolvedValue('https://google.example/');
      configService.get.mockReturnValue('https://manifest.example.com');

      await controller.authorize('my-agent', { id: 'u-1' } as never, buildReq('evil.example'));

      expect(oauthService.generateAuthorizationUrl).toHaveBeenCalledWith(
        'agent-1',
        'u-1',
        'https://manifest.example.com',
      );
    });

    it('translates port-in-use into 503', async () => {
      resolveAgent.resolve.mockResolvedValue({ id: 'agent-1' } as never);
      oauthService.generateAuthorizationUrl.mockRejectedValue(
        new Error('Port 1456 is already in use.'),
      );
      await expect(
        controller.authorize('my-agent', { id: 'u-1' } as never, buildReq()),
      ).rejects.toThrow(HttpException);
    });

    it('uses a generic 503 message when a non-Error is thrown', async () => {
      resolveAgent.resolve.mockResolvedValue({ id: 'agent-1' } as never);
      oauthService.generateAuthorizationUrl.mockRejectedValue('string-error');
      await expect(
        controller.authorize('my-agent', { id: 'u-1' } as never, buildReq()),
      ).rejects.toThrow('Failed to start OAuth callback server');
    });
  });

  describe('revoke', () => {
    it('throws 400 when agentName is missing', async () => {
      await expect(
        controller.revoke(undefined as unknown as string, { id: 'u-1' } as never),
      ).rejects.toThrow(HttpException);
    });

    it('revokes both access and refresh tokens', async () => {
      resolveAgent.resolve.mockResolvedValue({ id: 'agent-1' } as never);
      const blob = JSON.stringify({
        t: 'access',
        r: 'refresh',
        e: Date.now() + 3_600_000,
        u: 'proj-1',
      });
      providerKeyService.getProviderApiKey.mockResolvedValue(blob);

      const result = await controller.revoke('my-agent', { id: 'u-1' } as never);

      expect(providerKeyService.getProviderApiKey).toHaveBeenCalledWith(
        'agent-1',
        'gemini',
        'subscription',
      );
      expect(oauthService.revokeToken).toHaveBeenCalledWith('access');
      expect(oauthService.revokeToken).toHaveBeenCalledWith('refresh');
      expect(providerService.removeProvider).toHaveBeenCalledWith(
        'agent-1',
        'gemini',
        'subscription',
      );
      expect(result).toEqual({ ok: true });
    });

    it('returns ok when no token is stored', async () => {
      resolveAgent.resolve.mockResolvedValue({ id: 'agent-1' } as never);
      providerKeyService.getProviderApiKey.mockResolvedValue(null);

      const result = await controller.revoke('my-agent', { id: 'u-1' } as never);

      expect(oauthService.revokeToken).not.toHaveBeenCalled();
      expect(providerService.removeProvider).toHaveBeenCalledWith(
        'agent-1',
        'gemini',
        'subscription',
      );
      expect(result).toEqual({ ok: true });
    });

    it('returns ok when stored value is not valid JSON', async () => {
      resolveAgent.resolve.mockResolvedValue({ id: 'agent-1' } as never);
      providerKeyService.getProviderApiKey.mockResolvedValue('not-json');

      const result = await controller.revoke('my-agent', { id: 'u-1' } as never);

      expect(oauthService.revokeToken).not.toHaveBeenCalled();
      expect(providerService.removeProvider).toHaveBeenCalled();
      expect(result).toEqual({ ok: true });
    });
  });

  describe('callback (POST)', () => {
    it('exchanges code and returns ok', async () => {
      const result = await controller.callback('code', 'state', { id: 'u-1' } as never);
      expect(oauthService.exchangeCode).toHaveBeenCalledWith('state', 'code');
      expect(result).toEqual({ ok: true });
    });

    it('throws 400 when code is missing', async () => {
      await expect(controller.callback('', 'state', { id: 'u-1' } as never)).rejects.toThrow(
        HttpException,
      );
    });

    it('throws 400 when state is missing', async () => {
      await expect(controller.callback('code', '', { id: 'u-1' } as never)).rejects.toThrow(
        HttpException,
      );
    });

    it('translates Error from exchange into 400', async () => {
      oauthService.exchangeCode = jest.fn().mockRejectedValue(new Error('Invalid state'));
      await expect(controller.callback('code', 'bad', { id: 'u-1' } as never)).rejects.toThrow(
        HttpException,
      );
    });

    it('uses generic message when exchange throws a non-Error', async () => {
      oauthService.exchangeCode = jest.fn().mockRejectedValue('string-error');
      await expect(controller.callback('code', 'bad', { id: 'u-1' } as never)).rejects.toThrow(
        'Token exchange failed',
      );
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

    it('returns success HTML with nonce-based CSP when ok=1', () => {
      controller.done('1', res);
      const cspCall = res.setHeader.mock.calls.find((c) => c[0] === 'Content-Security-Policy');
      expect(cspCall![1]).toMatch(/^default-src 'none'; script-src 'nonce-[A-Za-z0-9+/=]+'$/);
      expect(res.send).toHaveBeenCalledWith(expect.stringContaining('manifest-oauth-success'));
    });

    it('returns error HTML with nonce-based CSP when ok=0', () => {
      controller.done('0', res);
      const cspCall = res.setHeader.mock.calls.find((c) => c[0] === 'Content-Security-Policy');
      expect(cspCall![1]).toMatch(/^default-src 'none'; script-src 'nonce-[A-Za-z0-9+/=]+'$/);
      expect(res.send).toHaveBeenCalledWith(expect.stringContaining('manifest-oauth-error'));
    });
  });
});
