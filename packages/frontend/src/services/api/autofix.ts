import { fetchJson, fetchMutate } from './core.js';

/** The current tenant's Auto-fix access cohort. */
export interface AutofixCohort {
  /**
   * Whether this tenant is in the Auto-fix access cohort, as resolved by the
   * backend (`AutofixService.hasAccess` — the `AUTOFIX_ROLLOUT` phase plus the
   * per-tenant access-grant / waitlist columns). The dashboard shows the same
   * requests / attempts / fallbacks view to everyone; this only gates the
   * Auto-fix-specific pieces (auto-fixed KPIs and panels), which are simply
   * absent for a tenant outside the cohort.
   */
  eligible: boolean;
}

/**
 * Read the current tenant's Auto-fix access cohort. Membership is entirely
 * backend-driven, so the frontend never hardcodes who is in it.
 *
 * Read fresh (no SWR cache): access can be granted mid-session, and this is a
 * single cheap GET — a cached "not eligible" must never keep the Auto-fix panels
 * from a tenant that was just added to the cohort.
 */
export function getAutofixCohort(): Promise<AutofixCohort> {
  return fetchJson<AutofixCohort>('/autofix/cohort', undefined, { cache: false });
}

/** Toggle the current tenant's cohort grant. The backend exposes this only in development. */
export function setDevAutofixCohort(enabled: boolean): Promise<AutofixCohort> {
  return fetchMutate<AutofixCohort>('/autofix/cohort', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  });
}
