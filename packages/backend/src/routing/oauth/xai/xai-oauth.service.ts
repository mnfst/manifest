import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createServer, IncomingMessage, Server, ServerResponse } from 'http';
import { ProviderService } from '../../routing-core/provider.service';
import { ModelDiscoveryService } from '../../../model-discovery/model-discovery.service';
import { scrubSecrets } from '../../../common/utils/secret-scrub';
import {
  coordinateOAuthRefresh,
  generatePkce,
  generateState,
  oauthDoneHtml,
  oauthRefreshKey,
  parseOAuthTokenBlob,
  PendingStore,
  serializeOAuthTokenBlob,
  type OAuthTokenBlob,
} from '../core';

interface PendingXaiOAuth {
  verifier: string;
  agentId: string;
  userId: string;
  backendUrl: string;
  expiresAt: number;
}

const DEFAULT_CLIENT_ID = 'b1a00492-073a-47ea-816f-4c329264a828';
const AUTHORIZE_URL = 'https://auth.x.ai/oauth2/authorize';
const TOKEN_URL = 'https://auth.x.ai/oauth2/token';
const REVOKE_URL = 'https://auth.x.ai/oauth2/revoke';
const SCOPE = 'openid profile email offline_access grok-cli:access api:access';
const CALLBACK_PORT = 56121;
const REDIRECT_URI = `http://127.0.0.1:${CALLBACK_PORT}/callback`;
const STATE_TTL_MS = 10 * 60 * 1000;

@Injectable()
export class XaiOauthService {
  private readonly logger = new Logger(XaiOauthService.name);
  private readonly pending = new PendingStore<PendingXaiOAuth>(STATE_TTL_MS);
  private callbackServer: Server | null = null;
  private serverReady: Promise<void> | null = null;
  private readonly clientId: string;
  private readonly useCallbackServer: boolean;

  constructor(
    private readonly providerService: ProviderService,
    private readonly configService: ConfigService,
    private readonly discoveryService: ModelDiscoveryService,
  ) {
    this.clientId = this.configService.get<string>('XAI_OAUTH_CLIENT_ID') ?? DEFAULT_CLIENT_ID;
    this.useCallbackServer =
      (this.configService.get<string>('app.nodeEnv') ?? 'development') !== 'production';
  }

  async generateAuthorizationUrl(
    agentId: string,
    userId: string,
    backendUrl?: string,
  ): Promise<string> {
    const state = generateState();
    const nonce = generateState(16);
    const { verifier, challenge } = generatePkce();
    const safeBackendUrl = backendUrl && this.isAllowedRedirectOrigin(backendUrl) ? backendUrl : '';
    this.pending.set(state, {
      verifier,
      agentId,
      userId,
      backendUrl: safeBackendUrl,
    });
    if (this.useCallbackServer) {
      await this.ensureCallbackServer();
    }
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: REDIRECT_URI,
      scope: SCOPE,
      state,
      nonce,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    });
    return `${AUTHORIZE_URL}?${params.toString()}`;
  }

  async exchangeCode(state: string, code: string): Promise<void> {
    const pending = this.pending.peek(state);
    if (!pending) throw new Error('Invalid or expired OAuth state');
    if (pending.expiresAt < Date.now()) {
      this.pending.delete(state);
      throw new Error('OAuth state expired');
    }
    this.pending.delete(state);

    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
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
      this.logger.error(`xAI token exchange failed: ${scrubSecrets(text)}`);
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
    const label = await this.providerService.nextOAuthLabel(pending.agentId, 'xai');
    const { provider: savedProvider } = await this.providerService.upsertProvider(
      pending.agentId,
      pending.userId,
      'xai',
      serializeOAuthTokenBlob(blob),
      'subscription',
      undefined,
      label,
    );
    try {
      await this.discoveryService.discoverModels(savedProvider);
      await this.providerService.recalculateTiers(pending.agentId);
    } catch (err) {
      this.logger.warn(`Model discovery after xAI OAuth failed: ${err}`);
    }
    this.logger.log(`xAI OAuth token stored for agent=${pending.agentId}`);
    this.shutdownCallbackServerIfIdle();
  }

  async refreshAccessToken(refreshToken: string): Promise<OAuthTokenBlob> {
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: this.clientId,
      }),
    });
    if (!response.ok) {
      const text = await response.text();
      this.logger.error(`xAI token refresh failed: ${scrubSecrets(text)}`);
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

  async unwrapToken(
    rawValue: string,
    agentId: string,
    userId: string,
    keyLabel?: string,
  ): Promise<string | null> {
    const blob = parseOAuthTokenBlob(rawValue);
    if (!blob) return null;
    if (Date.now() < blob.e - 60_000) return blob.t;
    try {
      const resolved = await coordinateOAuthRefresh<OAuthTokenBlob>({
        key: oauthRefreshKey('xai', userId, agentId, keyLabel),
        logger: this.logger,
        callerBlob: blob,
        readFreshRaw: () =>
          this.providerService.getFreshSubscriptionCredential(agentId, 'xai', keyLabel),
        parse: parseOAuthTokenBlob,
        refresh: (current) => this.refreshAccessToken(current.r),
        persist: (refreshed) =>
          this.providerService
            .upsertProvider(
              agentId,
              userId,
              'xai',
              serializeOAuthTokenBlob(refreshed),
              'subscription',
              undefined,
              keyLabel,
            )
            .then(() => undefined),
      });
      return resolved.t;
    } catch (err) {
      this.logger.error(`Failed to refresh xAI token for agent=${agentId}: ${err}`);
      return null;
    }
  }

  async revokeToken(token: string): Promise<void> {
    try {
      const response = await fetch(REVOKE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: new URLSearchParams({ token, client_id: this.clientId }),
      });
      if (!response.ok) {
        const text = await response.text();
        this.logger.warn(`xAI token revocation failed: ${scrubSecrets(text)}`);
      } else {
        this.logger.log('xAI OAuth token revoked');
      }
    } catch (err) {
      this.logger.warn(`xAI token revocation error: ${err}`);
    }
  }

  getPendingCount(): number {
    return this.pending.size();
  }

  private ensureCallbackServer(): Promise<void> {
    if (this.callbackServer) return Promise.resolve();
    if (this.serverReady) return this.serverReady;
    this.serverReady = new Promise<void>((resolve, reject) => {
      const server = createServer((req, res) => this.handleCallbackRequest(req, res));
      server.on('error', (err: NodeJS.ErrnoException) => {
        this.callbackServer = null;
        this.serverReady = null;
        if (err.code === 'EADDRINUSE') {
          this.logger.warn(`Port ${CALLBACK_PORT} in use - xAI callback server not started`);
          reject(
            new Error(
              `Port ${CALLBACK_PORT} is already in use. Run 'lsof -i :${CALLBACK_PORT}' to find the process.`,
            ),
          );
        } else {
          this.logger.error(`xAI callback server error: ${err.message}`);
          reject(new Error(`Callback server failed: ${err.message}`));
        }
      });
      server.listen(CALLBACK_PORT, '127.0.0.1', () => {
        this.logger.log(`xAI OAuth callback server listening on port ${CALLBACK_PORT}`);
        this.callbackServer = server;
        resolve();
      });
      server.unref();
    });
    return this.serverReady;
  }

  private handleCallbackRequest(req: IncomingMessage, res: ServerResponse): void {
    const url = new URL(req.url ?? '/', `http://127.0.0.1:${CALLBACK_PORT}`);
    if (url.pathname !== '/callback') {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const code = url.searchParams.get('code') ?? '';
    const state = url.searchParams.get('state') ?? '';
    const error = url.searchParams.get('error');
    const appUrl = this.pending.peek(state)?.backendUrl || '';
    if (error) {
      const desc = url.searchParams.get('error_description') ?? error;
      this.logger.error(`xAI OAuth callback error from provider: ${desc}`);
      this.pending.delete(state);
      this.shutdownCallbackServerIfIdle();
      this.sendDoneResponse(res, false, appUrl);
      return;
    }
    this.exchangeCode(state, code)
      .then(() => this.sendDoneResponse(res, true, appUrl))
      .catch((err) => {
        this.logger.error(`xAI OAuth callback failed: ${err}`);
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
      res.writeHead(302, { Location: `${appUrl}/api/v1/oauth/xai/done?ok=${ok}` });
      res.end();
    } else {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(oauthDoneHtml(success, undefined, 'xAI Login'));
    }
  }

  private shutdownCallbackServerIfIdle(): void {
    if (this.pending.isEmpty() && this.callbackServer) {
      this.callbackServer.close();
      this.callbackServer = null;
      this.serverReady = null;
      this.logger.log('xAI OAuth callback server shut down (no pending flows)');
    }
  }
}
