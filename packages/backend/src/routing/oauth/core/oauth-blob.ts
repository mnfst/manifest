/**
 * Compact JSON shape used to persist OAuth credentials in
 * `user_providers.api_key`. Field names are single letters to keep the
 * encrypted payload small.
 */
export interface OAuthTokenBlob {
  /** Access token. */
  t: string;
  /** Refresh token. */
  r: string;
  /** Access-token expiry (epoch ms). */
  e: number;
  /** Provider-specific resource URL (e.g. MiniMax region base URL). */
  u?: string;
}

export function isOAuthTokenBlob(value: unknown): value is OAuthTokenBlob {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<OAuthTokenBlob>;
  return (
    typeof v.t === 'string' &&
    typeof v.r === 'string' &&
    typeof v.e === 'number' &&
    (v.u === undefined || typeof v.u === 'string')
  );
}

export function parseOAuthTokenBlob(rawValue: string): OAuthTokenBlob | null {
  try {
    const parsed = JSON.parse(rawValue) as unknown;
    if (!isOAuthTokenBlob(parsed)) return null;
    return parsed.u !== undefined
      ? { t: parsed.t, r: parsed.r, e: parsed.e, u: parsed.u }
      : { t: parsed.t, r: parsed.r, e: parsed.e };
  } catch {
    return null;
  }
}

export function serializeOAuthTokenBlob(blob: OAuthTokenBlob): string {
  return JSON.stringify(blob);
}
