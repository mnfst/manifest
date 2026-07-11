import { fetchJson, fetchMutate, type FetchJsonOptions } from './core';
import type { BillingEmailPreferences, BillingStatus } from 'manifest-shared';

// Re-export so UI components can import the type from the API module they
// already use, instead of reaching across package boundaries for it.
export type { BillingEmailPreferences, BillingStatus };

export function getBillingStatus(options?: FetchJsonOptions): Promise<BillingStatus> {
  if (options) {
    return fetchJson<BillingStatus>('/billing/status', undefined, options);
  }
  return fetchJson<BillingStatus>('/billing/status');
}

export function updateBillingEmailPreferences(
  preferences: BillingEmailPreferences,
): Promise<BillingEmailPreferences> {
  return fetchMutate<BillingEmailPreferences>('/billing/email-preferences', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(preferences),
  });
}
