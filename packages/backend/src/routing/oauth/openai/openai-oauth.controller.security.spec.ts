import { HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { OpenaiOauthController } from './openai-oauth.controller';
import { OpenaiOauthService } from './openai-oauth.service';
import { ResolveAgentService } from '../../routing-core/resolve-agent.service';
import { ProviderService } from '../../routing-core/provider.service';
import { ProviderKeyService } from '../../routing-core/provider-key.service';

const ctx = { tenantId: 'tenant-1', userId: 'user-1' } as never;

const buildRequest = (): Request =>
  ({ protocol: 'http', get: jest.fn().mockReturnValue('localhost:3001') }) as unknown as Request;

function build() {
  const oauth = {
    generateAuthorizationUrl: jest.fn(),
    exchangeCode: jest.fn(),
    revokeToken: jest.fn().mockResolvedValue(undefined),
  } as unknown as OpenaiOauthService;
  const resolveAgent = {
    resolve: jest.fn().mockResolvedValue({ id: 'agent-1', tenant_id: 'tenant-1' }),
  } as unknown as ResolveAgentService;
  const providerKeyService = {
    getProviderKeys: jest.fn().mockResolvedValue([]),
  } as unknown as ProviderKeyService;
  const providerService = {
    removeProvider: jest.fn().mockResolvedValue({ notifications: [] }),
  } as unknown as ProviderService;
  const configService = {
    get: jest.fn().mockReturnValue(undefined),
  } as unknown as ConfigService;
  return {
    ctrl: new OpenaiOauthController(
      oauth,
      resolveAgent,
      providerKeyService,
      providerService,
      configService,
    ),
    oauth,
    resolveAgent,
    providerKeyService,
    providerService,
    configService,
  };
}

type MockedRes = Response & { setHeader: jest.Mock; send: jest.Mock };
const buildResponse = () => ({ setHeader: jest.fn(), send: jest.fn() }) as unknown as MockedRes;

const blobKey = (label: string, t: string, r: string) => ({
  id: `id-${label}`,
  label,
  priority: 0,
  apiKey: JSON.stringify({ t, r, e: 0 }),
  region: null,
});

describe('OpenaiOauthController', () => {
  describe('authorize', () => {
    it('returns 400 when agentName is empty (and skips agent lookup)', async () => {
      const { ctrl, resolveAgent } = build();
      await expect(ctrl.authorize('', ctx, buildRequest())).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
      });
      expect(resolveAgent.resolve).not.toHaveBeenCalled();
    });

    it('propagates NotFoundException when agent does not exist', async () => {
      const { ctrl, resolveAgent, oauth } = build();
      (resolveAgent.resolve as jest.Mock).mockRejectedValue(
        new NotFoundException('Agent "ghost" not found'),
      );
      await expect(ctrl.authorize('ghost', ctx, buildRequest())).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(oauth.generateAuthorizationUrl).not.toHaveBeenCalled();
    });

    it('uses BETTER_AUTH_URL from config when set', async () => {
      const { ctrl, oauth, configService } = build();
      (configService.get as jest.Mock).mockImplementation((key: string) =>
        key === 'BETTER_AUTH_URL' ? 'https://app.example.com' : undefined,
      );
      (oauth.generateAuthorizationUrl as jest.Mock).mockResolvedValue('https://openai/oauth?x=1');
      const result = await ctrl.authorize('demo-agent', ctx, buildRequest());
      expect(result).toEqual({ url: 'https://openai/oauth?x=1' });
      expect(oauth.generateAuthorizationUrl).toHaveBeenCalledWith(
        'agent-1',
        'tenant-1',
        'https://app.example.com',
        'user-1',
      );
    });

    it('falls back to request host:port when BETTER_AUTH_URL is not set', async () => {
      const { ctrl, oauth } = build();
      (oauth.generateAuthorizationUrl as jest.Mock).mockResolvedValue('https://openai/oauth?y=2');
      await ctrl.authorize('demo-agent', ctx, buildRequest());
      expect(oauth.generateAuthorizationUrl).toHaveBeenCalledWith(
        'agent-1',
        'tenant-1',
        'http://localhost:3001',
        'user-1',
      );
    });

    it('wraps service errors in a 503 carrying the original message', async () => {
      const { ctrl, oauth } = build();
      (oauth.generateAuthorizationUrl as jest.Mock).mockRejectedValue(new Error('bind failed'));
      await expect(ctrl.authorize('demo-agent', ctx, buildRequest())).rejects.toMatchObject({
        status: HttpStatus.SERVICE_UNAVAILABLE,
        message: 'bind failed',
      });
    });

    it('wraps non-Error throws with a generic message', async () => {
      const { ctrl, oauth } = build();
      (oauth.generateAuthorizationUrl as jest.Mock).mockRejectedValue('boom');
      await expect(ctrl.authorize('agent', ctx, buildRequest())).rejects.toThrow(
        'Failed to start OAuth callback server',
      );
    });
  });

  describe('revoke', () => {
    it('rejects missing agentName', async () => {
      const { ctrl } = build();
      await expect(ctrl.revoke('', undefined, ctx)).rejects.toBeInstanceOf(HttpException);
    });

    it('rejects repeated label query parameters', async () => {
      const { ctrl, resolveAgent, providerService } = build();
      await expect(ctrl.revoke('agent', ['Key 1', 'Key 2'], ctx)).rejects.toMatchObject({
        message: 'label query parameter must be a string',
        status: 400,
      });
      expect(resolveAgent.resolve).not.toHaveBeenCalled();
      expect(providerService.removeProvider).not.toHaveBeenCalled();
    });

    it('propagates NotFoundException (cross-tenant guard) and skips removeProvider', async () => {
      const { ctrl, resolveAgent, providerService } = build();
      (resolveAgent.resolve as jest.Mock).mockRejectedValue(
        new NotFoundException('Agent "other-tenant-agent" not found'),
      );
      await expect(ctrl.revoke('other-tenant-agent', undefined, ctx)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(providerService.removeProvider).not.toHaveBeenCalled();
    });

    it('removes provider when no stored OAuth keys exist', async () => {
      const { ctrl, providerService } = build();
      await expect(ctrl.revoke('agent', undefined, ctx)).resolves.toEqual({
        ok: true,
        notifications: [],
      });
      expect(providerService.removeProvider).toHaveBeenCalledWith(
        'agent-1',
        'tenant-1',
        'openai',
        'subscription',
        undefined,
      );
    });

    it('revokes both access and refresh tokens for stored keys', async () => {
      const { ctrl, oauth, providerKeyService, providerService } = build();
      (providerKeyService.getProviderKeys as jest.Mock).mockResolvedValue([
        blobKey('Default', 'access-1', 'refresh-1'),
      ]);
      await ctrl.revoke('agent', undefined, ctx);
      expect(oauth.revokeToken).toHaveBeenCalledWith('access-1');
      expect(oauth.revokeToken).toHaveBeenCalledWith('refresh-1');
      expect(providerService.removeProvider).toHaveBeenCalledWith(
        'agent-1',
        'tenant-1',
        'openai',
        'subscription',
        undefined,
      );
    });

    it('filters keys by label (case-insensitive) when provided', async () => {
      const { ctrl, oauth, providerKeyService, providerService } = build();
      (providerKeyService.getProviderKeys as jest.Mock).mockResolvedValue([
        blobKey('Default', 'a1', 'r1'),
        blobKey('Work', 'a2', 'r2'),
      ]);
      await ctrl.revoke('agent', 'work', ctx);
      expect(oauth.revokeToken).toHaveBeenCalledWith('a2');
      expect(oauth.revokeToken).toHaveBeenCalledWith('r2');
      expect(oauth.revokeToken).not.toHaveBeenCalledWith('a1');
      expect(providerService.removeProvider).toHaveBeenCalledWith(
        'agent-1',
        'tenant-1',
        'openai',
        'subscription',
        'work',
      );
    });

    it.each([
      ['null apiKey', null],
      ['malformed JSON', 'not-json{'],
    ])('skips revokeToken for %s but still calls removeProvider', async (_label, apiKey) => {
      const { ctrl, oauth, providerKeyService, providerService } = build();
      (providerKeyService.getProviderKeys as jest.Mock).mockResolvedValue([
        { id: 'p1', label: 'Default', priority: 0, apiKey, region: null },
      ]);
      await expect(ctrl.revoke('agent', undefined, ctx)).resolves.toEqual({
        ok: true,
        notifications: [],
      });
      expect(oauth.revokeToken).not.toHaveBeenCalled();
      expect(providerService.removeProvider).toHaveBeenCalled();
    });

    it('forwards notifications from provider service', async () => {
      const { ctrl, providerService } = build();
      (providerService.removeProvider as jest.Mock).mockResolvedValue({
        notifications: ['some-warning'],
      });
      await expect(ctrl.revoke('agent', undefined, ctx)).resolves.toEqual({
        ok: true,
        notifications: ['some-warning'],
      });
    });
  });

  describe('callback', () => {
    it('returns 400 when code is missing and skips exchangeCode', async () => {
      const { ctrl, oauth } = build();
      await expect(ctrl.callback('', 'state', ctx)).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
      });
      expect(oauth.exchangeCode).not.toHaveBeenCalled();
    });

    it('rejects when state is missing', async () => {
      const { ctrl } = build();
      await expect(ctrl.callback('code', '', ctx)).rejects.toBeInstanceOf(HttpException);
    });

    it('exchanges code via the service and returns ok', async () => {
      const { ctrl, oauth } = build();
      (oauth.exchangeCode as jest.Mock).mockResolvedValue(undefined);
      await expect(ctrl.callback('auth-code', 'state-1', ctx)).resolves.toEqual({ ok: true });
      expect(oauth.exchangeCode).toHaveBeenCalledWith('state-1', 'auth-code');
    });

    it('wraps service errors in a 400 carrying the original message', async () => {
      const { ctrl, oauth } = build();
      (oauth.exchangeCode as jest.Mock).mockRejectedValue(new Error('Token exchange failed'));
      await expect(ctrl.callback('code', 'state', ctx)).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
        message: 'Token exchange failed',
      });
    });

    it('wraps non-Error throws with a generic message', async () => {
      const { ctrl, oauth } = build();
      (oauth.exchangeCode as jest.Mock).mockRejectedValue('boom');
      await expect(ctrl.callback('code', 'state', ctx)).rejects.toThrow('Token exchange failed');
    });
  });

  describe('done', () => {
    const getCsp = (res: MockedRes) =>
      res.setHeader.mock.calls.find(([n]) => n === 'Content-Security-Policy')![1] as string;

    it('renders HTML success page with a CSP nonce when ok=1', () => {
      const { ctrl } = build();
      const res = buildResponse();
      ctrl.done('1', res);
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/html');
      expect(getCsp(res)).toMatch(/^default-src 'none'; script-src 'nonce-[A-Za-z0-9+/=]+'$/);
      const html = res.send.mock.calls[0][0] as string;
      expect(html).toContain('Login successful!');
      expect(html).toContain('manifest-oauth-success');
    });

    it('renders HTML failure page when ok is not "1"', () => {
      const { ctrl } = build();
      const res = buildResponse();
      ctrl.done('0', res);
      const html = res.send.mock.calls[0][0] as string;
      expect(html).toContain('Login failed');
      expect(html).toContain('manifest-oauth-error');
    });

    it('generates a unique nonce on every render', () => {
      const { ctrl } = build();
      const r1 = buildResponse();
      const r2 = buildResponse();
      ctrl.done('1', r1);
      ctrl.done('1', r2);
      expect(getCsp(r1)).not.toEqual(getCsp(r2));
    });
  });
});
