import { Injectable, Logger } from '@nestjs/common';
import { randomBytes, createHash } from 'crypto';
import { createServer, IncomingMessage, ServerResponse, Server } from 'http';
import { RoutingService } from './routing.service';

const CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann';
const AUTHORIZE_URL = 'https://auth.openai.com/oauth/authorize';
const TOKEN_URL = 'https://auth.openai.com/oauth/token';
const REVOKE_URL = 'https://auth.openai.com/oauth/revoke';
const SCOPE = 'openid profile email offline_access';
const CALLBACK_PORT = 1455;
const REDIRECT_URI = `http://localhost:${CALLBACK_PORT}/auth/callback`;
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export interface PendingOAuth {
  verifier: string;
  agentId: string;
  userId: string;
  backendUrl: string;
  expiresAt: number;
}

export interface OAuthTokenBlob {
  /** access token */
  t: string;
  /** refresh token */
  r: string;
  /** expires at (epoch ms) */
  e: number;
}

@Injectable()
export class OpenaiOauthService {
  private readonly logger = new Logger(OpenaiOauthService.name);
  private readonly pending = new Map<string, PendingOAuth>();
  private callbackServer: Server | null = null;
  private serverReady: Promise<void> | null = null;

  constructor(private readonly routingService: RoutingService) {}

  async generateAuthorizationUrl(
    agentId: string,
    userId: string,
    backendUrl?: string,
  ): Promise<string> {
    this.cleanupExpired();

    const state = randomBytes(32).toString('hex');
    const verifier = randomBytes(32).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');

    this.pending.set(state, {
      verifier,
      agentId,
      userId,
      backendUrl: backendUrl ?? '',
      expiresAt: Date.now() + STATE_TTL_MS,
    });

    await this.ensureCallbackServer();

    const params = new URLSearchParams({
      client_id: CLIENT_ID,
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
        client_id: CLIENT_ID,
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

    await this.routingService.upsertProvider(
      pending.agentId,
      pending.userId,
      'openai',
      JSON.stringify(blob),
      'subscription',
    );

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
        client_id: CLIENT_ID,
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
          client_id: CLIENT_ID,
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
          reject(new Error(`Port ${CALLBACK_PORT} is already in use. Close the process using it.`));
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

export function oauthDoneHtml(success: boolean): string {
  const message = success ? 'manifest-oauth-success' : 'manifest-oauth-error';
  const text = success
    ? 'Login successful!'
    : 'Login failed. Please close this window and try again.';

  return `<!DOCTYPE html>
<html>
<head><title>Manifest — OpenAI Login</title></head>
<body style="font-family:system-ui;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;background:#111;color:#eee;">
<p>${text}</p>
<p id="hint" style="font-size:13px;color:#888;display:none;">You can close this window.</p>
<script>
try{var bc=new BroadcastChannel('manifest-oauth');bc.postMessage({type:'${message}'});bc.close();}catch(e){}
if(window.opener){window.opener.postMessage({type:'${message}'},'*');}
setTimeout(function(){window.close();document.getElementById('hint').style.display='block';},1500);
</script>
</body>
</html>`;
}
