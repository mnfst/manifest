import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { RoutingService } from './routing.service';
import { ModelDiscoveryService } from './model-discovery/model-discovery.service';
import { OAuthTokenBlob } from './openai-oauth.types';

const MINIMAX_BASE_URLS = {
  global: 'https://api.minimax.io',
  cn: 'https://api.minimaxi.com',
} as const;
const DEFAULT_REGION = 'global';
const DEFAULT_BASE_URL = MINIMAX_BASE_URLS[DEFAULT_REGION];
const DEFAULT_CLIENT_ID = '78257093-7e40-4613-99e0-527b14b39113';
const DEFAULT_RESOURCE_URL = `${DEFAULT_BASE_URL}/anthropic`;
const SCOPE = 'group_id profile model.completion';
const USER_CODE_GRANT_TYPE = 'urn:ietf:params:oauth:grant-type:user_code';
const DEFAULT_POLL_INTERVAL_MS = 2000;
const ABSOLUTE_TIME_THRESHOLD_MS = 10_000_000_000;

export type MinimaxRegion = keyof typeof MINIMAX_BASE_URLS;

interface PendingMinimaxOAuth {
  verifier: string;
  userCode: string;
  agentId: string;
  userId: string;
  baseUrl: string;
  resourceUrl: string;
  expiresAt: number;
  pollIntervalMs: number;
}

interface MinimaxCodeResponse {
  user_code: string;
  verification_uri: string;
  expired_in: number;
  interval?: number;
  state: string;
  error?: string;
}

interface MinimaxTokenResponse {
  status?: string;
  access_token?: string | null;
  refresh_token?: string | null;
  expired_in?: number | null;
  resource_url?: string;
  notification_message?: string;
  base_resp?: { status_code?: number; status_msg?: string };
}

export interface MinimaxOAuthStartResult {
  flowId: string;
  userCode: string;
  verificationUri: string;
  expiresAt: number;
  pollIntervalMs: number;
}

export interface MinimaxOAuthPollResult {
  status: 'pending' | 'success' | 'error';
  message?: string;
  pollIntervalMs?: number;
}

function isMinimaxRegion(value: string | undefined): value is MinimaxRegion {
  return value === 'global' || value === 'cn';
}

function getMinimaxBaseUrl(region: MinimaxRegion = DEFAULT_REGION): string {
  return MINIMAX_BASE_URLS[region];
}

function buildMinimaxCodeUrl(baseUrl: string): string {
  return `${baseUrl}/oauth/code`;
}

function buildMinimaxTokenUrl(baseUrl: string): string {
  return `${baseUrl}/oauth/token`;
}

function buildMinimaxResourceUrl(baseUrl: string): string {
  return `${baseUrl}/anthropic`;
}

function getMinimaxOauthBaseUrl(resourceUrl?: string): string {
  if (!resourceUrl) return DEFAULT_BASE_URL;
  try {
    return new URL(resourceUrl).origin;
  } catch {
    return DEFAULT_BASE_URL;
  }
}

function toAbsoluteExpiryTimestamp(expiredIn: number): number {
  if (expiredIn > ABSOLUTE_TIME_THRESHOLD_MS) return expiredIn;
  return Date.now() + expiredIn * 1000;
}

function toPollIntervalMs(interval?: number): number {
  if (!interval || interval <= 0) return DEFAULT_POLL_INTERVAL_MS;
  return interval >= 1000 ? interval : interval * 1000;
}

@Injectable()
export class MinimaxOauthService {
  private readonly logger = new Logger(MinimaxOauthService.name);
  private readonly pending = new Map<string, PendingMinimaxOAuth>();
  private readonly clientId: string;

  constructor(
    private readonly routingService: RoutingService,
    private readonly configService: ConfigService,
    private readonly discoveryService: ModelDiscoveryService,
  ) {
    this.clientId = this.configService.get<string>('MINIMAX_OAUTH_CLIENT_ID') ?? DEFAULT_CLIENT_ID;
  }

  async startAuthorization(
    agentId: string,
    userId: string,
    region: MinimaxRegion = DEFAULT_REGION,
  ): Promise<MinimaxOAuthStartResult> {
    this.cleanupExpired();

    const verifier = randomBytes(32).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    const flowId = randomBytes(16).toString('base64url');
    const baseUrl = getMinimaxBaseUrl(region);
    const resourceUrl = buildMinimaxResourceUrl(baseUrl);

    const response = await fetch(buildMinimaxCodeUrl(baseUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        'x-request-id': randomUUID(),
      },
      body: new URLSearchParams({
        response_type: 'code',
        client_id: this.clientId,
        scope: SCOPE,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        state: flowId,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      this.logger.error(`MiniMax OAuth code request failed: ${text}`);
      throw new Error('Failed to start MiniMax OAuth');
    }

    const payload = (await response.json()) as MinimaxCodeResponse;
    if (!payload.user_code || !payload.verification_uri || !payload.expired_in) {
      throw new Error(
        payload.error ?? 'MiniMax OAuth returned an incomplete authorization payload.',
      );
    }
    if (payload.state !== flowId) {
      throw new Error('MiniMax OAuth state mismatch');
    }

    const pollIntervalMs = toPollIntervalMs(payload.interval);
    const expiresAt = toAbsoluteExpiryTimestamp(payload.expired_in);

    this.pending.set(flowId, {
      verifier,
      userCode: payload.user_code,
      agentId,
      userId,
      baseUrl,
      resourceUrl,
      expiresAt,
      pollIntervalMs,
    });

    return {
      flowId,
      userCode: payload.user_code,
      verificationUri: payload.verification_uri,
      expiresAt,
      pollIntervalMs,
    };
  }

  async pollAuthorization(flowId: string, userId: string): Promise<MinimaxOAuthPollResult> {
    this.cleanupExpired();

    const pending = this.pending.get(flowId);
    if (!pending) {
      return { status: 'error', message: 'MiniMax login expired. Start again.' };
    }
    if (pending.userId !== userId) {
      return { status: 'error', message: 'MiniMax login session does not match the current user.' };
    }
    if (Date.now() >= pending.expiresAt) {
      this.pending.delete(flowId);
      return { status: 'error', message: 'MiniMax login expired. Start again.' };
    }

    const response = await fetch(buildMinimaxTokenUrl(pending.baseUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        grant_type: USER_CODE_GRANT_TYPE,
        client_id: this.clientId,
        user_code: pending.userCode,
        code_verifier: pending.verifier,
      }),
    });

    const text = await response.text();
    const payload = this.parseTokenResponse(text);

    if (!response.ok) {
      const message = payload?.base_resp?.status_msg ?? text ?? 'MiniMax OAuth failed';
      this.pending.delete(flowId);
      return { status: 'error', message };
    }

    if (!payload) {
      this.pending.delete(flowId);
      return { status: 'error', message: 'MiniMax OAuth returned an invalid token response.' };
    }

    if (payload.status === 'error') {
      this.pending.delete(flowId);
      return { status: 'error', message: 'MiniMax OAuth failed. Please try again later.' };
    }

    if (payload.status !== 'success') {
      return {
        status: 'pending',
        message: 'Waiting for MiniMax approval…',
        pollIntervalMs: pending.pollIntervalMs,
      };
    }

    if (!payload.access_token || !payload.refresh_token || !payload.expired_in) {
      this.pending.delete(flowId);
      return { status: 'error', message: 'MiniMax OAuth returned an incomplete token payload.' };
    }

    this.pending.delete(flowId);

    const blob: OAuthTokenBlob = {
      t: payload.access_token,
      r: payload.refresh_token,
      e: Date.now() + payload.expired_in * 1000,
      u: payload.resource_url ?? pending.resourceUrl,
    };

    const { provider: savedProvider } = await this.routingService.upsertProvider(
      pending.agentId,
      pending.userId,
      'minimax',
      JSON.stringify(blob),
      'subscription',
    );

    try {
      await this.discoveryService.discoverModels(savedProvider);
      await this.routingService.recalculateTiers(pending.agentId);
    } catch (err) {
      this.logger.warn(`Model discovery after MiniMax OAuth failed: ${err}`);
    }

    this.logger.log(`MiniMax OAuth token stored for agent=${pending.agentId}`);
    return { status: 'success' };
  }

  async refreshAccessToken(refreshToken: string, resourceUrl?: string): Promise<OAuthTokenBlob> {
    const baseUrl = getMinimaxOauthBaseUrl(resourceUrl);
    const response = await fetch(buildMinimaxTokenUrl(baseUrl), {
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
      this.logger.error(`MiniMax token refresh failed: ${text}`);
      throw new Error('Token refresh failed');
    }

    const payload = (await response.json()) as MinimaxTokenResponse;
    if (!payload.access_token || !payload.expired_in) {
      throw new Error('MiniMax token refresh returned an incomplete payload');
    }

    const nextResourceUrl = payload.resource_url ?? resourceUrl ?? buildMinimaxResourceUrl(baseUrl);
    return {
      t: payload.access_token,
      r: payload.refresh_token || refreshToken,
      e: Date.now() + payload.expired_in * 1000,
      ...(nextResourceUrl ? { u: nextResourceUrl } : {}),
    };
  }

  async unwrapToken(
    rawValue: string,
    agentId: string,
    userId: string,
  ): Promise<OAuthTokenBlob | null> {
    let blob: OAuthTokenBlob;
    try {
      blob = JSON.parse(rawValue) as OAuthTokenBlob;
    } catch {
      return null;
    }

    if (!blob.t || !blob.r || !blob.e) return null;
    if (Date.now() < blob.e - 60_000) return blob;

    try {
      const refreshed = await this.refreshAccessToken(blob.r, blob.u);
      await this.routingService.upsertProvider(
        agentId,
        userId,
        'minimax',
        JSON.stringify(refreshed),
        'subscription',
      );
      this.logger.log(`MiniMax OAuth token refreshed for agent=${agentId}`);
      return refreshed;
    } catch (err) {
      this.logger.error(`Failed to refresh MiniMax token: ${err}`);
      return blob;
    }
  }

  getPendingCount(): number {
    return this.pending.size;
  }

  private cleanupExpired(): void {
    const now = Date.now();
    for (const [flowId, pending] of this.pending.entries()) {
      if (pending.expiresAt <= now) this.pending.delete(flowId);
    }
  }

  private parseTokenResponse(text: string): MinimaxTokenResponse | null {
    if (!text) return null;
    try {
      return JSON.parse(text) as MinimaxTokenResponse;
    } catch {
      return null;
    }
  }
}

export { DEFAULT_RESOURCE_URL as MINIMAX_DEFAULT_RESOURCE_URL, isMinimaxRegion };
