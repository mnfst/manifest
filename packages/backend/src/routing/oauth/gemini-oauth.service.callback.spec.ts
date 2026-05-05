/**
 * Loopback callback-server coverage for {@link GeminiOauthService}. The main
 * spec uses `nodeEnv: 'production'` to bypass the loopback listener entirely;
 * here we mock `http.createServer` so we can exercise `ensureCallbackServer`
 * and `handleCallbackRequest` without binding a real port. Mirrors the
 * OpenaiOauthService loopback test pattern.
 */
import { createServer } from 'http';
import { ConfigService } from '@nestjs/config';
import { GeminiOauthService } from './gemini-oauth.service';
import { ProviderService } from '../routing-core/provider.service';
import { ModelDiscoveryService } from '../../model-discovery/model-discovery.service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fetchMock = jest.fn() as jest.Mock<Promise<any>>;
global.fetch = fetchMock;

jest.mock('http', () => {
  const actual = jest.requireActual('http');
  return {
    ...actual,
    createServer: jest.fn(() => ({
      listen: jest.fn((_port: number, _host: string, cb?: () => void) => cb?.()),
      close: jest.fn(),
      on: jest.fn(),
      unref: jest.fn(),
    })),
  };
});

const createServerMock = createServer as unknown as jest.Mock<unknown>;

describe('GeminiOauthService loopback callback server', () => {
  let service: GeminiOauthService;
  let providerService: jest.Mocked<ProviderService>;
  let discoveryService: { discoverModels: jest.Mock };

  beforeEach(() => {
    providerService = {
      upsertProvider: jest.fn().mockResolvedValue({ provider: {}, isNew: true }),
      recalculateTiers: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ProviderService>;
    discoveryService = { discoverModels: jest.fn().mockResolvedValue([]) };
    const configService = {
      get: (key: string) => {
        if (key === 'app.nodeEnv') return 'development';
        if (key === 'GOOGLE_GEMINI_CLIENT_ID') return 'test-client';
        if (key === 'GOOGLE_GEMINI_CLIENT_SECRET') return 'test-secret';
        return undefined;
      },
    } as unknown as ConfigService;
    service = new GeminiOauthService(
      providerService,
      configService,
      discoveryService as unknown as ModelDiscoveryService,
    );
    fetchMock.mockReset();
  });

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (service as any).callbackServer = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (service as any).serverReady = null;
    createServerMock.mockClear();
  });

  it('rejects with EADDRINUSE message when port 1456 is taken', async () => {
    let errorHandler: (err: NodeJS.ErrnoException) => void = () => undefined;
    createServerMock.mockReturnValueOnce({
      listen: jest.fn(),
      close: jest.fn(),
      on: jest.fn((_event: string, handler: (err: NodeJS.ErrnoException) => void) => {
        errorHandler = handler;
      }),
      unref: jest.fn(),
    });
    const promise = service.generateAuthorizationUrl('agent-1', 'user-1');
    const err = new Error('EADDRINUSE') as NodeJS.ErrnoException;
    err.code = 'EADDRINUSE';
    errorHandler(err);
    await expect(promise).rejects.toThrow(
      "Port 1456 is already in use. Run 'lsof -i :1456' to find the process.",
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((service as any).callbackServer).toBeNull();
  });

  it('rejects with a generic message on non-EADDRINUSE server errors', async () => {
    let errorHandler: (err: NodeJS.ErrnoException) => void = () => undefined;
    createServerMock.mockReturnValueOnce({
      listen: jest.fn(),
      close: jest.fn(),
      on: jest.fn((_event: string, handler: (err: NodeJS.ErrnoException) => void) => {
        errorHandler = handler;
      }),
      unref: jest.fn(),
    });
    const promise = service.generateAuthorizationUrl('agent-1', 'user-1');
    const err = new Error('boom') as NodeJS.ErrnoException;
    err.code = 'ECONNREFUSED';
    errorHandler(err);
    await expect(promise).rejects.toThrow('Callback server failed: boom');
  });

  function captureRequestHandler(): { handler: (req: unknown, res: unknown) => void } {
    const captured: { handler: (req: unknown, res: unknown) => void } = {
      handler: () => undefined,
    };
    createServerMock.mockImplementationOnce((handler: (req: unknown, res: unknown) => void) => {
      captured.handler = handler;
      return {
        listen: jest.fn((_p: number, _h: string, cb?: () => void) => cb?.()),
        close: jest.fn(),
        on: jest.fn(),
        unref: jest.fn(),
      };
    });
    return captured;
  }

  it('returns 404 for non-callback paths', async () => {
    const captured = captureRequestHandler();
    await service.generateAuthorizationUrl('agent-1', 'user-1');
    const res = { writeHead: jest.fn(), end: jest.fn() };
    captured.handler({ url: '/some/other/path' }, res);
    expect(res.writeHead).toHaveBeenCalledWith(404);
    expect(res.end).toHaveBeenCalledWith('Not found');
  });

  it('serves success HTML when token exchange + project discovery succeed', async () => {
    const captured = captureRequestHandler();
    const url = await service.generateAuthorizationUrl('agent-1', 'user-1');
    const state = new URL(url).searchParams.get('state')!;
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'tok', refresh_token: 'ref', expires_in: 3600 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ cloudaicompanionProject: 'proj-1' }),
      });

    const res = { writeHead: jest.fn(), end: jest.fn() };
    captured.handler({ url: `/oauth/callback?code=the-code&state=${state}` }, res);
    await new Promise((r) => setTimeout(r, 50));

    expect(res.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'text/html' });
    expect(res.end).toHaveBeenCalledWith(expect.stringContaining('manifest-oauth-success'));
  });

  it('serves error HTML when the provider returns an OAuth error param', async () => {
    const captured = captureRequestHandler();
    const url = await service.generateAuthorizationUrl('agent-1', 'user-1');
    const state = new URL(url).searchParams.get('state')!;

    const res = { writeHead: jest.fn(), end: jest.fn() };
    captured.handler(
      {
        url: `/oauth/callback?error=access_denied&error_description=User+denied&state=${state}`,
      },
      res,
    );

    expect(res.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'text/html' });
    expect(res.end).toHaveBeenCalledWith(expect.stringContaining('manifest-oauth-error'));
    expect(service.getPendingCount()).toBe(0);
  });

  it('serves error HTML when token exchange fails', async () => {
    const captured = captureRequestHandler();
    await service.generateAuthorizationUrl('agent-1', 'user-1');
    const res = { writeHead: jest.fn(), end: jest.fn() };
    captured.handler({ url: '/oauth/callback?code=x&state=invalid-state' }, res);
    await new Promise((r) => setTimeout(r, 50));
    expect(res.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'text/html' });
    expect(res.end).toHaveBeenCalledWith(expect.stringContaining('manifest-oauth-error'));
  });

  it('redirects to /api/v1/oauth/gemini/done on the trusted backendUrl when set', async () => {
    const captured = captureRequestHandler();
    const url = await service.generateAuthorizationUrl(
      'agent-1',
      'user-1',
      'http://localhost:3001',
    );
    const state = new URL(url).searchParams.get('state')!;
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'tok', refresh_token: 'ref', expires_in: 3600 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ cloudaicompanionProject: 'proj-1' }),
      });

    const res = { writeHead: jest.fn(), end: jest.fn() };
    captured.handler({ url: `/oauth/callback?code=the-code&state=${state}` }, res);
    await new Promise((r) => setTimeout(r, 50));

    expect(res.writeHead).toHaveBeenCalledWith(302, {
      Location: 'http://localhost:3001/api/v1/oauth/gemini/done?ok=1',
    });
  });

  it('treats a malformed backendUrl as untrusted (returns inline HTML)', async () => {
    const captured = captureRequestHandler();
    // `not a real url` fails URL parsing inside isAllowedRedirectOrigin →
    // service must not crash and must serve the inline /done HTML response.
    // The backendUrl is gated through `isAllowedRedirectOrigin` again at
    // generateAuthorizationUrl time so we go through that ungated path here
    // by reaching directly into pending state to install the bogus value.
    await service.generateAuthorizationUrl('agent-1', 'user-1');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pending = (service as any).pending as Map<string, { backendUrl: string }>;
    const [stateKey] = [...pending.keys()];
    pending.get(stateKey)!.backendUrl = '::: not a url :::';

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'tok', refresh_token: 'ref', expires_in: 3600 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ cloudaicompanionProject: 'proj-1' }),
      });

    const res = { writeHead: jest.fn(), end: jest.fn() };
    captured.handler({ url: `/oauth/callback?code=x&state=${stateKey}` }, res);
    await new Promise((r) => setTimeout(r, 50));
    expect(res.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'text/html' });
  });

  it('falls back to inline HTML when backendUrl is an external (non-loopback) origin', async () => {
    const captured = captureRequestHandler();
    const url = await service.generateAuthorizationUrl(
      'agent-1',
      'user-1',
      'https://evil.example.com',
    );
    const state = new URL(url).searchParams.get('state')!;
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'tok', refresh_token: 'ref', expires_in: 3600 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ cloudaicompanionProject: 'proj-1' }),
      });

    const res = { writeHead: jest.fn(), end: jest.fn() };
    captured.handler({ url: `/oauth/callback?code=the-code&state=${state}` }, res);
    await new Promise((r) => setTimeout(r, 50));

    expect(res.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'text/html' });
    expect(res.end).toHaveBeenCalledWith(expect.stringContaining('manifest-oauth-success'));
  });

  it('shuts the loopback server down once the last pending state resolves', async () => {
    const captured = captureRequestHandler();
    const url = await service.generateAuthorizationUrl('agent-1', 'user-1');
    const state = new URL(url).searchParams.get('state')!;
    // Snapshot the close mock from the most recent createServer call.
    const close = (createServerMock.mock.results[0].value as { close: jest.Mock }).close;

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'tok', refresh_token: 'ref', expires_in: 3600 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ cloudaicompanionProject: 'proj-1' }),
      });

    const res = { writeHead: jest.fn(), end: jest.fn() };
    captured.handler({ url: `/oauth/callback?code=the-code&state=${state}` }, res);
    await new Promise((r) => setTimeout(r, 50));
    expect(close).toHaveBeenCalled();
  });

  it('redirects with ok=0 to the trusted backendUrl when the OAuth callback errors', async () => {
    const captured = captureRequestHandler();
    const url = await service.generateAuthorizationUrl(
      'agent-1',
      'user-1',
      'http://localhost:3001',
    );
    const state = new URL(url).searchParams.get('state')!;

    const res = { writeHead: jest.fn(), end: jest.fn() };
    // Provider returned ?error=... — sendDoneResponse must redirect with ok=0
    // (the failure-redirect arm of the success?'1':'0' ternary).
    captured.handler({ url: `/oauth/callback?error=access_denied&state=${state}` }, res);

    expect(res.writeHead).toHaveBeenCalledWith(302, {
      Location: 'http://localhost:3001/api/v1/oauth/gemini/done?ok=0',
    });
  });

  it('falls back to the OAuth error code when no error_description is provided', async () => {
    const captured = captureRequestHandler();
    const url = await service.generateAuthorizationUrl('agent-1', 'user-1');
    const state = new URL(url).searchParams.get('state')!;

    const res = { writeHead: jest.fn(), end: jest.fn() };
    // No `error_description` — the service must fall back to the bare `error`
    // value when logging and still serve the inline error HTML.
    captured.handler({ url: `/oauth/callback?error=access_denied&state=${state}` }, res);

    expect(res.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'text/html' });
    expect(res.end).toHaveBeenCalledWith(expect.stringContaining('manifest-oauth-error'));
  });

  it('returns 404 when req.url is missing entirely', async () => {
    const captured = captureRequestHandler();
    await service.generateAuthorizationUrl('agent-1', 'user-1');
    const res = { writeHead: jest.fn(), end: jest.fn() };
    // The defensive `req.url ?? '/'` branch — Node never sets req.url to
    // undefined in practice, but handleCallbackRequest must still return 404
    // rather than crash if it ever does.
    captured.handler({}, res);
    expect(res.writeHead).toHaveBeenCalledWith(404);
  });

  it('treats a callback with empty code/state as a token-exchange failure', async () => {
    // Hits the `?? ''` fallbacks for both the `code` and `state` query params:
    // when `state` is empty the lookup fails and exchangeCode rejects, which
    // routes through the failure path of sendDoneResponse.
    const captured = captureRequestHandler();
    await service.generateAuthorizationUrl('agent-1', 'user-1');
    const res = { writeHead: jest.fn(), end: jest.fn() };
    captured.handler({ url: '/oauth/callback' }, res);
    await new Promise((r) => setTimeout(r, 50));
    expect(res.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'text/html' });
    expect(res.end).toHaveBeenCalledWith(expect.stringContaining('manifest-oauth-error'));
  });

  it('returns immediately from ensureCallbackServer when callbackServer is already running', async () => {
    // Hits the `if (this.callbackServer) return Promise.resolve();` early-return
    // branch (line 356). The first generateAuthorizationUrl creates the server;
    // the second call must short-circuit because callbackServer is already set.
    await service.generateAuthorizationUrl('agent-1', 'user-1');
    expect(createServerMock).toHaveBeenCalledTimes(1);
    await service.generateAuthorizationUrl('agent-2', 'user-2');
    // No second createServer call — the existing server is reused.
    expect(createServerMock).toHaveBeenCalledTimes(1);
  });

  it('returns immediately from ensureCallbackServer when serverReady is already pending', async () => {
    // Hits the `if (this.serverReady) return this.serverReady;` early-return
    // branch (line 357). We start one auth flow (which sets serverReady but
    // never resolves because we don't fire the listen callback), then start a
    // second flow that should re-use the same in-flight promise.
    const listenSpy = jest.fn();
    createServerMock.mockImplementationOnce(() => ({
      listen: listenSpy, // never invokes the cb → server never reports ready
      close: jest.fn(),
      on: jest.fn(),
      unref: jest.fn(),
    }));
    const firstAuth = service.generateAuthorizationUrl('agent-1', 'user-1');
    // After the first call, serverReady is set but unresolved.
    // The second call should *not* call createServer again — the early-return
    // branch hands back the existing promise.
    void service.generateAuthorizationUrl('agent-2', 'user-2').catch(() => {
      // Will never resolve because the first listen never finishes; that's
      // fine for the branch coverage assertion.
    });
    expect(createServerMock).toHaveBeenCalledTimes(1);
    expect(listenSpy).toHaveBeenCalledTimes(1);
    // Don't await firstAuth — the Promise is intentionally pending; jest will
    // tear down the suite without resolving it. Mark it as handled to avoid
    // an unhandled-rejection warning in case of process teardown ordering.
    firstAuth.catch(() => undefined);
  });

  it('skips spinning a callback server when nodeEnv is production', async () => {
    // Branch at line 87: if app.nodeEnv resolves to 'production', the
    // service should not call createServer at all.
    createServerMock.mockClear();
    const prodService = new GeminiOauthService(
      providerService,
      {
        get: (key: string) => {
          if (key === 'app.nodeEnv') return 'production';
          if (key === 'GOOGLE_GEMINI_CLIENT_ID') return 'test-client';
          if (key === 'GOOGLE_GEMINI_CLIENT_SECRET') return 'test-secret';
          return undefined;
        },
      } as unknown as ConfigService,
      discoveryService as unknown as ModelDiscoveryService,
    );
    await prodService.generateAuthorizationUrl('agent-1', 'user-1');
    expect(createServerMock).not.toHaveBeenCalled();
  });

  it('defaults nodeEnv to development when ConfigService returns nothing', async () => {
    // Line 87 nullish-coalescing branch: when configService.get returns
    // undefined for app.nodeEnv, the service treats the install as a dev
    // box and spins up the loopback callback listener.
    createServerMock.mockClear();
    const undefService = new GeminiOauthService(
      providerService,
      {
        get: (key: string) => {
          if (key === 'GOOGLE_GEMINI_CLIENT_ID') return 'test-client';
          if (key === 'GOOGLE_GEMINI_CLIENT_SECRET') return 'test-secret';
          return undefined;
        },
      } as unknown as ConfigService,
      discoveryService as unknown as ModelDiscoveryService,
    );
    await undefService.generateAuthorizationUrl('agent-1', 'user-1');
    expect(createServerMock).toHaveBeenCalled();
  });

  it('treats Code Assist onboarding non-OK response as no project (covers warn branch)', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'tok', refresh_token: 'ref', expires_in: 3600 }),
      })
      // loadCodeAssist returns no project
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      // onboardUser returns a non-OK status — should warn and return ''
      .mockResolvedValueOnce({ ok: false, status: 500, text: async () => '' });

    const url = await service.generateAuthorizationUrl('agent-1', 'user-1');
    const state = new URL(url).searchParams.get('state')!;
    await service.exchangeCode(state, 'code');
    const stored = (providerService.upsertProvider as jest.Mock).mock.calls[0][3] as string;
    expect(stored).not.toContain('"u":');
  });
});
