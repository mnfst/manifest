import { Injectable, Logger } from '@nestjs/common';
import { ProviderService } from '../../routing-core/provider.service';
import { ModelDiscoveryService } from '../../../model-discovery/model-discovery.service';
import { scrubSecrets } from '../../../common/utils/secret-scrub';
import {
  generatePkce,
  OAuthPendingFlowStore,
  parseOAuthTokenBlob,
  serializeOAuthTokenBlob,
  type OAuthTokenBlob,
} from '../core';
import { ANTHROPIC_OAUTH } from './anthropic-oauth.config';

export interface AuthorizeResult {
  url: string;
  state: string;
}

interface AnthropicTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type?: string;
}

const PROVIDER = 'anthropic';

/**
 * Splits Anthropic's pasted authorization payload. The redirect page renders
 * `<code>#<state>` for users to copy verbatim, but tolerant clients should
 * also accept just the code with the state passed alongside.
 */
export function splitAnthropicAuthPayload(payload: string): { code: string; state?: string } {
  const trimmed = payload.trim();
  const hashIdx = trimmed.indexOf('#');
  if (hashIdx === -1) return { code: trimmed };
  return {
    code: trimmed.slice(0, hashIdx),
    state: trimmed.slice(hashIdx + 1) || undefined,
  };
}

@Injectable()
export class AnthropicOauthService {
  private readonly logger = new Logger(AnthropicOauthService.name);

  constructor(
    private readonly providerService: ProviderService,
    private readonly discoveryService: ModelDiscoveryService,
    private readonly pendingFlows: OAuthPendingFlowStore,
  ) {}

  /**
   * Build the authorize URL the user opens in a new tab. The state is also
   * returned so the SPA can pre-fill it on the paste-code step.
   */
  async generateAuthorizationUrl(agentId: string, userId: string): Promise<AuthorizeResult> {
    const { verifier, challenge } = generatePkce();
    // Claude Code's Anthropic OAuth flow uses the PKCE verifier as state.
    const state = verifier;
    await this.pendingFlows.create(
      PROVIDER,
      { state, verifier, agentId, userId },
      ANTHROPIC_OAUTH.STATE_TTL_MS,
    );

    const params = new URLSearchParams({
      code: 'true',
      client_id: ANTHROPIC_OAUTH.CLIENT_ID,
      response_type: 'code',
      redirect_uri: ANTHROPIC_OAUTH.REDIRECT_URI,
      scope: ANTHROPIC_OAUTH.SCOPE,
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    });
    return { url: `${ANTHROPIC_OAUTH.AUTHORIZE_URL}?${params.toString()}`, state };
  }

  /**
   * Exchange the pasted authorization code for an OAuth token blob.
   * `payload` may be either the bare code or the `<code>#<state>` form
   * Anthropic's redirect page displays.
   */
  async exchangeCode(
    payload: string,
    fallbackState: string | undefined,
    agentId: string,
    userId: string,
  ): Promise<void> {
    const { code, state: extractedState } = splitAnthropicAuthPayload(payload);
    let state = extractedState ?? fallbackState;
    if (!code) throw new Error('Missing authorization code');
    if (!state) {
      const latest = await this.pendingFlows.findLatestForAgent(PROVIDER, agentId, userId);
      state = latest?.state;
    }
    if (!state) throw new Error('Missing OAuth state');

    const pending = await this.pendingFlows.consume(PROVIDER, state, agentId, userId);
    if (!pending) throw new Error('Invalid or expired OAuth state');
    if (pending.expiresAt < Date.now()) {
      throw new Error('OAuth state expired');
    }

    const response = await fetch(ANTHROPIC_OAUTH.TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        state,
        client_id: ANTHROPIC_OAUTH.CLIENT_ID,
        redirect_uri: ANTHROPIC_OAUTH.REDIRECT_URI,
        code_verifier: pending.verifier,
      }),
    });
    if (!response.ok) {
      const text = await response.text();
      this.logger.error(`Anthropic token exchange failed: ${scrubSecrets(text)}`);
      throw new Error('Token exchange failed');
    }
    const data = (await response.json()) as AnthropicTokenResponse;
    const blob: OAuthTokenBlob = {
      t: data.access_token,
      r: data.refresh_token ?? '',
      e: Date.now() + data.expires_in * 1000,
    };

    const label = await this.providerService.nextOAuthLabel(pending.agentId, PROVIDER);
    const { provider: savedProvider } = await this.providerService.upsertProvider(
      pending.agentId,
      pending.userId,
      PROVIDER,
      serializeOAuthTokenBlob(blob),
      'subscription',
      undefined,
      label,
    );
    try {
      await this.discoveryService.discoverModels(savedProvider);
      await this.providerService.recalculateTiers(pending.agentId);
    } catch (err) {
      this.logger.warn(`Model discovery after Anthropic OAuth failed: ${err}`);
    }
    this.logger.log(`Anthropic OAuth token stored for agent=${pending.agentId}`);
  }

  async refreshAccessToken(refreshToken: string): Promise<OAuthTokenBlob> {
    const response = await fetch(ANTHROPIC_OAUTH.TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: ANTHROPIC_OAUTH.CLIENT_ID,
      }),
    });
    if (!response.ok) {
      const text = await response.text();
      this.logger.error(`Anthropic token refresh failed: ${scrubSecrets(text)}`);
      throw new Error('Token refresh failed');
    }
    const data = (await response.json()) as AnthropicTokenResponse;
    return {
      t: data.access_token,
      r: data.refresh_token || refreshToken,
      e: Date.now() + data.expires_in * 1000,
    };
  }

  /**
   * Resolve a stored credential to a usable bearer token.
   *
   * Two storage shapes are accepted:
   *   - JSON OAuth blob (from the in-app OAuth flow) — refreshed when stale.
   *   - Plain string (from the legacy `claude setup-token` paste flow) —
   *     returned as-is, since those tokens have no refresh counterpart.
   */
  async unwrapToken(rawValue: string, agentId: string, userId: string): Promise<string | null> {
    const blob = parseOAuthTokenBlob(rawValue);
    if (!blob) {
      // Legacy setup-token paste — keep working until the user reconnects.
      return rawValue || null;
    }
    if (Date.now() < blob.e - 60_000) return blob.t;
    if (!blob.r) {
      // OAuth blob without a refresh token — should not happen, but fall back
      // to the access token rather than nuking the user's session.
      return blob.t;
    }
    try {
      const refreshed = await this.refreshAccessToken(blob.r);
      await this.providerService.upsertProvider(
        agentId,
        userId,
        'anthropic',
        serializeOAuthTokenBlob(refreshed),
        'subscription',
      );
      this.logger.log(`Anthropic OAuth token refreshed for agent=${agentId}`);
      return refreshed.t;
    } catch (err) {
      this.logger.error(`Failed to refresh Anthropic token for agent=${agentId}: ${err}`);
      return null;
    }
  }

  getPendingCount(): Promise<number> {
    return this.pendingFlows.count(PROVIDER);
  }

  async clearPendingState(state: string): Promise<void> {
    await this.pendingFlows.clear(PROVIDER, state);
  }

  /**
   * Returns the active pending state for an agent if one exists, so the
   * frontend can re-render the paste-code field after the modal was closed
   * or the page reloaded mid-flow. Only the `state` is returned — the PKCE
   * verifier stays server-side.
   */
  async findPendingForAgent(agentId: string, userId: string): Promise<{ state: string } | null> {
    const pending = await this.pendingFlows.findLatestForAgent(PROVIDER, agentId, userId);
    return pending ? { state: pending.state } : null;
  }
}
