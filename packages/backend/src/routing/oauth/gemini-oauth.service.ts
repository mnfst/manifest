import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import { ProviderService } from '../routing-core/provider.service';
import { ModelDiscoveryService } from '../../model-discovery/model-discovery.service';
import { OAuthTokenBlob, parseOAuthTokenBlob } from './openai-oauth.types';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const SCOPES =
  'openid email https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile';
const STATE_TTL_MS = 10 * 60 * 1000;

/**
 * Default OAuth credentials extracted at runtime from the installed Gemini CLI package.
 * Users can override via GOOGLE_GEMINI_CLIENT_ID / GOOGLE_GEMINI_CLIENT_SECRET env vars.
 */
import { readFileSync } from 'fs';
import { dirname, join } from 'path';

function extractGeminiCliCredentials(): { clientId: string; clientSecret: string } {
  try {
    const cliCorePath = require.resolve('@google/gemini-cli-core/package.json');
    const oauth2Path = join(dirname(cliCorePath), 'dist/src/code_assist/oauth2.js');
    const content = readFileSync(oauth2Path, 'utf-8');
    const idMatch = content.match(/(\d{12,}-[a-z0-9]+\.apps\.googleusercontent\.com)/);
    const secretMatch = content.match(/(GOCSPX-[A-Za-z0-9_-]+)/);
    if (idMatch && secretMatch) {
      return { clientId: idMatch[1], clientSecret: secretMatch[1] };
    }
  } catch {
    // Gemini CLI not installed — credentials must be provided via env vars
  }
  return { clientId: '', clientSecret: '' };
}

const GEMINI_CLI_CREDS = extractGeminiCliCredentials();

interface PendingGeminiOAuth {
  verifier: string;
  agentId: string;
  userId: string;
  callbackUrl: string;
  expiresAt: number;
}

@Injectable()
export class GeminiOauthService {
  private readonly logger = new Logger(GeminiOauthService.name);
  private readonly pending = new Map<string, PendingGeminiOAuth>();
  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor(
    private readonly providerService: ProviderService,
    private readonly configService: ConfigService,
    private readonly discoveryService: ModelDiscoveryService,
  ) {
    this.clientId =
      this.configService.get<string>('GOOGLE_GEMINI_CLIENT_ID') ??
      this.configService.get<string>('GOOGLE_CLIENT_ID') ??
      GEMINI_CLI_CREDS.clientId;
    this.clientSecret =
      this.configService.get<string>('GOOGLE_GEMINI_CLIENT_SECRET') ??
      this.configService.get<string>('GOOGLE_CLIENT_SECRET') ??
      GEMINI_CLI_CREDS.clientSecret;
  }

  isConfigured(): boolean {
    return !!(this.clientId && this.clientSecret);
  }

  async generateAuthorizationUrl(
    agentId: string,
    userId: string,
    callbackUrl: string,
  ): Promise<string> {
    this.cleanupExpired();
    const state = randomBytes(32).toString('hex');
    const verifier = randomBytes(32).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    this.pending.set(state, {
      verifier,
      agentId,
      userId,
      callbackUrl,
      expiresAt: Date.now() + STATE_TTL_MS,
    });
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: callbackUrl,
      response_type: 'code',
      scope: SCOPES,
      access_type: 'offline',
      prompt: 'consent',
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    });
    return `${GOOGLE_AUTH_URL}?${params.toString()}`;
  }

  async exchangeCode(state: string, code: string): Promise<void> {
    const pending = this.pending.get(state);
    if (!pending) throw new Error('Invalid or expired OAuth state');
    if (pending.expiresAt < Date.now()) {
      this.pending.delete(state);
      throw new Error('OAuth state expired');
    }
    this.pending.delete(state);
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: pending.callbackUrl,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code_verifier: pending.verifier,
      }),
    });
    if (!response.ok) {
      const text = await response.text();
      this.logger.error(`Gemini token exchange failed: ${text}`);
      throw new Error('Token exchange failed');
    }
    const data = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };
    if (!data.refresh_token) {
      throw new Error('No refresh token returned. Re-authorize with prompt=consent.');
    }

    // Discover the user's Cloud project via the Code Assist API (same as Gemini CLI)
    const projectId = await this.discoverProject(data.access_token);

    const blob: OAuthTokenBlob = {
      t: data.access_token,
      r: data.refresh_token,
      e: Date.now() + data.expires_in * 1000,
      u: projectId,
    };
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
    this.logger.log(`Gemini OAuth token stored for agent=${pending.agentId}`);
  }

  async refreshAccessToken(refreshToken: string): Promise<OAuthTokenBlob> {
    const response = await fetch(GOOGLE_TOKEN_URL, {
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
      this.logger.error(`Gemini token refresh failed: ${text}`);
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
  ): Promise<OAuthTokenBlob | null> {
    const blob = parseOAuthTokenBlob(rawValue);
    if (!blob) return null;
    if (Date.now() < blob.e - 60_000) return blob;
    try {
      const refreshed = await this.refreshAccessToken(blob.r);
      // Preserve the project ID from the original blob
      refreshed.u = refreshed.u ?? blob.u;
      await this.providerService.upsertProvider(
        agentId,
        userId,
        'gemini',
        JSON.stringify(refreshed),
        'subscription',
      );
      this.logger.log(`Gemini OAuth token refreshed for agent=${agentId}`);
      return refreshed;
    } catch (err) {
      this.logger.error(`Failed to refresh Gemini token: ${err}`);
      return blob;
    }
  }

  async revokeToken(token: string): Promise<void> {
    try {
      const response = await fetch(`${GOOGLE_REVOKE_URL}?token=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      if (!response.ok) {
        const text = await response.text();
        this.logger.warn(`Gemini token revocation failed: ${text}`);
      } else {
        this.logger.log('Gemini OAuth token revoked');
      }
    } catch (err) {
      this.logger.warn(`Gemini token revocation error: ${err}`);
    }
  }

  getPendingCount(): number {
    return this.pending.size;
  }

  clearPendingState(state: string): void {
    this.pending.delete(state);
  }

  /**
   * Discover the user's Google Cloud project via the Code Assist API.
   * If the user hasn't been onboarded yet, provisions a project automatically.
   * Same approach as the Gemini CLI and OpenClaw.
   */
  async discoverProject(accessToken: string): Promise<string> {
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
      const res = await fetch('https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist', {
        method: 'POST',
        headers,
        body: JSON.stringify({ metadata }),
      });
      if (!res.ok) {
        this.logger.warn(`Code Assist project discovery returned ${res.status}`);
        return '';
      }
      const data = (await res.json()) as {
        cloudaicompanionProject?: string;
        currentTier?: { id?: string };
      };
      if (data.cloudaicompanionProject) {
        this.logger.log(`Discovered Gemini project: ${data.cloudaicompanionProject}`);
        return data.cloudaicompanionProject;
      }

      // No project yet — onboard the user (provisions a managed GCP project)
      this.logger.log('No Gemini project found, onboarding user...');
      return this.onboardUser(headers, metadata);
    } catch (err) {
      this.logger.warn(`Gemini project discovery failed: ${err}`);
      return '';
    }
  }

  private async onboardUser(
    headers: Record<string, string>,
    metadata: Record<string, string>,
  ): Promise<string> {
    try {
      const res = await fetch('https://cloudcode-pa.googleapis.com/v1internal:onboardUser', {
        method: 'POST',
        headers,
        body: JSON.stringify({ metadata }),
      });
      if (!res.ok) {
        this.logger.warn(`Code Assist onboarding returned ${res.status}`);
        return '';
      }
      let lro = (await res.json()) as {
        done?: boolean;
        name?: string;
        response?: { cloudaicompanionProject?: { id?: string } };
      };

      // Poll the long-running operation until done (up to 30s)
      if (!lro.done && lro.name) {
        this.logger.log(`Onboarding LRO started: ${lro.name}`);
        for (let i = 0; i < 6 && !lro.done; i++) {
          await new Promise((r) => setTimeout(r, 5000));
          const poll = await fetch(`https://cloudcode-pa.googleapis.com/v1internal/${lro.name}`, {
            headers,
          });
          if (!poll.ok) break;
          lro = (await poll.json()) as typeof lro;
        }
      }

      const projectId = lro.response?.cloudaicompanionProject?.id ?? '';
      if (projectId) {
        this.logger.log(`Onboarded Gemini project: ${projectId}`);
      } else {
        this.logger.warn('Onboarding completed but no project ID returned');
      }
      return projectId;
    } catch (err) {
      this.logger.warn(`Gemini onboarding failed: ${err}`);
      return '';
    }
  }

  private cleanupExpired(): void {
    const now = Date.now();
    for (const [key, val] of this.pending) {
      if (val.expiresAt < now) this.pending.delete(key);
    }
  }
}
