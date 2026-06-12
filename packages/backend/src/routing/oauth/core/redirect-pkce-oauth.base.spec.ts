/**
 * Security-focused tests for RedirectPkceOauthBaseService — specifically the
 * backendUrl/redirect_uri validation that protects the callback server's 302
 * redirect from being forged to an attacker-controlled host.
 *
 * The base class is abstract; we instantiate it through a minimal concrete
 * subclass that mirrors the real OpenAI/Gemini wiring without touching any
 * external network or DI.
 */
import { ConfigService } from '@nestjs/config';
import { ProviderService } from '../../routing-core/provider.service';
import { ModelDiscoveryService } from '../../../model-discovery/model-discovery.service';
import {
  RedirectPkceOauthBaseService,
  type RedirectPkceOauthConfig,
} from './redirect-pkce-oauth.base';

interface PendingFlowState {
  verifier: string;
  agentId: string;
  userId: string;
  backendUrl: string;
  expiresAt: number;
}

class TestPkceOauthService extends RedirectPkceOauthBaseService {
  constructor(
    providerService: ProviderService,
    configService: ConfigService,
    discoveryService: ModelDiscoveryService,
    config?: Partial<RedirectPkceOauthConfig>,
  ) {
    super(providerService, configService, discoveryService, {
      providerId: 'test-provider',
      serviceName: 'TestPkceOauthService',
      defaultClientId: 'test-client-id',
      clientIdEnvVar: 'TEST_OAUTH_CLIENT_ID',
      authorizeUrl: 'https://auth.example.com/oauth/authorize',
      tokenUrl: 'https://auth.example.com/oauth/token',
      revokeUrl: 'https://auth.example.com/oauth/revoke',
      scope: 'openid profile email',
      callbackPort: 1455,
      ...config,
    });
  }
}

function createConfig(nodeEnv = 'production'): ConfigService {
  return {
    get: (key: string) => {
      if (key === 'app.nodeEnv') return nodeEnv;
      return undefined;
    },
  } as unknown as ConfigService;
}

function createProviderService(): ProviderService {
  return {
    upsertProvider: jest.fn().mockResolvedValue({ provider: { id: 'p1' } }),
    recalculateTiers: jest.fn().mockResolvedValue(undefined),
    nextOAuthLabel: jest.fn().mockResolvedValue(undefined),
  } as unknown as ProviderService;
}

function createDiscovery(): ModelDiscoveryService {
  return {
    discoverModels: jest.fn().mockResolvedValue(undefined),
  } as unknown as ModelDiscoveryService;
}

// Read the pending store's stored backendUrl for an issued state without
// exposing a public API. The real services don't expose this; tests need it
// to confirm the validator sanitised the value at storage time.
function readPendingBackendUrl(svc: RedirectPkceOauthBaseService, state: string): string {
  const internals = svc as unknown as {
    pending: { peek: (key: string) => PendingFlowState | undefined };
  };
  return internals.pending.peek(state)?.backendUrl ?? '';
}

function buildSvc(): TestPkceOauthService {
  return new TestPkceOauthService(
    createProviderService(),
    createConfig('production'),
    createDiscovery(),
  );
}

describe('RedirectPkceOauthBaseService — backendUrl validation', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-06-01T12:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('generateAuthorizationUrl — sanitises backendUrl on storage', () => {
    it('stores a valid http://localhost backendUrl verbatim', async () => {
      const svc = buildSvc();
      const url = await svc.generateAuthorizationUrl('a', 'u', 'http://localhost:3001');
      const state = new URL(url).searchParams.get('state')!;
      expect(readPendingBackendUrl(svc, state)).toBe('http://localhost:3001');
    });

    it('stores a valid http://127.0.0.1 backendUrl verbatim', async () => {
      const svc = buildSvc();
      const url = await svc.generateAuthorizationUrl('a', 'u', 'http://127.0.0.1:8080');
      const state = new URL(url).searchParams.get('state')!;
      expect(readPendingBackendUrl(svc, state)).toBe('http://127.0.0.1:8080');
    });

    it('rejects http://[::1]:port (current isAllowedRedirectOrigin compares to "::1", not "[::1]")', async () => {
      // The URL parser returns hostname='[::1]' for IPv6 literals, and the
      // check uses === '::1'. This documents the current behaviour: the
      // IPv6 loopback path is effectively dead code today. A future patch
      // that strips the brackets should flip this test.
      const svc = buildSvc();
      const url = await svc.generateAuthorizationUrl('a', 'u', 'http://[::1]:3001');
      const state = new URL(url).searchParams.get('state')!;
      expect(readPendingBackendUrl(svc, state)).toBe('');
    });

    it('accepts loopback hosts on non-standard ports', async () => {
      const svc = buildSvc();
      const url = await svc.generateAuthorizationUrl('a', 'u', 'http://localhost:54321');
      const state = new URL(url).searchParams.get('state')!;
      expect(readPendingBackendUrl(svc, state)).toBe('http://localhost:54321');
    });

    it('accepts https://localhost without rewriting the scheme', async () => {
      const svc = buildSvc();
      const url = await svc.generateAuthorizationUrl('a', 'u', 'https://localhost:3001');
      const state = new URL(url).searchParams.get('state')!;
      expect(readPendingBackendUrl(svc, state)).toBe('https://localhost:3001');
    });

    it('replaces a non-loopback http origin with empty string', async () => {
      const svc = buildSvc();
      const url = await svc.generateAuthorizationUrl('a', 'u', 'http://attacker.com');
      const state = new URL(url).searchParams.get('state')!;
      expect(readPendingBackendUrl(svc, state)).toBe('');
    });

    it('replaces a non-loopback https origin with empty string', async () => {
      const svc = buildSvc();
      const url = await svc.generateAuthorizationUrl('a', 'u', 'https://evil.example.com');
      const state = new URL(url).searchParams.get('state')!;
      expect(readPendingBackendUrl(svc, state)).toBe('');
    });

    it('rejects an origin that LOOKS like localhost via subdomain trickery', async () => {
      const svc = buildSvc();
      const url = await svc.generateAuthorizationUrl('a', 'u', 'http://localhost.attacker.com');
      const state = new URL(url).searchParams.get('state')!;
      expect(readPendingBackendUrl(svc, state)).toBe('');
    });

    it('rejects an origin that embeds localhost in user-info', async () => {
      const svc = buildSvc();
      // The URL parser puts "localhost" in userinfo, hostname is "attacker.com".
      const url = await svc.generateAuthorizationUrl('a', 'u', 'http://localhost@attacker.com');
      const state = new URL(url).searchParams.get('state')!;
      expect(readPendingBackendUrl(svc, state)).toBe('');
    });

    it('stores empty string when backendUrl is undefined', async () => {
      const svc = buildSvc();
      const url = await svc.generateAuthorizationUrl('a', 'u', undefined);
      const state = new URL(url).searchParams.get('state')!;
      expect(readPendingBackendUrl(svc, state)).toBe('');
    });

    it('stores empty string when backendUrl is an empty string', async () => {
      const svc = buildSvc();
      const url = await svc.generateAuthorizationUrl('a', 'u', '');
      const state = new URL(url).searchParams.get('state')!;
      expect(readPendingBackendUrl(svc, state)).toBe('');
    });

    it('stores empty string when backendUrl is a malformed URL', async () => {
      const svc = buildSvc();
      const url = await svc.generateAuthorizationUrl('a', 'u', 'not-a-url');
      const state = new URL(url).searchParams.get('state')!;
      expect(readPendingBackendUrl(svc, state)).toBe('');
    });

    it('stores empty string for a missing-scheme URL', async () => {
      const svc = buildSvc();
      const url = await svc.generateAuthorizationUrl('a', 'u', '//localhost:3001');
      const state = new URL(url).searchParams.get('state')!;
      expect(readPendingBackendUrl(svc, state)).toBe('');
    });

    it('stores empty string for a javascript: URL', async () => {
      const svc = buildSvc();
      const url = await svc.generateAuthorizationUrl('a', 'u', 'javascript:alert(document.cookie)');
      const state = new URL(url).searchParams.get('state')!;
      expect(readPendingBackendUrl(svc, state)).toBe('');
    });

    it('stores empty string for a file:// URL', async () => {
      const svc = buildSvc();
      const url = await svc.generateAuthorizationUrl('a', 'u', 'file:///etc/passwd');
      const state = new URL(url).searchParams.get('state')!;
      expect(readPendingBackendUrl(svc, state)).toBe('');
    });

    it('stores empty string for a data: URL with embedded localhost', async () => {
      const svc = buildSvc();
      const url = await svc.generateAuthorizationUrl(
        'a',
        'u',
        'data:text/html,<script>fetch("http://localhost:1234")</script>',
      );
      const state = new URL(url).searchParams.get('state')!;
      expect(readPendingBackendUrl(svc, state)).toBe('');
    });

    it('stores empty string for an attacker URL where localhost appears in the path', async () => {
      const svc = buildSvc();
      const url = await svc.generateAuthorizationUrl('a', 'u', 'http://attacker.com/localhost');
      const state = new URL(url).searchParams.get('state')!;
      expect(readPendingBackendUrl(svc, state)).toBe('');
    });
  });
});
