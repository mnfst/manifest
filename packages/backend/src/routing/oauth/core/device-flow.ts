/**
 * Shared helpers for device-style OAuth flows (MiniMax user-code grant,
 * Kiro / AWS SSO OIDC device code). Both providers return expiry as relative
 * seconds — except when they return an absolute epoch timestamp — and a poll
 * interval that may be in seconds or milliseconds.
 */

/** Values above this are treated as absolute epoch-ms timestamps, not relative seconds. */
export const ABSOLUTE_TIME_THRESHOLD_MS = 10_000_000_000;

export function toAbsoluteExpiryTimestamp(expiresIn: number): number {
  if (expiresIn > ABSOLUTE_TIME_THRESHOLD_MS) return expiresIn;
  return Date.now() + expiresIn * 1000;
}

/** Normalize a provider poll interval (seconds or ms) to ms, with a provider default. */
export function toPollIntervalMs(interval: number | undefined, defaultMs: number): number {
  if (!interval || interval <= 0) return defaultMs;
  return interval >= 1000 ? interval : interval * 1000;
}
