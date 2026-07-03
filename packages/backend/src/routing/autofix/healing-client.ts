import type { ConfirmResponse, HealOutcome, HealRequest, HealResponse } from './phoenix.types';

/**
 * Port to the Phoenix healing service. The proxy loop depends only on this
 * interface; the concrete client (mock vs HTTP) is chosen at module wiring time
 * by `AUTOFIX_HEALING_URL`. Keeping this seam stable means swapping in the real
 * service — or a future contract revision — never touches the loop.
 */
export interface HealingClient {
  /** Submit a failed request + provider error; get a heal decision back. */
  heal(input: HealRequest): Promise<HealResponse>;
  /**
   * Report the post-retry outcome of an applied patch (Phoenix's learning loop).
   * Phoenix decides succeeded/failed from the retry status + error. Best-effort:
   * returns null on transport failure rather than throwing, so a missed report
   * never breaks the user's request.
   */
  reportOutcome(healAttemptId: string, outcome: HealOutcome): Promise<ConfirmResponse | null>;
}

/** DI token for the active HealingClient implementation. */
export const HEALING_CLIENT = Symbol('HEALING_CLIENT');

/**
 * Thrown by a HealingClient when the healer is REACHABLE but rejected the heal
 * request with a 4xx — a contract mismatch, a malformed payload, or a missing/
 * invalid API key. It is deliberately distinct from a transport failure (timeout,
 * unreachable, 5xx): the service treats a contract error as a bug to surface, not
 * an outage, so it never trips the circuit breaker (shedding heal calls would
 * only hide the real problem). Carries the HTTP status for logging.
 */
export class HealContractError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HealContractError';
  }
}
