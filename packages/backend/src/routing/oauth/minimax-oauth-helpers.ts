import { OAuthTokenBlob } from './openai-oauth.types';
import { normalizeMinimaxSubscriptionBaseUrl } from '../provider-base-url';

export const MINIMAX_BASE_URLS = {
  global: 'https://api.minimax.io',
  cn: 'https://api.minimaxi.com',
} as const;

export type MinimaxRegion = keyof typeof MINIMAX_BASE_URLS;

export const DEFAULT_REGION: MinimaxRegion = 'global';
export const DEFAULT_BASE_URL = MINIMAX_BASE_URLS[DEFAULT_REGION];
export const DEFAULT_RESOURCE_URL = `${DEFAULT_BASE_URL}/anthropic`;
export const ABSOLUTE_TIME_THRESHOLD_MS = 10_000_000_000;
export const DEFAULT_POLL_INTERVAL_MS = 2000;

export function isMinimaxRegion(value: string | undefined): value is MinimaxRegion {
  return value === 'global' || value === 'cn';
}

export function getMinimaxBaseUrl(region: MinimaxRegion = DEFAULT_REGION): string {
  return MINIMAX_BASE_URLS[region];
}

export function buildMinimaxCodeUrl(baseUrl: string): string {
  return `${baseUrl}/oauth/code`;
}

export function buildMinimaxTokenUrl(baseUrl: string): string {
  return `${baseUrl}/oauth/token`;
}

export function buildMinimaxResourceUrl(baseUrl: string): string {
  return `${baseUrl}/anthropic`;
}

export function getMinimaxResourceUrl(resourceUrl?: string): string | null {
  if (!resourceUrl) return null;
  return normalizeMinimaxSubscriptionBaseUrl(resourceUrl);
}

export function getMinimaxOauthBaseUrl(resourceUrl?: string): string {
  const normalized = getMinimaxResourceUrl(resourceUrl);
  if (!normalized) return DEFAULT_BASE_URL;
  return new URL(normalized).origin;
}

export function toAbsoluteExpiryTimestamp(expiredIn: number): number {
  if (expiredIn > ABSOLUTE_TIME_THRESHOLD_MS) return expiredIn;
  return Date.now() + expiredIn * 1000;
}

export function toPollIntervalMs(interval?: number): number {
  if (!interval || interval <= 0) return DEFAULT_POLL_INTERVAL_MS;
  return interval >= 1000 ? interval : interval * 1000;
}

export function isOAuthTokenBlob(value: unknown): value is OAuthTokenBlob {
  if (!value || typeof value !== 'object') return false;
  const blob = value as Record<string, unknown>;
  return (
    typeof blob.t === 'string' &&
    typeof blob.r === 'string' &&
    typeof blob.e === 'number' &&
    Number.isFinite(blob.e) &&
    (blob.u === undefined || typeof blob.u === 'string')
  );
}
