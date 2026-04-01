import { HttpException } from '@nestjs/common';
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

  beforeEach(() => {
    oauthService = {
      isConfigured: jest.fn().mockReturnValue(true),
      generateAuthorizationUrl: jest.fn(),
      exchangeCode: jest.fn().mockResolvedValue(undefined),
      revokeToken: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<GeminiOauthService>;

    resolveAgent = {
      resolve: jest.fn(),
    } as unknown as jest.Mocked<ResolveAgentService>;

    providerKeyService = {
      getProviderApiKey: jest.fn(),
    } as unknown as jest.Mocked<ProviderKeyService>;

    providerService = {
      removeProvider: jest.fn().mockResolvedValue({ notifications: [] }),
    } as unknown as jest.Mocked<ProviderService>;

    controller = new GeminiOauthController(
      oauthService,
      resolveAgent,
      providerKeyService,
      providerService,
    );
  });

  describe('authorize', () => {
    it('resolves agent and returns authorize URL', async () => {
      resolveAgent.resolve.mockResolvedValue({ id: 'agent-id-1' } as never);
      oauthService.generateAuthorizationUrl.mockResolvedValue(
        'https://accounts.google.com/o/oauth2/v2/auth?...',
      );

      const req = {
        protocol: 'http',
        get: jest.fn().mockReturnValue('localhost:3001'),
        headers: {},
      } as unknown as Request;

      const result = await controller.authorize('my-agent', { id: 'user-1' } as never, req);

      expect(resolveAgent.resolve).toHaveBeenCalledWith('user-1', 'my-agent');
      expect(oauthService.generateAuthorizationUrl).toHaveBeenCalledWith(
        'agent-id-1',
        'user-1',
        'http://localhost:3001/api/v1/oauth/gemini/callback',
      );
      expect(result).toEqual({ url: 'https://accounts.google.com/o/oauth2/v2/auth?...' });
    });

    it('uses x-forwarded-proto and x-forwarded-host headers when present', async () => {
      resolveAgent.resolve.mockResolvedValue({ id: 'agent-id-1' } as never);
      oauthService.generateAuthorizationUrl.mockResolvedValue('https://example.com/auth');

      const req = {
        protocol: 'http',
        get: jest.fn().mockReturnValue('localhost:3001'),
        headers: {
          'x-forwarded-proto': 'https',
          'x-forwarded-host': 'app.manifest.build',
        },
      } as unknown as Request;

      await controller.authorize('my-agent', { id: 'user-1' } as never, req);

      expect(oauthService.generateAuthorizationUrl).toHaveBeenCalledWith(
        'agent-id-1',
        'user-1',
        'https://app.manifest.build/api/v1/oauth/gemini/callback',
      );
    });

    it('throws 400 when agentName is missing', async () => {
      const req = {
        protocol: 'http',
        get: jest.fn().mockReturnValue('localhost:3001'),
        headers: {},
      } as unknown as Request;

      await expect(
        controller.authorize(undefined as unknown as string, { id: 'user-1' } as never, req),
      ).rejects.toThrow(HttpException);
    });

    it('throws 400 when agentName is empty string', async () => {
      const req = {
        protocol: 'http',
        get: jest.fn().mockReturnValue('localhost:3001'),
        headers: {},
      } as unknown as Request;

      await expect(controller.authorize('', { id: 'user-1' } as never, req)).rejects.toThrow(
        HttpException,
      );
    });

    it('throws 503 when OAuth is not configured', async () => {
      oauthService.isConfigured.mockReturnValue(false);

      const req = {
        protocol: 'http',
        get: jest.fn().mockReturnValue('localhost:3001'),
        headers: {},
      } as unknown as Request;

      await expect(
        controller.authorize('my-agent', { id: 'user-1' } as never, req),
      ).rejects.toThrow(HttpException);

      try {
        await controller.authorize('my-agent', { id: 'user-1' } as never, req);
      } catch (err) {
        expect((err as HttpException).getStatus()).toBe(503);
      }
    });
  });

  describe('callback', () => {
    it('exchanges code and redirects to done?ok=1 on success', async () => {
      const req = {
        protocol: 'http',
        get: jest.fn().mockReturnValue('localhost:3001'),
        headers: {},
      } as unknown as Request;

      const res = {
        redirect: jest.fn(),
        setHeader: jest.fn(),
        send: jest.fn(),
        status: jest.fn().mockReturnThis(),
      } as unknown as Response;

      await controller.callback('auth-code', 'state-123', undefined as unknown as string, req, res);

      expect(oauthService.exchangeCode).toHaveBeenCalledWith('state-123', 'auth-code');
      expect(res.redirect).toHaveBeenCalledWith(
        'http://localhost:3001/api/v1/oauth/gemini/done?ok=1',
      );
    });

    it('redirects to done?ok=0 when error query param is present', async () => {
      const req = {
        protocol: 'http',
        get: jest.fn().mockReturnValue('localhost:3001'),
        headers: {},
      } as unknown as Request;

      const res = {
        redirect: jest.fn(),
        setHeader: jest.fn(),
        send: jest.fn(),
        status: jest.fn().mockReturnThis(),
      } as unknown as Response;

      await controller.callback(
        undefined as unknown as string,
        undefined as unknown as string,
        'access_denied',
        req,
        res,
      );

      expect(oauthService.exchangeCode).not.toHaveBeenCalled();
      expect(res.redirect).toHaveBeenCalledWith(
        'http://localhost:3001/api/v1/oauth/gemini/done?ok=0',
      );
    });

    it('redirects to done?ok=0 when code is missing', async () => {
      const req = {
        protocol: 'http',
        get: jest.fn().mockReturnValue('localhost:3001'),
        headers: {},
      } as unknown as Request;

      const res = {
        redirect: jest.fn(),
        setHeader: jest.fn(),
        send: jest.fn(),
        status: jest.fn().mockReturnThis(),
      } as unknown as Response;

      await controller.callback(
        undefined as unknown as string,
        'state-123',
        undefined as unknown as string,
        req,
        res,
      );

      expect(oauthService.exchangeCode).not.toHaveBeenCalled();
      expect(res.redirect).toHaveBeenCalledWith(
        'http://localhost:3001/api/v1/oauth/gemini/done?ok=0',
      );
    });

    it('redirects to done?ok=0 when state is missing', async () => {
      const req = {
        protocol: 'http',
        get: jest.fn().mockReturnValue('localhost:3001'),
        headers: {},
      } as unknown as Request;

      const res = {
        redirect: jest.fn(),
        setHeader: jest.fn(),
        send: jest.fn(),
        status: jest.fn().mockReturnThis(),
      } as unknown as Response;

      await controller.callback(
        'auth-code',
        undefined as unknown as string,
        undefined as unknown as string,
        req,
        res,
      );

      expect(oauthService.exchangeCode).not.toHaveBeenCalled();
      expect(res.redirect).toHaveBeenCalledWith(
        'http://localhost:3001/api/v1/oauth/gemini/done?ok=0',
      );
    });

    it('redirects to done?ok=0 when exchangeCode throws an Error', async () => {
      oauthService.exchangeCode.mockRejectedValue(new Error('Invalid state'));

      const req = {
        protocol: 'http',
        get: jest.fn().mockReturnValue('localhost:3001'),
        headers: {},
      } as unknown as Request;

      const res = {
        redirect: jest.fn(),
        setHeader: jest.fn(),
        send: jest.fn(),
        status: jest.fn().mockReturnThis(),
      } as unknown as Response;

      await controller.callback('auth-code', 'bad-state', undefined as unknown as string, req, res);

      expect(res.redirect).toHaveBeenCalledWith(
        'http://localhost:3001/api/v1/oauth/gemini/done?ok=0',
      );
    });

    it('redirects to done?ok=0 when exchangeCode throws a non-Error', async () => {
      oauthService.exchangeCode.mockRejectedValue('string-error');

      const req = {
        protocol: 'http',
        get: jest.fn().mockReturnValue('localhost:3001'),
        headers: {},
      } as unknown as Request;

      const res = {
        redirect: jest.fn(),
        setHeader: jest.fn(),
        send: jest.fn(),
        status: jest.fn().mockReturnThis(),
      } as unknown as Response;

      await controller.callback('auth-code', 'bad-state', undefined as unknown as string, req, res);

      expect(res.redirect).toHaveBeenCalledWith(
        'http://localhost:3001/api/v1/oauth/gemini/done?ok=0',
      );
    });

    it('uses forwarded headers for redirect URL', async () => {
      const req = {
        protocol: 'http',
        get: jest.fn().mockReturnValue('localhost:3001'),
        headers: {
          'x-forwarded-proto': 'https',
          'x-forwarded-host': 'app.manifest.build',
        },
      } as unknown as Request;

      const res = {
        redirect: jest.fn(),
        setHeader: jest.fn(),
        send: jest.fn(),
        status: jest.fn().mockReturnThis(),
      } as unknown as Response;

      await controller.callback('auth-code', 'state-123', undefined as unknown as string, req, res);

      expect(res.redirect).toHaveBeenCalledWith(
        'https://app.manifest.build/api/v1/oauth/gemini/done?ok=1',
      );
    });
  });

  describe('done', () => {
    let res: jest.Mocked<Response>;

    beforeEach(() => {
      res = {
        setHeader: jest.fn(),
        send: jest.fn(),
        status: jest.fn().mockReturnThis(),
      } as unknown as jest.Mocked<Response>;
    });

    it('returns success HTML when ok=1', () => {
      controller.done('1', res);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/html');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Security-Policy',
        "default-src 'none'; script-src 'unsafe-inline'",
      );
      expect(res.send).toHaveBeenCalledWith(expect.stringContaining('manifest-oauth-success'));
      expect(res.send).toHaveBeenCalledWith(expect.stringContaining('Login successful'));
      expect(res.send).toHaveBeenCalledWith(expect.stringContaining('BroadcastChannel'));
    });

    it('returns error HTML when ok=0', () => {
      controller.done('0', res);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/html');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Security-Policy',
        "default-src 'none'; script-src 'unsafe-inline'",
      );
      expect(res.send).toHaveBeenCalledWith(expect.stringContaining('manifest-oauth-error'));
      expect(res.send).toHaveBeenCalledWith(expect.stringContaining('Login failed'));
      expect(res.send).toHaveBeenCalledWith(expect.stringContaining('BroadcastChannel'));
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
        'gemini',
        'subscription',
      );
      expect(oauthService.revokeToken).toHaveBeenCalledWith('access-tok');
      expect(oauthService.revokeToken).toHaveBeenCalledWith('refresh-tok');
      expect(providerService.removeProvider).toHaveBeenCalledWith(
        'agent-id-1',
        'gemini',
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
        'gemini',
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
        'gemini',
        'subscription',
      );
      expect(result).toEqual({ ok: true });
    });

    it('skips revocation of missing tokens in blob', async () => {
      resolveAgent.resolve.mockResolvedValue({ id: 'agent-id-1' } as never);
      const blob = JSON.stringify({ e: Date.now() + 3600000 });
      providerKeyService.getProviderApiKey.mockResolvedValue(blob);

      const result = await controller.revoke('my-agent', { id: 'user-1' } as never);

      expect(oauthService.revokeToken).not.toHaveBeenCalled();
      expect(providerService.removeProvider).toHaveBeenCalledWith(
        'agent-id-1',
        'gemini',
        'subscription',
      );
      expect(result).toEqual({ ok: true });
    });
  });
});
