import { HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { XaiOauthController } from './xai-oauth.controller';
import { XaiOauthService } from './xai-oauth.service';
import { ResolveAgentService } from '../../routing-core/resolve-agent.service';
import { ProviderService } from '../../routing-core/provider.service';
import { ProviderKeyService } from '../../routing-core/provider-key.service';

const user = { id: 'user-1', email: 'u@example.com', name: 'U' } as never;

const buildRequest = (): Request =>
  ({ protocol: 'https', get: jest.fn().mockReturnValue('api.example.com') }) as unknown as Request;

function build() {
  const oauth = {
    generateAuthorizationUrl: jest.fn(),
    exchangeCode: jest.fn(),
    revokeToken: jest.fn().mockResolvedValue(undefined),
  } as unknown as XaiOauthService;
  const resolveAgent = {
    resolve: jest.fn().mockResolvedValue({ id: 'agent-1' }),
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
    ctrl: new XaiOauthController(
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

describe('XaiOauthController', () => {
  describe('authorize', () => {
    it('returns 400 when agentName is empty', async () => {
      const { ctrl, resolveAgent } = build();
      await expect(ctrl.authorize('', user, buildRequest())).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
      });
      expect(resolveAgent.resolve).not.toHaveBeenCalled();
    });

    it('propagates NotFoundException when agent does not exist', async () => {
      const { ctrl, resolveAgent, oauth } = build();
      (resolveAgent.resolve as jest.Mock).mockRejectedValue(
        new NotFoundException('Agent not found'),
      );
      await expect(ctrl.authorize('ghost', user, buildRequest())).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(oauth.generateAuthorizationUrl).not.toHaveBeenCalled();
    });

    it('uses BETTER_AUTH_URL from config when set', async () => {
      const { ctrl, oauth, configService } = build();
      (configService.get as jest.Mock).mockImplementation((key: string) =>
        key === 'BETTER_AUTH_URL' ? 'https://xai.example.com' : undefined,
      );
      (oauth.generateAuthorizationUrl as jest.Mock).mockResolvedValue('https://auth.x.ai/oauth?x');
      const result = await ctrl.authorize('demo-agent', user, buildRequest());
      expect(result).toEqual({ url: 'https://auth.x.ai/oauth?x' });
      expect(oauth.generateAuthorizationUrl).toHaveBeenCalledWith(
        'agent-1',
        'user-1',
        'https://xai.example.com',
      );
    });

    it('falls back to request host when BETTER_AUTH_URL is not set', async () => {
      const { ctrl, oauth } = build();
      (oauth.generateAuthorizationUrl as jest.Mock).mockResolvedValue('https://auth.x.ai/oauth?y');
      await ctrl.authorize('demo-agent', user, buildRequest());
      expect(oauth.generateAuthorizationUrl).toHaveBeenCalledWith(
        'agent-1',
        'user-1',
        'https://api.example.com',
      );
    });

    it('wraps service errors in a 503', async () => {
      const { ctrl, oauth } = build();
      (oauth.generateAuthorizationUrl as jest.Mock).mockRejectedValue(new Error('bind failed'));
      await expect(ctrl.authorize('demo-agent', user, buildRequest())).rejects.toMatchObject({
        status: HttpStatus.SERVICE_UNAVAILABLE,
        message: 'bind failed',
      });
    });

    it('wraps non-Error throws with a generic message', async () => {
      const { ctrl, oauth } = build();
      (oauth.generateAuthorizationUrl as jest.Mock).mockRejectedValue('boom');
      await expect(ctrl.authorize('agent', user, buildRequest())).rejects.toThrow(
        'Failed to start OAuth callback server',
      );
    });
  });

  describe('callback', () => {
    it('returns 400 when code is missing', async () => {
      const { ctrl, oauth } = build();
      await expect(ctrl.callback('', 'state', user)).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
      });
      expect(oauth.exchangeCode).not.toHaveBeenCalled();
    });

    it('returns 400 when state is missing', async () => {
      const { ctrl } = build();
      await expect(ctrl.callback('code', '', user)).rejects.toBeInstanceOf(HttpException);
    });

    it('exchanges code and returns ok', async () => {
      const { ctrl, oauth } = build();
      (oauth.exchangeCode as jest.Mock).mockResolvedValue(undefined);
      await expect(ctrl.callback('auth-code', 'state-1', user)).resolves.toEqual({ ok: true });
      expect(oauth.exchangeCode).toHaveBeenCalledWith('state-1', 'auth-code');
    });

    it('wraps service errors in a 400', async () => {
      const { ctrl, oauth } = build();
      (oauth.exchangeCode as jest.Mock).mockRejectedValue(new Error('token exchange failed'));
      await expect(ctrl.callback('code', 'state', user)).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
        message: 'token exchange failed',
      });
    });

    it('wraps non-Error throws with a generic message', async () => {
      const { ctrl, oauth } = build();
      (oauth.exchangeCode as jest.Mock).mockRejectedValue('boom');
      await expect(ctrl.callback('code', 'state', user)).rejects.toThrow('Token exchange failed');
    });
  });

  describe('revoke', () => {
    it('returns 400 when agentName is missing', async () => {
      const { ctrl } = build();
      await expect(ctrl.revoke('', undefined, user)).rejects.toBeInstanceOf(HttpException);
    });

    it('rejects repeated label query parameters', async () => {
      const { ctrl, resolveAgent, providerService } = build();
      await expect(ctrl.revoke('agent', ['Key 1', 'Key 2'], user)).rejects.toMatchObject({
        message: 'label query parameter must be a string',
        status: 400,
      });
      expect(resolveAgent.resolve).not.toHaveBeenCalled();
      expect(providerService.removeProvider).not.toHaveBeenCalled();
    });

    it('propagates NotFoundException from agent resolution', async () => {
      const { ctrl, resolveAgent, providerService } = build();
      (resolveAgent.resolve as jest.Mock).mockRejectedValue(
        new NotFoundException('Agent not found'),
      );
      await expect(ctrl.revoke('ghost', undefined, user)).rejects.toBeInstanceOf(NotFoundException);
      expect(providerService.removeProvider).not.toHaveBeenCalled();
    });

    it('calls removeProvider with user.id when no keys are stored', async () => {
      const { ctrl, providerService } = build();
      await expect(ctrl.revoke('agent', undefined, user)).resolves.toEqual({
        ok: true,
        notifications: [],
      });
      expect(providerService.removeProvider).toHaveBeenCalledWith(
        'agent-1',
        'user-1',
        'xai',
        'subscription',
        undefined,
      );
    });

    it('revokes both access and refresh tokens for stored keys', async () => {
      const { ctrl, oauth, providerKeyService, providerService } = build();
      (providerKeyService.getProviderKeys as jest.Mock).mockResolvedValue([
        blobKey('Default', 'access-1', 'refresh-1'),
      ]);
      await ctrl.revoke('agent', undefined, user);
      expect(oauth.revokeToken).toHaveBeenCalledWith('access-1');
      expect(oauth.revokeToken).toHaveBeenCalledWith('refresh-1');
      // Verify user.id (not agent.id) is threaded through to removeProvider
      expect(providerService.removeProvider).toHaveBeenCalledWith(
        'agent-1',
        'user-1',
        'xai',
        'subscription',
        undefined,
      );
    });

    it('uses user.id (not agent.id) when looking up provider keys', async () => {
      const { ctrl, providerKeyService } = build();
      await ctrl.revoke('agent', undefined, user);
      // First arg must be user.id ('user-1'), not agent.id ('agent-1')
      expect(providerKeyService.getProviderKeys).toHaveBeenCalledWith(
        'user-1',
        'xai',
        'subscription',
      );
    });

    it('filters keys by label case-insensitively when label is provided', async () => {
      const { ctrl, oauth, providerKeyService, providerService } = build();
      (providerKeyService.getProviderKeys as jest.Mock).mockResolvedValue([
        blobKey('Default', 'a1', 'r1'),
        blobKey('Work', 'a2', 'r2'),
      ]);
      await ctrl.revoke('agent', 'work', user);
      expect(oauth.revokeToken).toHaveBeenCalledWith('a2');
      expect(oauth.revokeToken).toHaveBeenCalledWith('r2');
      expect(oauth.revokeToken).not.toHaveBeenCalledWith('a1');
      expect(providerService.removeProvider).toHaveBeenCalledWith(
        'agent-1',
        'user-1',
        'xai',
        'subscription',
        'work',
      );
    });

    it.each([
      ['null apiKey', null],
      ['malformed JSON', 'not-json{'],
    ])('skips revokeToken for %s but still calls removeProvider', async (_desc, apiKey) => {
      const { ctrl, oauth, providerKeyService, providerService } = build();
      (providerKeyService.getProviderKeys as jest.Mock).mockResolvedValue([
        { id: 'p1', label: 'Default', priority: 0, apiKey, region: null },
      ]);
      await expect(ctrl.revoke('agent', undefined, user)).resolves.toEqual({
        ok: true,
        notifications: [],
      });
      expect(oauth.revokeToken).not.toHaveBeenCalled();
      expect(providerService.removeProvider).toHaveBeenCalled();
    });

    it('forwards notifications from provider service', async () => {
      const { ctrl, providerService } = build();
      (providerService.removeProvider as jest.Mock).mockResolvedValue({
        notifications: ['model-warning'],
      });
      await expect(ctrl.revoke('agent', undefined, user)).resolves.toEqual({
        ok: true,
        notifications: ['model-warning'],
      });
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
      expect(html).toContain('xAI Login');
    });

    it('renders HTML failure page when ok is not "1"', () => {
      const { ctrl } = build();
      const res = buildResponse();
      ctrl.done('0', res);
      const html = res.send.mock.calls[0][0] as string;
      expect(html).toContain('xAI Login');
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
