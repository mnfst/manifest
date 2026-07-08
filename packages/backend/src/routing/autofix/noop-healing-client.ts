import type { HealingClient } from './healing-client';
import type { ConfirmResponse, HealOutcome, HealRequest, HealResponse } from './phoenix.types';

/**
 * Inert healing client — the production default when no `AUTOFIX_HEALING_URL` is
 * configured. `heal()` always returns `no_patch`, so a request is never mutated;
 * `reportOutcome()` is a no-op. This keeps the dev-only {@link MockHealingClient}
 * (which rewrites real request bodies from a hardcoded catalog) out of
 * production: an operator who flips Auto-fix on without wiring Phoenix gets a
 * feature that does nothing, not one that silently patches live traffic.
 */
export class NoopHealingClient implements HealingClient {
  heal(_input: HealRequest): Promise<HealResponse> {
    return Promise.resolve({ status: 'no_patch', issueId: 'autofix-noop' });
  }

  reportOutcome(_healAttemptId: string, _outcome: HealOutcome): Promise<ConfirmResponse | null> {
    return Promise.resolve(null);
  }
}
