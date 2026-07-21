import type { AutofixStatus } from 'manifest-shared';
import { t, type TextMessageKey } from '../i18n/index.js';

/**
 * Presentation keys for every wire-level Auto-fix outcome.
 *
 * Keeping this map exhaustive makes a newly added backend status a compile-time
 * error until its user-facing label is deliberately localized.
 */
export const AUTOFIX_STATUS_MESSAGE_KEYS = {
  no_patch: 'autofixStatus.noPatch',
  resolving: 'autofixStatus.resolving',
  retry_succeeded: 'autofixStatus.retrySucceeded',
  retry_failed: 'autofixStatus.retryFailed',
  service_error: 'autofixStatus.serviceError',
} as const satisfies Record<AutofixStatus, TextMessageKey>;

export function autofixStatusLabel(status: AutofixStatus): string {
  return t(AUTOFIX_STATUS_MESSAGE_KEYS[status]);
}
