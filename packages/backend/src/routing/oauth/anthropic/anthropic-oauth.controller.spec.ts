import { HttpException, HttpStatus } from '@nestjs/common';
import { AnthropicOauthController } from './anthropic-oauth.controller';
import { AnthropicOauthExchangeError, AnthropicOauthService } from './anthropic-oauth.service';
import { ResolveAgentService } from '../../routing-core/resolve-agent.service';
import { ProviderService } from '../../routing-core/provider.service';

const user = { id: 'user-1', email: 'u@example.com', name: 'U' } as never;

function build() {
  const oauth = {
    generateAuthorizationUrl: jest.fn(),
    exchangeCode: jest.fn(),
    findPendingForAgent: jest.fn(),
  } as unknown as AnthropicOauthService;
  const resolveAgent = {
    resolve: jest.fn().mockResolvedValue({ id: 'agent-1' }),
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
      await expect(ctrl.authorize('', user)).rejects.toBeInstanceOf(HttpException);
    });

    it('returns the authorize URL and state for a known agent', async () => {
      const { ctrl, oauth } = build();
      (oauth.generateAuthorizationUrl as jest.Mock).mockReturnValue({
        url: 'https://claude.ai/oauth/authorize?state=s1',
        state: 's1',
      });
      const result = await ctrl.authorize('demo-agent', user);
      expect(result).toEqual({ url: expect.any(String), state: 's1' });
      expect(oauth.generateAuthorizationUrl).toHaveBeenCalledWith('agent-1', 'user-1');
    });
  });

  describe('exchange', () => {
    it('rejects missing agentName', async () => {
      const { ctrl } = build();
      await expect(ctrl.exchange('', 'code', 'state', user)).rejects.toBeInstanceOf(HttpException);
    });

    it('rejects missing code', async () => {
      const { ctrl } = build();
      await expect(ctrl.exchange('agent', '', 'state', user)).rejects.toBeInstanceOf(HttpException);
    });

    it('exchanges the code via the service and returns ok', async () => {
      const { ctrl, oauth } = build();
      (oauth.exchangeCode as jest.Mock).mockResolvedValue(undefined);
      await expect(ctrl.exchange('agent', 'auth-code', 'state-1', user)).resolves.toEqual({
        ok: true,
      });
      expect(oauth.exchangeCode).toHaveBeenCalledWith('auth-code', 'state-1', 'agent-1', 'user-1');
    });

    it('wraps service errors in a 400', async () => {
      const { ctrl, oauth } = build();
      (oauth.exchangeCode as jest.Mock).mockRejectedValue(new Error('Token exchange failed'));
      await expect(ctrl.exchange('agent', 'code', 'state', user)).rejects.toBeInstanceOf(
        HttpException,
      );
    });

    it('preserves rate-limit status from service errors', async () => {
      const { ctrl, oauth } = build();
      (oauth.exchangeCode as jest.Mock).mockRejectedValue(
        new AnthropicOauthExchangeError('Anthropic rate-limited the OAuth token exchange.', 429),
      );

      try {
        await ctrl.exchange('agent', 'code', 'state', user);
        throw new Error('Expected exchange to fail');
      } catch (err) {
        expect(err).toBeInstanceOf(HttpException);
        expect((err as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      }
    });

    it('wraps non-Error throws with a generic message', async () => {
      const { ctrl, oauth } = build();
      (oauth.exchangeCode as jest.Mock).mockRejectedValue('boom');
      await expect(ctrl.exchange('agent', 'code', 'state', user)).rejects.toThrow(
        'Token exchange failed',
      );
    });
  });

  describe('pending', () => {
    it('rejects missing agentName', async () => {
      const { ctrl } = build();
      await expect(ctrl.pending('', user)).rejects.toBeInstanceOf(HttpException);
    });

    it('returns the active state when one exists', async () => {
      const { ctrl, oauth } = build();
      (oauth.findPendingForAgent as jest.Mock).mockResolvedValue({ state: 'abc' });
      await expect(ctrl.pending('agent', user)).resolves.toEqual({ state: 'abc' });
      expect(oauth.findPendingForAgent).toHaveBeenCalledWith('agent-1', 'user-1');
    });

    it('returns {state: null} when no flow is pending', async () => {
      const { ctrl, oauth } = build();
      (oauth.findPendingForAgent as jest.Mock).mockResolvedValue(null);
      await expect(ctrl.pending('agent', user)).resolves.toEqual({ state: null });
    });
  });

  describe('revoke', () => {
    it('rejects missing agentName', async () => {
      const { ctrl } = build();
      await expect(ctrl.revoke('', undefined, user)).rejects.toBeInstanceOf(HttpException);
    });

    it('removes all Anthropic subscription records for the agent', async () => {
      const { ctrl, providerService } = build();
      await expect(ctrl.revoke('agent', undefined, user)).resolves.toEqual({
        ok: true,
        notifications: [],
      });
      expect(providerService.removeProvider).toHaveBeenCalledWith(
        'agent-1',
        'anthropic',
        'subscription',
        undefined,
      );
    });

    it('removes only the labeled Anthropic subscription record', async () => {
      const { ctrl, providerService } = build();
      await expect(ctrl.revoke('agent', 'Key 2', user)).resolves.toEqual({
        ok: true,
        notifications: [],
      });
      expect(providerService.removeProvider).toHaveBeenCalledWith(
        'agent-1',
        'anthropic',
        'subscription',
        'Key 2',
      );
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
  });
});
