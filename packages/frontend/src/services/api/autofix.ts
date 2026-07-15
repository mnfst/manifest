import { fetchJson } from './core.js';

/** The current tenant's Auto-fix beta eligibility. */
export interface AutofixCohort {
  /**
   * Whether this tenant is in the Auto-fix access cohort, as resolved by the
   * backend (`AutofixService.hasAccess` — the `AUTOFIX_ROLLOUT` phase plus the
   * per-tenant access-grant / waitlist columns). The dashboard gates the
   * redesigned Auto-fix UI on this; everyone else keeps the existing UI.
   */
  eligible: boolean;
}

/**
 * Read the current tenant's Auto-fix beta eligibility. The cohort is entirely
 * backend-driven, so the frontend never hardcodes who is in it.
 *
 * Read fresh (no SWR cache): access can be granted mid-session, and this is a
 * single cheap GET per overview mount — a cached "not eligible" must never keep
 * the beta UI from a tenant that was just added to the allowlist.
 */
export function getAutofixCohort(): Promise<AutofixCohort> {
  return fetchJson<AutofixCohort>('/autofix/cohort', undefined, { cache: false });
}
