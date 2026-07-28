import type {
  PhoenixExplanation,
  PhoenixHealStatus,
  PhoenixOperation,
  PhoenixProviderError,
} from './phoenix.types';
import type { RecordableManifestCode } from '../../common/errors/manifest-error';

/**
 * How an Auto-fix attempt ended:
 * - `healed`     — a patched request eventually succeeded.
 * - `unfixable`  — Phoenix had no patch (`no_patch`) or returned an empty one.
 * - `resolving`  — Phoenix is still authoring a patch (novel error); nothing to
 *                  resend this time. A later request for the same issue may heal.
 * - `exhausted`  — a patched retry failed, or the healing flow aborted before
 *                  it could complete. Inspect `chain` to tell whether a retry
 *                  was actually sent.
 */
export type AutofixOutcome = 'healed' | 'unfixable' | 'resolving' | 'exhausted';

/**
 * One request actually sent to the provider during healing, in order. Entry 0
 * (`origin: 'original'`) is the agent's own request; later `autofix` entries are
 * the bodies Phoenix produced. The heal decision fields (`issue_id` … ) describe
 * what Phoenix said about THIS entry's failure; `patch_worked` says whether the
 * patch derived here produced a working request.
 */
export interface AutofixChainEntry {
  attempt: number;
  origin: 'original' | 'autofix';
  request: Record<string, unknown>;
  http_status: number;
  /** Absent on the terminal success entry. */
  error?: PhoenixProviderError;
  phoenix_status?: PhoenixHealStatus;
  issue_id?: string;
  patch_id?: string | null;
  heal_attempt_id?: string | null;
  operations?: PhoenixOperation[] | null;
  /** Phoenix's human-readable "why" for the fix derived here (null when none). */
  explanation?: PhoenixExplanation | null;
  patch_worked?: boolean;
}

/**
 * The full Auto-fix story. An `autofix` chain entry exists if and only if a
 * patched request was actually sent to the provider. The recorder uses that
 * invariant—not Phoenix consultation alone—to decide whether Auto-fix was
 * applied. When a retry exists, the failed original and retry are recorded as
 * linked `agent_messages` rows sharing `groupId`.
 */
export interface AutofixRecord {
  /** Shared id linking the failed-original and retry rows, when a retry exists. */
  groupId: string;
  outcome: AutofixOutcome;
  original_http_status: number;
  chain: AutofixChainEntry[];
  /**
   * Present when the healed failure was Manifest-blocked rather than a provider
   * response (e.g. an M302 unknown model — no provider was contacted for the
   * original). The recorder uses the no-provider attempt marker to avoid
   * inventing an original Provider Attempt; the Request retains the caller's
   * model and the actual retry is the sole Attempt.
   */
  manifestOrigin?: {
    code: RecordableManifestCode;
    /** The rendered `[🦚 Manifest M###] …` text the caller would have seen. */
    message: string;
    /** The model the caller requested (kept as the row's `model` column). */
    model: string;
  };
}

/** The patched provider attempt, when Manifest actually sent one. */
export function getAutofixRetry(autofix: AutofixRecord | undefined): AutofixChainEntry | undefined {
  return autofix?.chain.find((entry) => entry.origin === 'autofix');
}
