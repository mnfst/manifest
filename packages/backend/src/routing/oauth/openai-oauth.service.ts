import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, createHash } from 'crypto';
import { createServer, IncomingMessage, ServerResponse, Server } from 'http';
import { ProviderService } from '../routing-core/provider.service';
import { ModelDiscoveryService } from '../../model-discovery/model-discovery.service';
import { scrubSecrets } from '../../common/utils/secret-scrub';
import { PendingOAuth, OAuthTokenBlob, oauthDoneHtml } from './openai-oauth.types';

export { PendingOAuth, OAuthTokenBlob, oauthDoneHtml };

const DEFAULT_CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann';
const AUTHORIZE_URL = 'https://auth.openai.com/oauth/authorize';
const TOKEN_URL = 'https://auth.openai.com/oauth/token';
const REVOKE_URL = 'https://auth.openai.com/oauth/revoke';
const SCOPE = 'openid profile email offline_access';
const CALLBACK_PORT = 1455;
const REDIRECT_URI = `http://localhost:${CALLBACK_PORT}/auth/callback`;
const STATE_TTL_MS = 10 * 60 * 1000;
// RFC 8693 token exchange constants. The grant takes an id_token that
// carries the user's OpenAI organization_id and returns a real API key
// that bills against their ChatGPT subscription. Without
// id_token_add_organizations=true at /authorize, the id_token has no
// organization_id and the exchange would fail.
const TOKEN_EXCHANGE_GRANT = 'urn:ietf:params:oauth:grant-type:token-exchange';
const ID_TOKEN_TYPE = 'urn:ietf:params:oauth:token-type:id_token';
const REQUESTED_TOKEN = 'openai-api-key';

@Injectable()
export class OpenaiOauthService {
  private readonly logger = new Logger(OpenaiOauthService.name);
  /** In-memory pending OAuth flows (not safe behind a load balancer). */
  private readonly pending = new Map<string, PendingOAuth>();
  private callbackServer: Server | null = null;
  private serverReady: Promise<void> | null = null;
  private readonly clientId: string;
  private readonly useCallbackServer: boolean;

  constructor(
    private readonly providerService: ProviderService,
    private readonly configService: ConfigService,
    private readonly discoveryService: ModelDiscoveryService,
  ) {
    this.clientId = this.configService.get<string>('OPENAI_OAUTH_CLIENT_ID') ?? DEFAULT_CLIENT_ID;
    // Loopback callback server runs only in development. Production
    // deployments (Docker self-hosted and cloud) complete the OAuth flow
    // through the server's public URL instead.
    this.useCallbackServer =
      (this.configService.get<string>('app.nodeEnv') ?? 'development') !== 'production';
  }

  async generateAuthorizationUrl(
    agentId: string,
    userId: string,
    backendUrl?: string,
  ): Promise<string> {
    this.cleanupExpired();
    const state = randomBytes(32).toString('hex');
    const verifier = randomBytes(32).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    // Validate the redirect target now (at storage time) instead of trusting
    // it on the way out. The callback server only ever redirects to
    // localhost-shaped origins, so anything else is dropped here.
    const safeBackendUrl = backendUrl && this.isAllowedRedirectOrigin(backendUrl) ? backendUrl : '';
    this.pending.set(state, {
      verifier,
      agentId,
      userId,
      backendUrl: safeBackendUrl,
      expiresAt: Date.now() + STATE_TTL_MS,
    });
    if (this.useCallbackServer) {
      await this.ensureCallbackServer();
    }
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: SCOPE,
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      // Required for the RFC 8693 token exchange in exchangeIdTokenForApiKey:
      // without id_token_add_organizations the id_token has no organization_id
      // claim and the exchange returns invalid_subject_token.
      id_token_add_organizations: 'true',
      codex_cli_simplified_flow: 'true',
    });
    return `${AUTHORIZE_URL}?${params.toString()}`;
  }

  async exchangeCode(state: string, code: string): Promise<void> {
    const pending = this.pending.get(state);
    if (!pending) throw new Error('Invalid or expired OAuth state');
    if (pending.expiresAt < Date.now()) {
      this.pending.delete(state);
      throw new Error('OAuth state expired');
    }
    this.pending.delete(state);
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        client_id: this.clientId,
        code_verifier: pending.verifier,
      }),
    });
    if (!response.ok) {
      const text = await response.text();
      this.logger.error(`OpenAI token exchange failed: ${scrubSecrets(text)}`);
      throw new Error('Token exchange failed');
    }
    const data = (await response.json()) as {
      id_token: string;
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };
    const blob = await this.mintApiKeyBlob(data.id_token, data.refresh_token);
    const { provider: savedProvider } = await this.providerService.upsertProvider(
      pending.agentId,
      pending.userId,
      'openai',
      JSON.stringify(blob),
      'subscription',
    );
    try {
      await this.discoveryService.discoverModels(savedProvider);
      await this.providerService.recalculateTiers(pending.agentId);
    } catch (err) {
      this.logger.warn(`Model discovery after OAuth failed: ${err}`);
    }
    this.logger.log(`OpenAI OAuth token stored for agent=${pending.agentId}`);
    this.shutdownCallbackServerIfIdle();
  }

  async refreshAccessToken(refreshToken: string): Promise<OAuthTokenBlob> {
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: this.clientId,
      }),
    });
    if (!response.ok) {
      const text = await response.text();
      this.logger.error(`OpenAI token refresh failed: ${scrubSecrets(text)}`);
      throw new Error('Token refresh failed');
    }
    const data = (await response.json()) as {
      id_token: string;
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };
    return this.mintApiKeyBlob(data.id_token, data.refresh_token || refreshToken);
  }

  /**
   * RFC 8693 token exchange — converts the OAuth id_token (which carries
   * the user's organization_id) into a real OpenAI API key bound to that
   * organization. The minted key bills against the user's ChatGPT plan and
   * works against api.openai.com with the full Responses API surface.
   */
  private async exchangeIdTokenForApiKey(idToken: string): Promise<{
    apiKey: string;
    expiresAt: number;
  }> {
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: TOKEN_EXCHANGE_GRANT,
        client_id: this.clientId,
        subject_token: idToken,
        subject_token_type: ID_TOKEN_TYPE,
        requested_token: REQUESTED_TOKEN,
      }),
    });
    if (!response.ok) {
      const text = await response.text();
      this.logger.error(`OpenAI API key exchange failed: ${scrubSecrets(text)}`);
      throw new Error('API key exchange failed');
    }
    const data = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
    };
    if (!data.access_token) {
      throw new Error('API key exchange returned no access_token');
    }
    // expires_in is optional in the response; fall back to a 1h conservative
    // lifetime so unwrapToken refreshes on a sane cadence.
    const lifetimeMs = (data.expires_in ?? 3600) * 1000;
    return { apiKey: data.access_token, expiresAt: Date.now() + lifetimeMs };
  }

  /**
   * Run the token exchange and pack the result into the storage blob shape.
   * The minted API key lands in `t` so existing consumers (proxy bearer,
   * model discovery) read it transparently.
   */
  private async mintApiKeyBlob(idToken: string, refreshToken: string): Promise<OAuthTokenBlob> {
    if (!idToken) throw new Error('OAuth response missing id_token');
    const { apiKey, expiresAt } = await this.exchangeIdTokenForApiKey(idToken);
    return { t: apiKey, r: refreshToken, e: expiresAt };
  }

  /** Parse an OAuth blob and return a valid access token, refreshing if expired. */
  async unwrapToken(rawValue: string, agentId: string, userId: string): Promise<string | null> {
    let blob: OAuthTokenBlob;
    try {
      blob = JSON.parse(rawValue) as OAuthTokenBlob;
    } catch {
      return null;
    }
    if (!blob.t || !blob.r || !blob.e) return null;
    if (Date.now() < blob.e - 60_000) return blob.t;
    try {
      const refreshed = await this.refreshAccessToken(blob.r);
      await this.providerService.upsertProvider(
        agentId,
        userId,
        'openai',
        JSON.stringify(refreshed),
        'subscription',
      );
      this.logger.log(`OpenAI OAuth token refreshed for agent=${agentId}`);
      return refreshed.t;
    } catch (err) {
      this.logger.error(`Failed to refresh OpenAI token for agent=${agentId}: ${err}`);
      return null;
    }
  }

  /** Revoke an OAuth token at OpenAI (best-effort). */
  async revokeToken(token: string): Promise<void> {
    try {
      const response = await fetch(REVOKE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token, client_id: this.clientId }),
      });
      if (!response.ok) {
        const text = await response.text();
        this.logger.warn(`OpenAI token revocation failed: ${scrubSecrets(text)}`);
      } else {
        this.logger.log('OpenAI OAuth token revoked');
      }
    } catch (err) {
      this.logger.warn(`OpenAI token revocation error: ${err}`);
    }
  }

  /** Returns the number of pending OAuth states (for testing). */
  getPendingCount(): number {
    return this.pending.size;
  }

  /** Remove a pending OAuth state. */
  clearPendingState(state: string): void {
    this.pending.delete(state);
  }

  /** Spins up an HTTP server on port 1455 to receive the OAuth callback. */
  private ensureCallbackServer(): Promise<void> {
    if (this.callbackServer) return Promise.resolve();
    if (this.serverReady) return this.serverReady;
    this.serverReady = new Promise<void>((resolve, reject) => {
      const server = createServer((req, res) => this.handleCallbackRequest(req, res));
      server.on('error', (err: NodeJS.ErrnoException) => {
        this.callbackServer = null;
        this.serverReady = null;
        if (err.code === 'EADDRINUSE') {
          this.logger.warn(`Port ${CALLBACK_PORT} in use — callback server not started`);
          reject(
            new Error(
              `Port ${CALLBACK_PORT} is already in use. Run 'lsof -i :${CALLBACK_PORT}' to find the process.`,
            ),
          );
        } else {
          this.logger.error(`Callback server error: ${err.message}`);
          reject(new Error(`Callback server failed: ${err.message}`));
        }
      });
      server.listen(CALLBACK_PORT, '127.0.0.1', () => {
        this.logger.log(`OAuth callback server listening on port ${CALLBACK_PORT}`);
        this.callbackServer = server;
        resolve();
      });
      server.unref();
    });
    return this.serverReady;
  }

  private handleCallbackRequest(req: IncomingMessage, res: ServerResponse): void {
    const url = new URL(req.url ?? '/', `http://localhost:${CALLBACK_PORT}`);
    if (url.pathname !== '/auth/callback') {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const code = url.searchParams.get('code') ?? '';
    const state = url.searchParams.get('state') ?? '';
    const error = url.searchParams.get('error');
    const appUrl = this.pending.get(state)?.backendUrl || '';
    if (error) {
      const desc = url.searchParams.get('error_description') ?? error;
      this.logger.error(`OAuth callback error from provider: ${desc}`);
      this.pending.delete(state);
      this.shutdownCallbackServerIfIdle();
      this.sendDoneResponse(res, false, appUrl);
      return;
    }
    this.exchangeCode(state, code)
      .then(() => this.sendDoneResponse(res, true, appUrl))
      .catch((err) => {
        this.logger.error(`OAuth callback failed: ${err}`);
        this.sendDoneResponse(res, false, appUrl);
      });
  }

  private isAllowedRedirectOrigin(url: string): boolean {
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname;
      return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
    } catch {
      return false;
    }
  }

  private sendDoneResponse(res: ServerResponse, success: boolean, appUrl: string): void {
    if (appUrl && this.isAllowedRedirectOrigin(appUrl)) {
      const ok = success ? '1' : '0';
      res.writeHead(302, { Location: `${appUrl}/api/v1/oauth/openai/done?ok=${ok}` });
      res.end();
    } else {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(oauthDoneHtml(success));
    }
  }

  private shutdownCallbackServerIfIdle(): void {
    if (this.pending.size === 0 && this.callbackServer) {
      this.callbackServer.close();
      this.callbackServer = null;
      this.serverReady = null;
      this.logger.log('OAuth callback server shut down (no pending flows)');
    }
  }

  private cleanupExpired(): void {
    const now = Date.now();
    for (const [key, val] of this.pending) {
      if (val.expiresAt < now) this.pending.delete(key);
    }
  }
}
