import { UnauthorizedException, BadRequestException, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ArgumentsHost } from '@nestjs/common';
import { ProxyExceptionFilter } from '../proxy-exception.filter';

function createMockHost(body: Record<string, unknown> = {}, headers: Record<string, string> = {}) {
  const req: Record<string, unknown> = { body, headers };

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

/** Helper for the existing tests that exercised the chat-client friendly path. */
function chatHost(body: Record<string, unknown> = {}) {
  return createMockHost(body, { accept: 'text/event-stream' });
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

  describe('auth errors (401) — chat client', () => {
    it('converts "Authorization header required" to friendly message', () => {
      const { host, res } = chatHost();
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
      const { host, res } = chatHost();
      filter.catch(new UnauthorizedException('Empty token'), host);

      expect(res.status).toHaveBeenCalledWith(200);
      const content = res.json.mock.calls[0][0].choices[0].message.content;
      expect(content).toContain('Bearer token is empty');
    });

    it('converts "Invalid API key format" to friendly message', () => {
      const { host, res } = chatHost();
      filter.catch(new UnauthorizedException('Invalid API key format'), host);

      expect(res.status).toHaveBeenCalledWith(200);
      const content = res.json.mock.calls[0][0].choices[0].message.content;
      expect(content).toContain('mnfst_');
    });

    it('converts "API key expired" with dashboard URL', () => {
      const { host, res } = chatHost();
      filter.catch(new UnauthorizedException('API key expired'), host);

      expect(res.status).toHaveBeenCalledWith(200);
      const content = res.json.mock.calls[0][0].choices[0].message.content;
      expect(content).toContain('expired');
      expect(content).toContain('http://localhost:3001');
      expect(content).not.toContain('/routing');
    });

    it('converts "Invalid API key" to friendly message', () => {
      const { host, res } = chatHost();
      filter.catch(new UnauthorizedException('Invalid API key'), host);

      expect(res.status).toHaveBeenCalledWith(200);
      const content = res.json.mock.calls[0][0].choices[0].message.content;
      expect(content).toContain("I don't recognize this key");
    });

    it('includes dashboard URL in auth error messages', () => {
      const { host, res } = chatHost();
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

    it('returns SSE friendly response when client sends Accept: text/event-stream', () => {
      const { host, res } = createMockHost({}, { accept: 'text/event-stream' });
      filter.catch(new UnauthorizedException('Invalid API key'), host);

      expect(res.status).toHaveBeenCalledWith(200);
      // Friendly JSON envelope is used here because stream=false even though
      // the Accept header signals a chat client.
      expect(res.json).toHaveBeenCalled();
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

  describe('other errors — chat client', () => {
    it('converts 400 errors to friendly chat message', () => {
      const { host, res } = chatHost();
      filter.catch(new BadRequestException('messages array is required'), host);

      expect(res.status).toHaveBeenCalledWith(200);
      const content = res.json.mock.calls[0][0].choices[0].message.content;
      expect(content).toBe('messages array is required');
    });

    it('converts 500 errors to generic friendly message', () => {
      const { host, res } = chatHost();
      filter.catch(new HttpException('Some internal error', 500), host);

      expect(res.status).toHaveBeenCalledWith(200);
      const content = res.json.mock.calls[0][0].choices[0].message.content;
      expect(content).toContain('[🦚 Manifest M500]');
      expect(content).toContain('Something broke on our end');
      expect(content).toContain('https://manifest.build/docs/errors/M500');
    });

    it('converts unknown auth message to friendly message', () => {
      const { host, res } = chatHost();
      filter.catch(new UnauthorizedException('Some unknown auth error'), host);

      expect(res.status).toHaveBeenCalledWith(200);
      const content = res.json.mock.calls[0][0].choices[0].message.content;
      expect(content).toBe('Some unknown auth error');
    });
  });

  describe('non-chat clients receive real HTTP statuses', () => {
    it('returns HTTP 401 with structured error envelope for known auth errors', () => {
      const { host, res } = createMockHost();
      filter.catch(new UnauthorizedException('Invalid API key'), host);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            type: 'auth_error',
            code: 'manifest_auth',
            message: expect.stringContaining("don't recognize this key"),
          }),
        }),
      );
    });

    it('returns HTTP 400 when a known auth error originated as a 400', () => {
      const { host, res } = createMockHost();
      filter.catch(new BadRequestException('Invalid API key format'), host);

      expect(res.status).toHaveBeenCalledWith(400);
      const payload = res.json.mock.calls[0][0];
      expect(payload.error.type).toBe('auth_error');
    });

    it('returns the original 400 status for validation errors', () => {
      const { host, res } = createMockHost();
      filter.catch(new BadRequestException('messages array is required'), host);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            type: 'invalid_request_error',
            message: 'messages array is required',
          }),
        }),
      );
    });

    it('returns 500 with a sanitized message for server errors', () => {
      const { host, res } = createMockHost();
      filter.catch(new HttpException('Some internal error', 500), host);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            type: 'server_error',
            message: expect.stringContaining('internal error'),
          }),
        }),
      );
    });

    it('treats Accept: application/json callers as non-chat', () => {
      const { host, res } = createMockHost({}, { accept: 'application/json' });
      filter.catch(new UnauthorizedException('Invalid API key'), host);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('treats stream=false + no accept header as non-chat', () => {
      const { host, res } = createMockHost({ stream: false });
      filter.catch(new UnauthorizedException('Invalid API key'), host);

      expect(res.status).toHaveBeenCalledWith(401);
    });
  });
});
