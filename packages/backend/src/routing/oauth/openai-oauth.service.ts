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
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };
    const blob: OAuthTokenBlob = {
      t: data.access_token,
      r: data.refresh_token,
      e: Date.now() + data.expires_in * 1000,
    };
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
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };
    return {
      t: data.access_token,
      r: data.refresh_token || refreshToken,
      e: Date.now() + data.expires_in * 1000,
    };
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
