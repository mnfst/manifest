/**
 * Kiro authenticates through the AWS SSO OIDC device authorization flow — the
 * same flow `kiro-cli login --use-device-flow` drives. Replicating it
 * server-side (instead of reading the local kiro-cli token cache) is what lets
 * Manifest Cloud connect a Kiro subscription: nothing here touches the local
 * filesystem or a local binary, so it works identically on a laptop and on a
 * shared cloud server.
 *
 * The flow is three public OIDC calls against `https://oidc.<region>.amazonaws.com`:
 *   1. POST /client/register        → { clientId, clientSecret }   (public client)
 *   2. POST /device_authorization   → { deviceCode, userCode, verificationUri… }
 *   3. POST /token (poll)           → { accessToken, refreshToken, expiresIn }
 *
 * The resulting access token is a Bearer credential accepted by Kiro's
 * `q.<region>.amazonaws.com` endpoint (see kiro-adapter.ts). `RegisterClient`
 * issues a per-registration clientId+clientSecret that must be carried through
 * polling AND persisted, because refreshing the access token later requires
 * them again — hence they live on the stored blob alongside the refresh token.
 */

import { toPollIntervalMs as toDeviceFlowPollIntervalMs } from '../core/device-flow';

export const KIRO_OIDC_DEFAULT_REGION = 'us-east-1';
// AWS Builder ID. Google / GitHub social logins are surfaced on this same
// hosted page, so a single start URL covers every Kiro sign-in method.
export const KIRO_DEFAULT_START_URL = 'https://view.awsapps.com/start';
export const KIRO_CLIENT_NAME = 'Manifest';
export const KIRO_CLIENT_TYPE = 'public';
export const KIRO_DEVICE_CODE_GRANT = 'urn:ietf:params:oauth:grant-type:device_code';
export const KIRO_REFRESH_GRANT = 'refresh_token';

// CodeWhisperer / Amazon Q Developer scopes requested by the Kiro CLI device
// flow. Overridable via env (KIRO_OAUTH_SCOPES, comma-separated) in case the
// upstream set shifts before this default is updated.
export const KIRO_DEFAULT_SCOPES: readonly string[] = Object.freeze([
  'codewhisperer:completions',
  'codewhisperer:analysis',
  'codewhisperer:conversations',
  'codewhisperer:taskassist',
  'codewhisperer:transformations',
]);

export const KIRO_REGISTER_GRANT_TYPES: readonly string[] = Object.freeze([
  KIRO_DEVICE_CODE_GRANT,
  KIRO_REFRESH_GRANT,
]);

export const KIRO_DEFAULT_POLL_INTERVAL_MS = 5000;
const KIRO_REGION_PATTERN = /^[a-z]{2}(?:-[a-z0-9]+)+-\d$/;

export function getKiroOidcBaseUrl(region: string = KIRO_OIDC_DEFAULT_REGION): string {
  return `https://oidc.${region}.amazonaws.com`;
}

export function buildKiroRegisterUrl(baseUrl: string): string {
  return `${baseUrl}/client/register`;
}

export function buildKiroDeviceAuthorizationUrl(baseUrl: string): string {
  return `${baseUrl}/device_authorization`;
}

export function buildKiroTokenUrl(baseUrl: string): string {
  return `${baseUrl}/token`;
}

export interface KiroAuthorizationOptions {
  startUrl?: string;
  region?: string;
}

export class KiroAuthorizationOptionsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KiroAuthorizationOptionsError';
  }
}

export function normalizeKiroRegion(region: string): string {
  const normalized = region.trim().toLowerCase();
  if (!KIRO_REGION_PATTERN.test(normalized)) {
    throw new KiroAuthorizationOptionsError('Kiro IAM Identity Center region is invalid.');
  }
  return normalized;
}

export function normalizeKiroStartUrl(startUrl: string): string {
  const trimmed = startUrl.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new KiroAuthorizationOptionsError('Kiro IAM Identity Center start URL is invalid.');
  }
  if (parsed.protocol !== 'https:') {
    throw new KiroAuthorizationOptionsError('Kiro IAM Identity Center start URL must use HTTPS.');
  }
  return parsed.toString();
}

export { toAbsoluteExpiryTimestamp } from '../core/device-flow';

/** SSO OIDC returns the minimum poll `interval` in seconds; normalize to ms. */
export function toPollIntervalMs(interval?: number): number {
  return toDeviceFlowPollIntervalMs(interval, KIRO_DEFAULT_POLL_INTERVAL_MS);
}

/**
 * Persisted Kiro token blob. A superset of the generic OAuthTokenBlob (`t`/`r`/`e`)
 * so model discovery's generic unwrap path can read the access token, plus the
 * client credentials needed to refresh it (`cid`/`cs`) and the region the
 * registration lives in.
 */
export interface KiroOAuthTokenBlob {
  source: 'kiro-oidc';
  t: string;
  r: string;
  e: number;
  cid: string;
  cs: string;
  region?: string;
}

export function isKiroOAuthTokenBlob(value: unknown): value is KiroOAuthTokenBlob {
  if (!value || typeof value !== 'object') return false;
  const blob = value as Partial<KiroOAuthTokenBlob>;
  return (
    blob.source === 'kiro-oidc' &&
    typeof blob.t === 'string' &&
    blob.t.length > 0 &&
    typeof blob.r === 'string' &&
    blob.r.length > 0 &&
    typeof blob.cid === 'string' &&
    typeof blob.cs === 'string' &&
    typeof blob.e === 'number' &&
    Number.isFinite(blob.e)
  );
}

export function parseKiroOAuthTokenBlob(rawValue: string): KiroOAuthTokenBlob | null {
  try {
    const parsed = JSON.parse(rawValue) as unknown;
    return isKiroOAuthTokenBlob(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function serializeKiroOAuthTokenBlob(blob: KiroOAuthTokenBlob): string {
  return JSON.stringify(blob);
}
