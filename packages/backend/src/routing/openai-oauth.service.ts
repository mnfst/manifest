import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, createHash } from 'crypto';
import { createServer, IncomingMessage, ServerResponse, Server } from 'http';
import { RoutingService } from './routing.service';
import { ModelDiscoveryService } from './model-discovery/model-discovery.service';
import { PendingOAuth, OAuthTokenBlob, oauthDoneHtml } from './openai-oauth.types';

export { PendingOAuth, OAuthTokenBlob, oauthDoneHtml };

const DEFAULT_CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann';
const AUTHORIZE_URL = 'https://auth.openai.com/oauth/authorize';
const TOKEN_URL = 'https://auth.openai.com/oauth/token';
const REVOKE_URL = 'https://auth.openai.com/oauth/revoke';
const SCOPE = 'openid profile email offline_access';
const CALLBACK_PORT = 1455;
const LOCAL_REDIRECT_URI = `http://localhost:${CALLBACK_PORT}/auth/callback`;
const CALLBACK_PATH = '/api/v1/oauth/openai/callback';
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

@Injectable()
export class OpenaiOauthService {
  private readonly logger = new Logger(OpenaiOauthService.name);
  /**
   * In-memory state for pending OAuth flows. Not safe for multi-instance
   * deployments behind a load balancer — the callback must arrive at the
   * same instance that initiated the flow.
   */
  private readonly pending = new Map<string, PendingOAuth>();
  private callbackServer: Server | null = null;
  private serverReady: Promise<void> | null = null;

  private readonly clientId: string;

  constructor(
    private readonly routingService: RoutingService,
    private readonly configService: ConfigService,
    private readonly discoveryService: ModelDiscoveryService,
  ) {
    this.clientId = this.configService.get<string>('OPENAI_OAUTH_CLIENT_ID') ?? DEFAULT_CLIENT_ID;
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

    // In production (backendUrl provided), the callback goes to the backend itself.
    // In local mode (no backendUrl), an ephemeral server on port 1455 handles it.
    const redirectUri = backendUrl ? `${backendUrl}${CALLBACK_PATH}` : LOCAL_REDIRECT_URI;

    this.pending.set(state, {
      verifier,
      agentId,
      userId,
      backendUrl: backendUrl ?? '',
      redirectUri,
      expiresAt: Date.now() + STATE_TTL_MS,
    });

    if (!backendUrl) {
      await this.ensureCallbackServer();
    }

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
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
        redirect_uri: pending.redirectUri,
        client_id: this.clientId,
        code_verifier: pending.verifier,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      this.logger.error(`OpenAI token exchange failed: ${text}`);
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

    const { provider: savedProvider } = await this.routingService.upsertProvider(
      pending.agentId,
      pending.userId,
      'openai',
      JSON.stringify(blob),
      'subscription',
    );

    // Discover models so tier auto-assignment has data
    try {
      await this.discoveryService.discoverModels(savedProvider);
      await this.routingService.recalculateTiers(pending.agentId);
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
      this.logger.error(`OpenAI token refresh failed: ${text}`);
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

  /**
   * Parse an OAuth JSON blob and return a valid access token,
   * refreshing if the token is expired or about to expire (within 60s).
   * Returns null if the value is not an OAuth blob.
   */
  async unwrapToken(rawValue: string, agentId: string, userId: string): Promise<string | null> {
    let blob: OAuthTokenBlob;
    try {
      blob = JSON.parse(rawValue) as OAuthTokenBlob;
    } catch {
      return null; // Not a JSON blob — plain API key
    }

    if (!blob.t || !blob.r || !blob.e) return null;

    // Token still valid (with 60s buffer)
    if (Date.now() < blob.e - 60_000) return blob.t;

    // Refresh the token
    try {
      const refreshed = await this.refreshAccessToken(blob.r);
      await this.routingService.upsertProvider(
        agentId,
        userId,
        'openai',
        JSON.stringify(refreshed),
        'subscription',
      );
      this.logger.log(`OpenAI OAuth token refreshed for agent=${agentId}`);
      return refreshed.t;
    } catch (err) {
      this.logger.error(`Failed to refresh OpenAI token: ${err}`);
      // Return the existing token — it might still work
      return blob.t;
    }
  }

  /**
   * Revoke an OAuth token at OpenAI.
   * Best-effort: logs a warning on failure but does not throw.
   */
  async revokeToken(token: string): Promise<void> {
    try {
      const response = await fetch(REVOKE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          token,
          client_id: this.clientId,
        }),
      });
      if (!response.ok) {
        const text = await response.text();
        this.logger.warn(`OpenAI token revocation failed: ${text}`);
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

  /** Remove a pending OAuth state (e.g., when the provider returns an error). */
  clearPendingState(state: string): void {
    this.pending.delete(state);
  }

  /**
   * Spins up a tiny HTTP server on port 1455 to receive the OAuth callback.
   * OpenAI's registered redirect_uri for this client_id is
   * http://localhost:1455/auth/callback — we must listen there.
   * Throws if the port is unavailable so the controller can surface the error.
   */
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

      server.unref(); // Don't prevent process exit
    });

    return this.serverReady;
  }

  /** Handles an incoming OAuth callback request on the ephemeral server. */
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
    // Read backendUrl before exchangeCode deletes the pending entry
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

  /** Sends the OAuth completion response — either a redirect or inline HTML. */
  private sendDoneResponse(res: ServerResponse, success: boolean, appUrl: string): void {
    if (appUrl) {
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
