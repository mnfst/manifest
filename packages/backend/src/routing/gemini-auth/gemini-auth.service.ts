import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPES = 'openid email https://www.googleapis.com/auth/generative-language';

@Injectable()
export class GeminiAuthService {
  private readonly logger = new Logger(GeminiAuthService.name);

  /** In-memory cache for access tokens (keyed by refresh token). */
  private readonly tokenCache = new Map<string, { accessToken: string; expiresAt: number }>();

  getClientId(): string {
    return process.env['GOOGLE_GEMINI_CLIENT_ID'] || process.env['GOOGLE_CLIENT_ID'] || '';
  }

  private getClientSecret(): string {
    return process.env['GOOGLE_GEMINI_CLIENT_SECRET'] || process.env['GOOGLE_CLIENT_SECRET'] || '';
  }

  isConfigured(): boolean {
    return !!(this.getClientId() && this.getClientSecret());
  }

  /** Build the Google OAuth consent URL. */
  buildAuthUrl(callbackUrl: string, state: string): string {
    const params = new URLSearchParams({
      client_id: this.getClientId(),
      redirect_uri: callbackUrl,
      response_type: 'code',
      scope: SCOPES,
      access_type: 'offline',
      prompt: 'consent',
      state,
    });
    return `${GOOGLE_AUTH_URL}?${params.toString()}`;
  }

  /** Generate a random state token for CSRF protection. */
  generateState(): string {
    return randomBytes(16).toString('hex');
  }

  /** Exchange an authorization code for tokens. Returns the refresh token. */
  async exchangeCode(code: string, callbackUrl: string): Promise<string> {
    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.getClientId(),
        client_secret: this.getClientSecret(),
        code,
        grant_type: 'authorization_code',
        redirect_uri: callbackUrl,
      }).toString(),
    });

    if (!res.ok) {
      const text = await res.text();
      this.logger.warn(`Google token exchange failed: ${res.status} ${text}`);
      throw new Error('Failed to exchange authorization code');
    }

    const data = (await res.json()) as {
      refresh_token?: string;
      access_token: string;
      expires_in: number;
    };

    if (!data.refresh_token) {
      throw new Error('No refresh token returned. Re-authorize with prompt=consent.');
    }

    return data.refresh_token;
  }

  /** Get a fresh access token from a refresh token (cached for 50 minutes). */
  async getAccessToken(refreshToken: string): Promise<string> {
    const cached = this.tokenCache.get(refreshToken);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.accessToken;
    }

    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.getClientId(),
        client_secret: this.getClientSecret(),
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }).toString(),
    });

    if (!res.ok) {
      const text = await res.text();
      this.logger.warn(`Google token refresh failed: ${res.status} ${text}`);
      throw new Error('Failed to refresh access token');
    }

    const data = (await res.json()) as { access_token: string; expires_in: number };
    const expiresAt = Date.now() + (data.expires_in - 600) * 1000; // 10-min safety margin
    this.tokenCache.set(refreshToken, { accessToken: data.access_token, expiresAt });

    return data.access_token;
  }
}
