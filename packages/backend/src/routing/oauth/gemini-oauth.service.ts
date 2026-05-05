import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, createHash } from 'crypto';
import { createServer, IncomingMessage, ServerResponse, Server } from 'http';
import { ProviderService } from '../routing-core/provider.service';
import { ModelDiscoveryService } from '../../model-discovery/model-discovery.service';
import { scrubSecrets } from '../../common/utils/secret-scrub';
import {
  PendingOAuth,
  OAuthTokenBlob,
  oauthDoneHtml,
  parseOAuthTokenBlob,
} from './openai-oauth.types';

/**
 * The Gemini CLI ships its own "Desktop / installed application" OAuth
 * credentials inside `@google/gemini-cli-core`. Operators that want
 * Manifest to use those same credentials should set them via env vars:
 *
 *   GOOGLE_GEMINI_CLIENT_ID
 *   GOOGLE_GEMINI_CLIENT_SECRET
 *
 * (The Gemini CLI's source for finding them is
 *  `github.com/google-gemini/gemini-cli` →
 *  `packages/core/src/code_assist/oauth2.ts`.)
 *
 * We intentionally don't bundle them in the source tree — Google's
 * Desktop OAuth secret is "public by design" but GitHub secret scanning
 * still flags it, and shipping it here would prevent any operator from
 * running their own audited build.
 */

const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const CODE_ASSIST_BASE = 'https://cloudcode-pa.googleapis.com';

const SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/cloud-platform',
].join(' ');

// Gemini CLI uses a random localhost port; we use a fixed loopback port so
// the redirect URI is stable in dev and matches the OpenAI subscription
// pattern. Port 1456 is one above the OpenAI callback (1455) to avoid
// collisions when both flows are exercised in the same dev session.
const CALLBACK_PORT = 1456;
const REDIRECT_URI = `http://localhost:${CALLBACK_PORT}/oauth/callback`;
const STATE_TTL_MS = 10 * 60 * 1000;

interface CodeAssistTier {
  id?: string;
  isDefault?: boolean;
}

interface CodeAssistDiscoveryResponse {
  cloudaicompanionProject?: string;
  currentTier?: CodeAssistTier;
  allowedTiers?: CodeAssistTier[];
}

// Tier identifiers used by the Code Assist gateway. Mirrors the gemini-cli
// `UserTierId` enum (packages/core/src/code_assist/types.ts) — sending the
// right tier in `onboardUser` is required for the call to succeed; the
// gateway returns 400 when `tierId` is omitted or set to an unknown value.
const TIER_FREE = 'free-tier';
const TIER_STANDARD = 'standard-tier';
const TIER_LEGACY = 'legacy-tier';

interface CodeAssistOnboardLro {
  done?: boolean;
  name?: string;
  response?: { cloudaicompanionProject?: { id?: string } };
}

@Injectable()
export class GeminiOauthService {
  private readonly logger = new Logger(GeminiOauthService.name);
  /** In-memory pending OAuth flows (not safe behind a load balancer). */
  private readonly pending = new Map<string, PendingOAuth>();
  private callbackServer: Server | null = null;
  private serverReady: Promise<void> | null = null;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly useCallbackServer: boolean;

  constructor(
    private readonly providerService: ProviderService,
    private readonly configService: ConfigService,
    private readonly discoveryService: ModelDiscoveryService,
  ) {
    this.clientId = this.configService.get<string>('GOOGLE_GEMINI_CLIENT_ID') ?? '';
    this.clientSecret = this.configService.get<string>('GOOGLE_GEMINI_CLIENT_SECRET') ?? '';
    // Loopback callback only runs in development. Production deployments
    // (cloud, Docker self-hosted) must configure their own GOOGLE_GEMINI_*
    // credentials with their public domain registered as a redirect URI;
    // in that environment Manifest's frontend posts the code+state to the
    // /callback endpoint instead of relying on a loopback listener.
    this.useCallbackServer =
      (this.configService.get<string>('app.nodeEnv') ?? 'development') !== 'production';
  }

  /** True when the operator has supplied OAuth credentials via env vars. */
  isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  async generateAuthorizationUrl(
    agentId: string,
    userId: string,
    backendUrl?: string,
  ): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error(
        'Google OAuth is not configured. Set GOOGLE_GEMINI_CLIENT_ID and GOOGLE_GEMINI_CLIENT_SECRET in the environment.',
      );
    }
    this.cleanupExpired();
    const state = randomBytes(32).toString('hex');
    const verifier = randomBytes(32).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');
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
      scope: SCOPES,
      // `offline` is required to receive a refresh_token from Google; without
      // it the callback returns only a short-lived access_token and the
      // proxy starts hitting 401s after an hour.
      access_type: 'offline',
      // `consent` forces Google to re-issue a refresh_token even if the user
      // has previously granted the scopes. Without this Google's token
      // endpoint silently omits `refresh_token` on subsequent flows.
      prompt: 'consent',
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
        client_secret: this.clientSecret,
        code_verifier: pending.verifier,
      }),
    });
    if (!response.ok) {
      const text = await response.text();
      this.logger.error(`Gemini token exchange failed: ${scrubSecrets(text)}`);
      throw new Error('Token exchange failed');
    }
    const data = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };
    if (!data.refresh_token) {
      throw new Error(
        'Google did not return a refresh_token. Re-authorize with prompt=consent and access_type=offline.',
      );
    }
    const projectId = await this.resolveCodeAssistProject(data.access_token);
    const blob: OAuthTokenBlob = {
      t: data.access_token,
      r: data.refresh_token,
      e: Date.now() + data.expires_in * 1000,
    };
    if (projectId) blob.u = projectId;
    const { provider: savedProvider } = await this.providerService.upsertProvider(
      pending.agentId,
      pending.userId,
      'gemini',
      JSON.stringify(blob),
      'subscription',
    );
    try {
      await this.discoveryService.discoverModels(savedProvider);
      await this.providerService.recalculateTiers(pending.agentId);
    } catch (err) {
      this.logger.warn(`Model discovery after Gemini OAuth failed: ${err}`);
    }
    this.logger.log(
      `Gemini OAuth token stored for agent=${pending.agentId} (project=${projectId || 'none'})`,
    );
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
        client_secret: this.clientSecret,
      }),
    });
    if (!response.ok) {
      const text = await response.text();
      this.logger.error(`Gemini token refresh failed: ${scrubSecrets(text)}`);
      throw new Error('Token refresh failed');
    }
    const data = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };
    return {
      t: data.access_token,
      // Google rotates refresh_tokens infrequently; reuse the previous one
      // when the response omits a new one, otherwise we'd lose the ability
      // to refresh after the next access_token expires.
      r: data.refresh_token || refreshToken,
      e: Date.now() + data.expires_in * 1000,
    };
  }

  /**
   * Parse an OAuth blob and return a refreshed-if-needed copy. The Code
   * Assist proxy needs both the access token (for Bearer auth) and the
   * project id (for the request envelope), so we return the full blob
   * shape. `proxy-fallback.service.resolveApiKey` extracts both fields.
   *
   * If the persisted blob is missing the project id (e.g. Code Assist
   * onboarding 400'd at OAuth time, or Google completed onboarding only
   * after the popup closed), we lazily re-run project discovery here and
   * persist the result so subsequent proxy calls get a working envelope.
   */
  async unwrapToken(
    rawValue: string,
    agentId: string,
    userId: string,
  ): Promise<OAuthTokenBlob | null> {
    const blob = parseOAuthTokenBlob(rawValue);
    if (!blob) return null;
    let working = blob;
    if (Date.now() >= blob.e - 60_000) {
      try {
        working = await this.refreshAccessToken(blob.r);
        // Preserve the project id across refreshes — the refresh response
        // doesn't include it and Code Assist still expects it on every call.
        if (blob.u && !working.u) working.u = blob.u;
        this.logger.log(`Gemini OAuth token refreshed for agent=${agentId}`);
      } catch (err) {
        this.logger.error(`Failed to refresh Gemini token for agent=${agentId}: ${err}`);
        return null;
      }
    }
    if (!working.u) {
      const projectId = await this.resolveCodeAssistProject(working.t);
      if (projectId) {
        working = { ...working, u: projectId };
        this.logger.log(
          `Gemini Code Assist project resolved lazily for agent=${agentId} (project=${projectId})`,
        );
      }
    }
    if (working !== blob) {
      await this.providerService.upsertProvider(
        agentId,
        userId,
        'gemini',
        JSON.stringify(working),
        'subscription',
      );
    }
    return working;
  }

  /** Revoke an OAuth token at Google (best-effort). */
  async revokeToken(token: string): Promise<void> {
    try {
      const response = await fetch(`${REVOKE_URL}?token=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      if (!response.ok) {
        const text = await response.text();
        this.logger.warn(`Gemini token revocation failed: ${scrubSecrets(text)}`);
      } else {
        this.logger.log('Gemini OAuth token revoked');
      }
    } catch (err) {
      this.logger.warn(`Gemini token revocation error: ${err}`);
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

  /**
   * Discover the user's Cloud project via the Code Assist API, provisioning
   * a managed project if none exists. Mirrors the `loadCodeAssist` →
   * `onboardUser` LRO sequence the Gemini CLI uses on first run.
   *
   * Returns the project id, or an empty string when discovery fails. An
   * empty project id is acceptable for free-tier callers; AI Pro / Ultra
   * subscribers will receive their managed project on the second invocation
   * after onboarding completes server-side.
   */
  async resolveCodeAssistProject(accessToken: string): Promise<string> {
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    };
    const metadata = {
      ideType: 'IDE_UNSPECIFIED',
      platform: 'PLATFORM_UNSPECIFIED',
      pluginType: 'GEMINI',
    };
    try {
      const res = await fetch(`${CODE_ASSIST_BASE}/v1internal:loadCodeAssist`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ metadata }),
      });
      if (!res.ok) {
        this.logger.warn(`Code Assist project discovery returned ${res.status}`);
        return '';
      }
      const data = (await res.json()) as CodeAssistDiscoveryResponse;
      if (data.cloudaicompanionProject) return data.cloudaicompanionProject;
      const tierId = pickOnboardTierId(data);
      return await this.onboardCodeAssistUser(headers, metadata, tierId);
    } catch (err) {
      this.logger.warn(`Gemini project discovery failed: ${err}`);
      return '';
    }
  }

  private async onboardCodeAssistUser(
    headers: Record<string, string>,
    metadata: Record<string, string>,
    tierId: string,
  ): Promise<string> {
    // The CLI shape: { tierId, cloudaicompanionProject?, metadata }. For
    // free-tier accounts the gateway provisions a managed project — passing
    // `cloudaicompanionProject: undefined` (omitted from the body) is the
    // documented way to request that.
    const body: Record<string, unknown> = { tierId, metadata };
    try {
      const res = await fetch(`${CODE_ASSIST_BASE}/v1internal:onboardUser`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        this.logger.warn(`Code Assist onboarding returned ${res.status}`);
        return '';
      }
      let lro = (await res.json()) as CodeAssistOnboardLro;
      // Poll the long-running operation up to ~30 seconds. Onboarding is
      // typically instant for AI Pro / Ultra accounts; free-tier accounts
      // sometimes take a few seconds while Google provisions a project.
      for (let i = 0; i < 6 && !lro.done && lro.name; i++) {
        await new Promise((r) => setTimeout(r, 5000));
        const poll = await fetch(`${CODE_ASSIST_BASE}/v1internal/${lro.name}`, { headers });
        if (!poll.ok) break;
        lro = (await poll.json()) as CodeAssistOnboardLro;
      }
      return lro.response?.cloudaicompanionProject?.id ?? '';
    } catch (err) {
      this.logger.warn(`Gemini onboarding failed: ${err}`);
      return '';
    }
  }

  /** Spins up an HTTP server on the loopback port to receive the OAuth callback. */
  private ensureCallbackServer(): Promise<void> {
    if (this.callbackServer) return Promise.resolve();
    if (this.serverReady) return this.serverReady;
    this.serverReady = new Promise<void>((resolve, reject) => {
      const server = createServer((req, res) => this.handleCallbackRequest(req, res));
      server.on('error', (err: NodeJS.ErrnoException) => {
        this.callbackServer = null;
        this.serverReady = null;
        if (err.code === 'EADDRINUSE') {
          this.logger.warn(`Port ${CALLBACK_PORT} in use — Gemini callback server not started`);
          reject(
            new Error(
              `Port ${CALLBACK_PORT} is already in use. Run 'lsof -i :${CALLBACK_PORT}' to find the process.`,
            ),
          );
        } else {
          this.logger.error(`Gemini callback server error: ${err.message}`);
          reject(new Error(`Callback server failed: ${err.message}`));
        }
      });
      server.listen(CALLBACK_PORT, '127.0.0.1', () => {
        this.logger.log(`Gemini OAuth callback server listening on port ${CALLBACK_PORT}`);
        this.callbackServer = server;
        resolve();
      });
      server.unref();
    });
    return this.serverReady;
  }

  private handleCallbackRequest(req: IncomingMessage, res: ServerResponse): void {
    const url = new URL(req.url ?? '/', `http://localhost:${CALLBACK_PORT}`);
    if (url.pathname !== '/oauth/callback') {
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
      this.logger.error(`Gemini OAuth callback error: ${desc}`);
      this.pending.delete(state);
      this.shutdownCallbackServerIfIdle();
      this.sendDoneResponse(res, false, appUrl);
      return;
    }
    this.exchangeCode(state, code)
      .then(() => this.sendDoneResponse(res, true, appUrl))
      .catch((err) => {
        this.logger.error(`Gemini OAuth callback failed: ${err}`);
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
      res.writeHead(302, { Location: `${appUrl}/api/v1/oauth/gemini/done?ok=${ok}` });
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
      this.logger.log('Gemini OAuth callback server shut down (no pending flows)');
    }
  }

  private cleanupExpired(): void {
    const now = Date.now();
    for (const [key, val] of this.pending) {
      if (val.expiresAt < now) this.pending.delete(key);
    }
  }
}

/**
 * Pick the tier id to send in `onboardUser`, mirroring the gemini-cli
 * resolution order: prefer the gateway-reported current tier, then any
 * `allowedTier` flagged as default, finally fall back to STANDARD.
 */
export function pickOnboardTierId(data: CodeAssistDiscoveryResponse): string {
  if (data.currentTier?.id) return data.currentTier.id;
  const defaultAllowed = data.allowedTiers?.find((t) => t.isDefault && t.id);
  if (defaultAllowed?.id) return defaultAllowed.id;
  const firstAllowed = data.allowedTiers?.find((t) => t.id);
  if (firstAllowed?.id) return firstAllowed.id;
  return TIER_STANDARD;
}

export const __codeAssistTierIds = {
  FREE: TIER_FREE,
  STANDARD: TIER_STANDARD,
  LEGACY: TIER_LEGACY,
};
