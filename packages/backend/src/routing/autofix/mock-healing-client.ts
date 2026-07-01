import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import type { HealingClient } from './healing-client';
import type { ConfirmResponse, HealOutcome, HealRequest, HealResponse } from './phoenix.types';

/**
 * Deterministic in-process stand-in for Phoenix, used when `AUTOFIX_HEALING_URL`
 * is unset. It implements the MVP #1 case end-to-end — an unknown-parameter 4xx
 * whose `param` has a known rename (e.g. the Responses API rejecting
 * `max_tokens`) is patched into `max_output_tokens` via a `rename_param`
 * operation. Everything else returns `no_patch`. Lets the whole heal → resend →
 * confirm loop be exercised without the external service.
 */
export const MOCK_RENAME_CATALOG: Record<string, string> = {
  max_tokens: 'max_output_tokens',
};

@Injectable()
export class MockHealingClient implements HealingClient {
  private readonly logger = new Logger(MockHealingClient.name);

  heal(input: HealRequest): Promise<HealResponse> {
    const issueId = uuid();
    const { code, param } = input.response.error;
    const rename = param ? MOCK_RENAME_CATALOG[param] : undefined;

    if (code === 'unknown_parameter' && param && rename && param in input.request) {
      const healedBody: Record<string, unknown> = { ...input.request };
      healedBody[rename] = healedBody[param];
      delete healedBody[param];
      this.logger.debug(`mock heal: rename_param ${param} -> ${rename}`);
      return Promise.resolve({
        status: 'patched',
        issueId,
        patchId: uuid(),
        healAttemptId: uuid(),
        operations: [{ type: 'rename_param', from: param, to: rename }],
        healedBody,
      });
    }

    return Promise.resolve({ status: 'no_patch', issueId });
  }

  reportOutcome(healAttemptId: string, outcome: HealOutcome): Promise<ConfirmResponse | null> {
    // Phoenix decides from the retry outcome: a cleared target (2xx or a
    // different error) succeeds; the same error recurring fails. The mock has no
    // memory of the original error, so it treats any non-4xx retry as success.
    const succeeded = outcome.retryStatusCode < 400;
    return Promise.resolve({
      healAttemptId,
      status: succeeded ? 'succeeded' : 'failed',
      issueStatus: succeeded ? 'pending_confirmation' : 'resolving',
    });
  }
}
