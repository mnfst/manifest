import { HttpException, HttpStatus } from '@nestjs/common';
import { AnthropicOauthController } from './anthropic-oauth.controller';
import { AnthropicOauthExchangeError, AnthropicOauthService } from './anthropic-oauth.service';
import { ResolveAgentService } from '../../routing-core/resolve-agent.service';
import { ProviderService } from '../../routing-core/provider.service';

const ctx = { tenantId: 'tenant-1', userId: 'user-1' } as never;

function build() {
  const oauth = {
    generateAuthorizationUrl: jest.fn(),
    exchangeCode: jest.fn(),
    findPendingForAgent: jest.fn(),
  } as unknown as AnthropicOauthService;
  const resolveAgent = {
    resolve: jest.fn().mockResolvedValue({ id: 'agent-1', tenant_id: 'tenant-1' }),
  } as unknown as ResolveAgentService;
  const providerService = {
    removeProvider: jest.fn().mockResolvedValue({ notifications: [] }),
  } as unknown as ProviderService;
  return {
    ctrl: new AnthropicOauthController(oauth, resolveAgent, providerService),
    oauth,
    resolveAgent,
    providerService,
  };
}

describe('AnthropicOauthController', () => {
  describe('authorize', () => {
    it('rejects when agentName is missing', async () => {
      const { ctrl } = build();
      await expect(ctrl.authorize('', ctx)).rejects.toBeInstanceOf(HttpException);
    });

    it('returns the authorize URL and state for a known agent', async () => {
      const { ctrl, oauth } = build();
      (oauth.generateAuthorizationUrl as jest.Mock).mockReturnValue({
        url: 'https://claude.ai/oauth/authorize?state=s1',
        state: 's1',
      });
      const result = await ctrl.authorize('demo-agent', ctx);
      expect(result).toEqual({ url: expect.any(String), state: 's1' });
      expect(oauth.generateAuthorizationUrl).toHaveBeenCalledWith('agent-1', 'tenant-1');
    });
  });

  describe('exchange', () => {
    it('rejects missing agentName', async () => {
      const { ctrl } = build();
      await expect(ctrl.exchange('', 'code', 'state', ctx)).rejects.toBeInstanceOf(HttpException);
    });

    it('rejects missing code', async () => {
      const { ctrl } = build();
      await expect(ctrl.exchange('agent', '', 'state', ctx)).rejects.toBeInstanceOf(HttpException);
    });

    it('exchanges the code via the service and returns ok', async () => {
      const { ctrl, oauth } = build();
      (oauth.exchangeCode as jest.Mock).mockResolvedValue(undefined);
      await expect(ctrl.exchange('agent', 'auth-code', 'state-1', ctx)).resolves.toEqual({
        ok: true,
      });
      expect(oauth.exchangeCode).toHaveBeenCalledWith(
        'auth-code',
        'state-1',
        'agent-1',
        'tenant-1',
        'user-1',
      );
    });

    it('wraps service errors in a 400', async () => {
      const { ctrl, oauth } = build();
      (oauth.exchangeCode as jest.Mock).mockRejectedValue(new Error('Token exchange failed'));
      await expect(ctrl.exchange('agent', 'code', 'state', ctx)).rejects.toBeInstanceOf(
        HttpException,
      );
    });

    it('preserves rate-limit status from service errors', async () => {
      const { ctrl, oauth } = build();
      (oauth.exchangeCode as jest.Mock).mockRejectedValue(
        new AnthropicOauthExchangeError('Anthropic rate-limited the OAuth token exchange.', 429),
      );

      try {
        await ctrl.exchange('agent', 'code', 'state', ctx);
        throw new Error('Expected exchange to fail');
      } catch (err) {
        expect(err).toBeInstanceOf(HttpException);
        expect((err as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      }
    });

    it('wraps non-Error throws with a generic message', async () => {
      const { ctrl, oauth } = build();
      (oauth.exchangeCode as jest.Mock).mockRejectedValue('boom');
      await expect(ctrl.exchange('agent', 'code', 'state', ctx)).rejects.toThrow(
        'Token exchange failed',
      );
    });
  });

  describe('pending', () => {
    it('rejects missing agentName', async () => {
      const { ctrl } = build();
      await expect(ctrl.pending('', ctx)).rejects.toBeInstanceOf(HttpException);
    });

    it('returns the active state when one exists', async () => {
      const { ctrl, oauth } = build();
      (oauth.findPendingForAgent as jest.Mock).mockResolvedValue({ state: 'abc' });
      await expect(ctrl.pending('agent', ctx)).resolves.toEqual({ state: 'abc' });
      expect(oauth.findPendingForAgent).toHaveBeenCalledWith('agent-1', 'tenant-1');
    });

    it('returns {state: null} when no flow is pending', async () => {
      const { ctrl, oauth } = build();
      (oauth.findPendingForAgent as jest.Mock).mockResolvedValue(null);
      await expect(ctrl.pending('agent', ctx)).resolves.toEqual({ state: null });
    });
  });

  describe('revoke', () => {
    it('rejects missing agentName', async () => {
      const { ctrl } = build();
      await expect(ctrl.revoke('', undefined, ctx)).rejects.toBeInstanceOf(HttpException);
    });

    it('removes all Anthropic subscription records for the agent', async () => {
      const { ctrl, providerService } = build();
      await expect(ctrl.revoke('agent', undefined, ctx)).resolves.toEqual({
        ok: true,
        notifications: [],
      });
      expect(providerService.removeProvider).toHaveBeenCalledWith(
        'agent-1',
        'tenant-1',
        'anthropic',
        'subscription',
        undefined,
      );
    });

    it('removes only the labeled Anthropic subscription record', async () => {
      const { ctrl, providerService } = build();
      await expect(ctrl.revoke('agent', 'Key 2', ctx)).resolves.toEqual({
        ok: true,
        notifications: [],
      });
      expect(providerService.removeProvider).toHaveBeenCalledWith(
        'agent-1',
        'tenant-1',
        'anthropic',
        'subscription',
        'Key 2',
      );
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
  });
});
