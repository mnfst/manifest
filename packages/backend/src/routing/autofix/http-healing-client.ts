import { Logger } from '@nestjs/common';
import type { HealingClient } from './healing-client';
import type { ConfirmResponse, HealOutcome, HealRequest, HealResponse } from './phoenix.types';

/**
 * Talks to a real Phoenix deployment over HTTP. Constructed by the module
 * factory when `AUTOFIX_HEALING_URL` is set. `heal()` throws on transport or
 * non-2xx failure (the loop treats that as "no fix available" and stops);
 * `confirm()` swallows failures and returns null so a missed learning signal
 * never breaks the user's request.
 */
export class HttpHealingClient implements HealingClient {
  private readonly logger = new Logger(HttpHealingClient.name);
  private readonly baseUrl: string;

  constructor(
    baseUrl: string,
    private readonly timeoutMs: number,
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  async heal(input: HealRequest): Promise<HealResponse> {
    const res = await fetch(`${this.baseUrl}/api/heal`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) {
      throw new Error(`Phoenix /api/heal responded ${res.status}`);
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
          headers: { 'content-type': 'application/json' },
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
