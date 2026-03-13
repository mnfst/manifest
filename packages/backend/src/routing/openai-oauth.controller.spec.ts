import { OpenaiOauthController } from './openai-oauth.controller';
import { OpenaiOauthService } from './openai-oauth.service';
import { ResolveAgentService } from './resolve-agent.service';
import { Request, Response } from 'express';

describe('OpenaiOauthController', () => {
  let controller: OpenaiOauthController;
  let oauthService: jest.Mocked<OpenaiOauthService>;
  let resolveAgent: jest.Mocked<ResolveAgentService>;

  beforeEach(() => {
    oauthService = {
      generateAuthorizationUrl: jest.fn(),
    } as unknown as jest.Mocked<OpenaiOauthService>;

    resolveAgent = {
      resolve: jest.fn(),
    } as unknown as jest.Mocked<ResolveAgentService>;

    controller = new OpenaiOauthController(oauthService, resolveAgent);
  });

  describe('authorize', () => {
    it('resolves agent and returns authorize URL', async () => {
      resolveAgent.resolve.mockResolvedValue({ id: 'agent-id-1' } as never);
      oauthService.generateAuthorizationUrl.mockReturnValue('https://auth.openai.com/oauth/...');

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
  });

  describe('done', () => {
    let res: jest.Mocked<Response>;

    beforeEach(() => {
      res = {
        setHeader: jest.fn(),
        send: jest.fn(),
      } as unknown as jest.Mocked<Response>;
    });

    it('returns success HTML when ok=1', () => {
      controller.done('1', res);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/html');
      expect(res.send).toHaveBeenCalledWith(expect.stringContaining('manifest-oauth-success'));
      expect(res.send).toHaveBeenCalledWith(expect.stringContaining('Login successful'));
    });

    it('returns error HTML when ok=0', () => {
      controller.done('0', res);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/html');
      expect(res.send).toHaveBeenCalledWith(expect.stringContaining('manifest-oauth-error'));
      expect(res.send).toHaveBeenCalledWith(expect.stringContaining('Login failed'));
    });
  });
});
