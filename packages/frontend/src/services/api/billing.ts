import { fetchJson, type FetchJsonOptions } from './core';
import type { BillingStatus } from 'manifest-shared';

// Re-export so UI components can import the type from the API module they
// already use, instead of reaching across package boundaries for it.
export type { BillingStatus };

export function getBillingStatus(options?: FetchJsonOptions): Promise<BillingStatus> {
  if (options) {
    return fetchJson<BillingStatus>('/billing/status', undefined, options);
  }
  return fetchJson<BillingStatus>('/billing/status');
}
