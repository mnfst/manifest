import { Injectable, Logger } from '@nestjs/common';

const TOKEN_ENDPOINT = 'https://api.github.com/copilot_internal/v2/token';

/** Safety margin: refresh 2 minutes before actual expiry. */
const EXPIRY_BUFFER_MS = 2 * 60 * 1000;

interface CachedToken {
  token: string;
  expiresAt: number;
}

/**
 * Exchanges a long-lived GitHub OAuth token for a short-lived Copilot API
 * token, caching the result until it nears expiry.
 *
 * Protocol (per OpenClaw / @github/copilot-sdk):
 *   1. POST https://api.github.com/copilot_internal/v2/token
 *      Header: Authorization: token <github_oauth_token>
 *   2. Response: { "token": "tid=...", "expires_at": <unix_seconds> }
 *   3. Use the returned token as Bearer auth against api.githubcopilot.com
 */
@Injectable()
export class CopilotTokenService {
  private readonly logger = new Logger(CopilotTokenService.name);

  /** Cache keyed by the GitHub OAuth token. */
  private readonly cache = new Map<string, CachedToken>();

  /**
   * Get a valid Copilot API token for the given GitHub OAuth token.
   * Returns the cached token if still valid, otherwise exchanges a new one.
   */
  async getCopilotToken(githubToken: string): Promise<string> {
    const cached = this.cache.get(githubToken);
    if (cached && Date.now() < cached.expiresAt - EXPIRY_BUFFER_MS) {
      return cached.token;
    }

    this.evictExpired();
    const result = await this.exchange(githubToken);
    this.cache.set(githubToken, result);
    return result.token;
  }

  /** Remove entries whose Copilot tokens have already expired. */
  private evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now >= entry.expiresAt) this.cache.delete(key);
    }
  }

  private async exchange(githubToken: string): Promise<CachedToken> {
    const res = await fetch(TOKEN_ENDPOINT, {
      method: 'GET',
      headers: {
        Authorization: `token ${githubToken}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      this.logger.warn(`Copilot token exchange failed: ${res.status} ${body}`);
      throw new Error(`Copilot token exchange failed: ${res.status}`);
    }

    const data = (await res.json()) as { token: string; expires_at: number };
    if (!data.token || !data.expires_at) {
      throw new Error('Invalid Copilot token exchange response');
    }

    this.logger.debug(
      `Copilot token exchanged, expires at ${new Date(data.expires_at * 1000).toISOString()}`,
    );

    return {
      token: data.token,
      expiresAt: data.expires_at * 1000,
    };
  }
}
