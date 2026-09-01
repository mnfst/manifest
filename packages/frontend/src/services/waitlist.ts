/**
 * Pivot waiting-list client. The claim is a public, CORS-open endpoint:
 * cloud dashboards post same-origin, production self-hosted dashboards post
 * straight to the cloud, and dev always stays same-origin so no test traffic
 * reaches production. Joined state lives per user in localStorage; the cloud
 * side dedupes by email, so a re-submit from another browser is harmless.
 */

const CLOUD_CLAIM_URL = 'https://app.manifest.build/api/v1/waitlist/pivot/claim';
const SAME_ORIGIN_CLAIM_PATH = '/api/v1/waitlist/pivot/claim';
const JOINED_PREFIX = 'manifest_pivot_waitlist_joined_';

export function getPivotClaimUrl(selfHosted: boolean, isDev = import.meta.env.DEV): string {
  if (!selfHosted || isDev) return SAME_ORIGIN_CLAIM_PATH;
  return CLOUD_CLAIM_URL;
}

export function markPivotJoined(userId: string): void {
  if (!userId) return;
  try {
    localStorage.setItem(`${JOINED_PREFIX}${userId}`, '1');
  } catch {
    /* storage full or unavailable */
  }
}

export function hasPivotJoined(userId: string): boolean {
  if (!userId) return false;
  try {
    return localStorage.getItem(`${JOINED_PREFIX}${userId}`) === '1';
  } catch {
    return false;
  }
}

/**
 * Submit the claim. The deployment mode rides along as the claim source so
 * attribution in waitlist_claims reflects where the person joined from.
 * Returns false on any failure so the modal can show a real error instead
 * of a fake success.
 */
export async function submitPivotClaim(email: string, selfHosted: boolean): Promise<boolean> {
  try {
    const res = await fetch(getPivotClaimUrl(selfHosted), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, source: selfHosted ? 'self-hosted' : 'cloud' }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
