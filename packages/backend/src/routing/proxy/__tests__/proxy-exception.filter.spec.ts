import { UnauthorizedException, BadRequestException, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ArgumentsHost } from '@nestjs/common';
import { ProxyExceptionFilter } from '../proxy-exception.filter';

function createMockHost(body: Record<string, unknown> = {}) {
  const req: Record<string, unknown> = { body };

  const res = {
    setHeader: jest.fn(),
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
    send: jest.fn(),
  };

  return {
    host: {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
      }),
    } as unknown as ArgumentsHost,
    res,
    req,
  };
}

describe('ProxyExceptionFilter', () => {
  let filter: ProxyExceptionFilter;
  let config: jest.Mocked<ConfigService>;

  beforeEach(() => {
    config = {
      get: jest.fn((key: string) => {
        if (key === 'app.betterAuthUrl') return 'http://localhost:3001';
        return undefined;
      }),
    } as unknown as jest.Mocked<ConfigService>;

    filter = new ProxyExceptionFilter(config);
  });

  describe('auth errors (401)', () => {
    it('converts "Authorization header required" to friendly message', () => {
      const { host, res } = createMockHost();
      filter.catch(new UnauthorizedException('Authorization header required'), host);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          choices: expect.arrayContaining([
            expect.objectContaining({
              message: expect.objectContaining({
                content: expect.stringContaining('Missing the Authorization header'),
              }),
            }),
          ]),
        }),
      );
    });

    it('converts "Empty token" to friendly message', () => {
      const { host, res } = createMockHost();
      filter.catch(new UnauthorizedException('Empty token'), host);

      expect(res.status).toHaveBeenCalledWith(200);
      const content = res.json.mock.calls[0][0].choices[0].message.content;
      expect(content).toContain('Bearer token is empty');
    });

    it('converts "Invalid API key format" to friendly message', () => {
      const { host, res } = createMockHost();
      filter.catch(new UnauthorizedException('Invalid API key format'), host);

      expect(res.status).toHaveBeenCalledWith(200);
      const content = res.json.mock.calls[0][0].choices[0].message.content;
      expect(content).toContain('mnfst_');
    });

    it('converts "API key expired" with dashboard URL', () => {
      const { host, res } = createMockHost();
      filter.catch(new UnauthorizedException('API key expired'), host);

      expect(res.status).toHaveBeenCalledWith(200);
      const content = res.json.mock.calls[0][0].choices[0].message.content;
      expect(content).toContain('expired');
      expect(content).toContain('http://localhost:3001');
      expect(content).not.toContain('/routing');
    });

    it('converts "Invalid API key" to friendly message', () => {
      const { host, res } = createMockHost();
      filter.catch(new UnauthorizedException('Invalid API key'), host);

      expect(res.status).toHaveBeenCalledWith(200);
      const content = res.json.mock.calls[0][0].choices[0].message.content;
      expect(content).toContain("I don't recognize this key");
    });

    it('includes dashboard URL in auth error messages', () => {
      const { host, res } = createMockHost();
      filter.catch(new UnauthorizedException('Invalid API key'), host);

      const content = res.json.mock.calls[0][0].choices[0].message.content;
      expect(content).toContain('Dashboard: http://localhost:3001');
      expect(content).not.toContain('Dashboard: http://localhost:3001/routing');
    });
  });

  describe('streaming responses', () => {
    it('returns SSE format when stream=true', () => {
      const { host, res } = createMockHost({ stream: true });
      filter.catch(new UnauthorizedException('Invalid API key'), host);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
      expect(res.status).toHaveBeenCalledWith(200);
      const payload = res.send.mock.calls[0][0] as string;
      expect(payload).toContain('data: [DONE]');
      expect(payload).toContain('chat.completion.chunk');
    });
  });

  describe('429 passthrough', () => {
    it('passes rate limit errors through as HTTP 429', () => {
      const { host, res } = createMockHost();
      filter.catch(
        new HttpException('Too many requests — wait a few seconds and retry.', 429),
        host,
      );

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Too many requests — wait a few seconds and retry.',
          }),
        }),
      );
    });

    it('passes structured 429 errors through unchanged', () => {
      const errorBody = { error: { message: 'Rate limited', type: 'rate_limit' } };
      const { host, res } = createMockHost();
      filter.catch(new HttpException(errorBody, 429), host);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(errorBody);
    });
  });

  describe('other errors', () => {
    it('converts 400 errors to friendly chat message', () => {
      const { host, res } = createMockHost();
      filter.catch(new BadRequestException('messages array is required'), host);

      expect(res.status).toHaveBeenCalledWith(200);
      const content = res.json.mock.calls[0][0].choices[0].message.content;
      expect(content).toBe('messages array is required');
    });

    it('converts 500 errors to generic friendly message', () => {
      const { host, res } = createMockHost();
      filter.catch(new HttpException('Some internal error', 500), host);

      expect(res.status).toHaveBeenCalledWith(200);
      const content = res.json.mock.calls[0][0].choices[0].message.content;
      expect(content).toBe('[🦚 Manifest] Something broke on our end. Try again in a moment.');
    });

    it('converts unknown auth message to friendly message', () => {
      const { host, res } = createMockHost();
      filter.catch(new UnauthorizedException('Some unknown auth error'), host);

      expect(res.status).toHaveBeenCalledWith(200);
      const content = res.json.mock.calls[0][0].choices[0].message.content;
      expect(content).toBe('Some unknown auth error');
    });
  });
});
