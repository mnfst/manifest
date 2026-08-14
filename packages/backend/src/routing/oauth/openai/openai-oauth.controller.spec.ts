import { HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenaiOauthController } from './openai-oauth.controller';
import { OpenaiOauthService } from './openai-oauth.service';
import { ResolveAgentService } from '../../routing-core/resolve-agent.service';
import { ProviderKeyService } from '../../routing-core/provider-key.service';
import { ProviderService } from '../../routing-core/provider.service';
import { Request, Response } from 'express';

describe('OpenaiOauthController', () => {
  let controller: OpenaiOauthController;
  let oauthService: jest.Mocked<OpenaiOauthService>;
  let resolveAgent: jest.Mocked<ResolveAgentService>;
  let providerKeyService: jest.Mocked<ProviderKeyService>;
  let providerService: jest.Mocked<ProviderService>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    oauthService = {
      generateAuthorizationUrl: jest.fn(),
      revokeToken: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<OpenaiOauthService>;

    resolveAgent = {
      resolve: jest.fn(),
    } as unknown as jest.Mocked<ResolveAgentService>;

    providerKeyService = {
      getProviderKeys: jest.fn(),
    } as unknown as jest.Mocked<ProviderKeyService>;

    providerService = {
      removeProvider: jest.fn().mockResolvedValue({ notifications: [] }),
    } as unknown as jest.Mocked<ProviderService>;

    configService = {
      get: jest.fn().mockReturnValue(undefined),
    } as unknown as jest.Mocked<ConfigService>;

    controller = new OpenaiOauthController(
      oauthService,
      resolveAgent,
      providerKeyService,
      providerService,
      configService,
    );
  });

  describe('authorize', () => {
    it('resolves agent and returns authorize URL', async () => {
      resolveAgent.resolve.mockResolvedValue({ id: 'agent-id-1', tenant_id: 'tenant-1' } as never);
      oauthService.generateAuthorizationUrl.mockResolvedValue('https://auth.openai.com/oauth/...');

      const req = {
        protocol: 'http',
        get: jest.fn().mockReturnValue('localhost:3001'),
      } as unknown as Request;

      const result = await controller.authorize(
        'my-agent',
        { tenantId: 'tenant-1', userId: 'user-1' } as never,
        req,
      );

      expect(resolveAgent.resolve).toHaveBeenCalledWith('tenant-1', 'my-agent');
      expect(oauthService.generateAuthorizationUrl).toHaveBeenCalledWith(
        'agent-id-1',
        'tenant-1',
        'http://localhost:3001',
        'user-1',
      );
      expect(result).toEqual({ url: 'https://auth.openai.com/oauth/...' });
    });

    it('throws 400 when agentName is missing', async () => {
      const req = {
        protocol: 'http',
        get: jest.fn().mockReturnValue('localhost:3001'),
      } as unknown as Request;

      await expect(
        controller.authorize(
          undefined as unknown as string,
          { tenantId: 'tenant-1', userId: 'user-1' } as never,
          req,
        ),
      ).rejects.toThrow(HttpException);
    });

    it('throws 400 when agentName is empty string', async () => {
      const req = {
        protocol: 'http',
        get: jest.fn().mockReturnValue('localhost:3001'),
      } as unknown as Request;

      await expect(
        controller.authorize('', { tenantId: 'tenant-1', userId: 'user-1' } as never, req),
      ).rejects.toThrow(HttpException);
    });

    it('throws 503 when callback server port is unavailable', async () => {
      resolveAgent.resolve.mockResolvedValue({ id: 'agent-id-1', tenant_id: 'tenant-1' } as never);
      oauthService.generateAuthorizationUrl.mockRejectedValue(
        new Error("Port 1455 is already in use. Run 'lsof -i :1455' to find the process."),
      );

      const req = {
        protocol: 'http',
        get: jest.fn().mockReturnValue('localhost:3001'),
      } as unknown as Request;

      await expect(
        controller.authorize('my-agent', { tenantId: 'tenant-1', userId: 'user-1' } as never, req),
      ).rejects.toThrow(HttpException);
    });

    it('throws 503 with generic message when non-Error is thrown', async () => {
      resolveAgent.resolve.mockResolvedValue({ id: 'agent-id-1', tenant_id: 'tenant-1' } as never);
      oauthService.generateAuthorizationUrl.mockRejectedValue('string-error');

      const req = {
        protocol: 'http',
        get: jest.fn().mockReturnValue('localhost:3001'),
      } as unknown as Request;

      await expect(
        controller.authorize('my-agent', { tenantId: 'tenant-1', userId: 'user-1' } as never, req),
      ).rejects.toThrow('Failed to start OAuth callback server');
    });

    it('uses BETTER_AUTH_URL from config when set, ignoring Host header', async () => {
      resolveAgent.resolve.mockResolvedValue({ id: 'agent-id-1', tenant_id: 'tenant-1' } as never);
      oauthService.generateAuthorizationUrl.mockResolvedValue('https://auth.openai.com/oauth/...');
      configService.get.mockReturnValue('https://manifest.example.com');

      const req = {
        protocol: 'http',
        get: jest.fn().mockReturnValue('evil.example'),
      } as unknown as Request;

      await controller.authorize(
        'my-agent',
        { tenantId: 'tenant-1', userId: 'user-1' } as never,
        req,
      );

      expect(oauthService.generateAuthorizationUrl).toHaveBeenCalledWith(
        'agent-id-1',
        'tenant-1',
        'https://manifest.example.com',
        'user-1',
      );
    });
  });

  describe('revoke', () => {
    it('throws 400 when agentName is missing', async () => {
      await expect(
        controller.revoke(undefined as unknown as string, undefined, {
          tenantId: 'tenant-1',
          userId: 'user-1',
        } as never),
      ).rejects.toThrow(HttpException);
    });

    it('throws 400 when agentName is empty string', async () => {
      await expect(
        controller.revoke('', undefined, { tenantId: 'tenant-1', userId: 'user-1' } as never),
      ).rejects.toThrow(HttpException);
    });

    it('revokes every active OpenAI subscription key when no label is provided', async () => {
      resolveAgent.resolve.mockResolvedValue({ id: 'agent-id-1', tenant_id: 'tenant-1' } as never);
      providerKeyService.getProviderKeys.mockResolvedValue([
        {
          id: 'key-1',
          label: 'Default',
          priority: 0,
          apiKey: JSON.stringify({ t: 'access-tok', r: 'refresh-tok', e: Date.now() + 3600000 }),
          region: null,
        },
        {
          id: 'key-2',
          label: 'Key 2',
          priority: 1,
          apiKey: JSON.stringify({ t: 'access-2', r: 'refresh-2', e: Date.now() + 3600000 }),
          region: null,
        },
      ]);

      const result = await controller.revoke('my-agent', undefined, {
        tenantId: 'tenant-1',
        userId: 'user-1',
      } as never);

      expect(providerKeyService.getProviderKeys).toHaveBeenCalledWith(
        'tenant-1',
        'openai',
        'subscription',
      );
      expect(oauthService.revokeToken).toHaveBeenCalledWith('access-tok');
      expect(oauthService.revokeToken).toHaveBeenCalledWith('refresh-tok');
      expect(oauthService.revokeToken).toHaveBeenCalledWith('access-2');
      expect(oauthService.revokeToken).toHaveBeenCalledWith('refresh-2');
      expect(providerService.removeProvider).toHaveBeenCalledWith(
        'agent-id-1',
        'tenant-1',
        'openai',
        'subscription',
        undefined,
      );
      expect(result).toEqual({ ok: true, notifications: [] });
    });

    it('revokes and removes only the labeled OpenAI subscription key', async () => {
      resolveAgent.resolve.mockResolvedValue({ id: 'agent-id-1', tenant_id: 'tenant-1' } as never);
      providerKeyService.getProviderKeys.mockResolvedValue([
        {
          id: 'key-1',
          label: 'Default',
          priority: 0,
          apiKey: JSON.stringify({ t: 'access-tok', r: 'refresh-tok', e: Date.now() + 3600000 }),
          region: null,
        },
        {
          id: 'key-2',
          label: 'Key 2',
          priority: 1,
          apiKey: JSON.stringify({ t: 'access-2', r: 'refresh-2', e: Date.now() + 3600000 }),
          region: null,
        },
      ]);

      const result = await controller.revoke('my-agent', 'Key 2', {
        tenantId: 'tenant-1',
        userId: 'user-1',
      } as never);

      expect(oauthService.revokeToken).not.toHaveBeenCalledWith('access-tok');
      expect(oauthService.revokeToken).not.toHaveBeenCalledWith('refresh-tok');
      expect(oauthService.revokeToken).toHaveBeenCalledWith('access-2');
      expect(oauthService.revokeToken).toHaveBeenCalledWith('refresh-2');
      expect(providerService.removeProvider).toHaveBeenCalledWith(
        'agent-id-1',
        'tenant-1',
        'openai',
        'subscription',
        'Key 2',
      );
      expect(result).toEqual({ ok: true, notifications: [] });
    });

    it('rejects repeated label query parameters', async () => {
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
      expect(providerKeyService.getProviderKeys).not.toHaveBeenCalled();
      expect(providerService.removeProvider).not.toHaveBeenCalled();
    });

    it('returns ok even when no stored token exists', async () => {
      resolveAgent.resolve.mockResolvedValue({ id: 'agent-id-1', tenant_id: 'tenant-1' } as never);
      providerKeyService.getProviderKeys.mockResolvedValue([]);

      const result = await controller.revoke('my-agent', undefined, {
        tenantId: 'tenant-1',
        userId: 'user-1',
      } as never);

      expect(oauthService.revokeToken).not.toHaveBeenCalled();
      expect(providerService.removeProvider).toHaveBeenCalledWith(
        'agent-id-1',
        'tenant-1',
        'openai',
        'subscription',
        undefined,
      );
      expect(result).toEqual({ ok: true, notifications: [] });
    });

    it('returns ok when token blob is not valid JSON', async () => {
      resolveAgent.resolve.mockResolvedValue({ id: 'agent-id-1', tenant_id: 'tenant-1' } as never);
      providerKeyService.getProviderKeys.mockResolvedValue([
        { id: 'key-1', label: 'Default', priority: 0, apiKey: 'not-json', region: null },
      ]);

      const result = await controller.revoke('my-agent', undefined, {
        tenantId: 'tenant-1',
        userId: 'user-1',
      } as never);

      expect(oauthService.revokeToken).not.toHaveBeenCalled();
      expect(providerService.removeProvider).toHaveBeenCalledWith(
        'agent-id-1',
        'tenant-1',
        'openai',
        'subscription',
        undefined,
      );
      expect(result).toEqual({ ok: true, notifications: [] });
    });
  });

  describe('callback (POST)', () => {
    beforeEach(() => {
      oauthService.exchangeCode = jest.fn().mockResolvedValue(undefined);
    });

    it('exchanges code and returns ok', async () => {
      const result = await controller.callback('auth-code', 'state-123', {
        tenantId: 'tenant-1',
        userId: 'user-1',
      } as never);

      expect(oauthService.exchangeCode).toHaveBeenCalledWith('state-123', 'auth-code');
      expect(result).toEqual({ ok: true });
    });

    it('throws 400 when code is missing', async () => {
      await expect(
        controller.callback('', 'state-123', { tenantId: 'tenant-1', userId: 'user-1' } as never),
      ).rejects.toThrow(HttpException);
    });

    it('throws 400 when state is missing', async () => {
      await expect(
        controller.callback('auth-code', '', { tenantId: 'tenant-1', userId: 'user-1' } as never),
      ).rejects.toThrow(HttpException);
    });

    it('throws 400 when exchange fails', async () => {
      oauthService.exchangeCode = jest.fn().mockRejectedValue(new Error('Invalid state'));

      await expect(
        controller.callback('auth-code', 'bad-state', {
          tenantId: 'tenant-1',
          userId: 'user-1',
        } as never),
      ).rejects.toThrow(HttpException);
    });

    it('throws 400 with generic message when exchange throws non-Error', async () => {
      oauthService.exchangeCode = jest.fn().mockRejectedValue('string-error');

      await expect(
        controller.callback('auth-code', 'bad-state', {
          tenantId: 'tenant-1',
          userId: 'user-1',
        } as never),
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
