import { Logger } from '@nestjs/common';
import { HealContractError, type HealingClient } from './healing-client';
import type { ConfirmResponse, HealOutcome, HealRequest, HealResponse } from './phoenix.types';

/**
 * Talks to a real Phoenix deployment over HTTP. Constructed by the module
 * factory when `AUTOFIX_HEALING_URL` is set. `heal()` throws a
 * {@link HealContractError} on a 4xx (Phoenix is up but rejected us — bad
 * contract or a missing/invalid key) and a plain Error on a 5xx/transport
 * failure, so the service can tell a bug apart from an outage; either way the
 * loop treats it as "no fix available" and stops. `reportOutcome()` swallows
 * failures and returns null so a missed learning signal never breaks the user's
 * request.
 */
export class HttpHealingClient implements HealingClient {
  private readonly logger = new Logger(HttpHealingClient.name);
  private readonly baseUrl: string;

  constructor(
    baseUrl: string,
    private readonly timeoutMs: number,
    private readonly apiKey?: string,
  ) {
    // Trim before stripping trailing slashes so a value like `"…/ "` (slash +
    // stray whitespace, common in env files) still normalises to a clean base —
    // otherwise the slash survives and every `/api/heal` call hits a bad path.
    this.baseUrl = baseUrl.trim().replace(/\/+$/, '');
  }

  /**
   * Phoenix guards `/api/heal*` behind an API key and, in production, fails
   * closed without one. Send `x-api-key` when `AUTOFIX_HEALING_API_KEY` is set;
   * omit it otherwise so a keyless dev/test Phoenix still works.
   */
  private headers(): Record<string, string> {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (this.apiKey) headers['x-api-key'] = this.apiKey;
    return headers;
  }

  async heal(input: HealRequest): Promise<HealResponse> {
    const res = await fetch(`${this.baseUrl}/api/heal`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) {
      const message = `Phoenix /api/heal responded ${res.status}`;
      // 4xx = Phoenix rejected the request itself (contract/auth) — a bug to fix,
      // not an outage; keep it off the circuit breaker. 5xx falls through to a
      // plain Error and is treated as a transient availability failure.
      if (res.status >= 400 && res.status < 500) {
        throw new HealContractError(res.status, message);
      }
      throw new Error(message);
    }
    return (await res.json()) as HealResponse;
  }

  async reportOutcome(
    healAttemptId: string,
    outcome: HealOutcome,
  ): Promise<ConfirmResponse | null> {
    try {
      const res = await fetch(
        `${this.baseUrl}/api/heal-attempts/${encodeURIComponent(healAttemptId)}`,
        {
          method: 'PATCH',
          headers: this.headers(),
          body: JSON.stringify(outcome),
          signal: AbortSignal.timeout(this.timeoutMs),
        },
      );
      if (!res.ok) {
        this.logger.warn(`Phoenix heal-attempt ${healAttemptId} responded ${res.status}`);
        return null;
      }
      return (await res.json()) as ConfirmResponse;
    } catch (err) {
      this.logger.warn(`Phoenix heal-attempt ${healAttemptId} failed: ${(err as Error).message}`);
      return null;
    }
  }
}
