/**
 * Self-hosted user discovery onboarding step.
 *
 * Shown once to new self-hosted users right after signup. This module is the
 * frontend contract for the backend endpoints:
 *
 *   GET  /api/v1/discovery/status   -> { required: boolean }
 *   POST /api/v1/discovery/complete -> { ok: true }
 *        body: { name?, email?, projectType?, companySize? }
 *        (an empty body means the user skipped the form)
 *
 * Until those endpoints ship, completion is persisted per user in
 * localStorage so the step still appears exactly once per user on this
 * browser; once the backend exists its answer takes precedence for users
 * without a local flag.
 */

export interface DiscoverySubmission {
  name?: string;
  email?: string;
  projectType?: string;
  companySize?: string;
}

export interface DiscoveryOption {
  label: string;
  value: string;
}

export const PROJECT_TYPE_OPTIONS: DiscoveryOption[] = [
  { label: 'AI product or application', value: 'ai_product' },
  { label: 'AI agent', value: 'ai_agent' },
  { label: 'Internal AI tool or automation', value: 'internal_tool' },
  { label: 'AI workflow / automation platform', value: 'workflow_platform' },
  { label: 'Personal project / experimentation', value: 'personal_project' },
  { label: 'Other', value: 'other' },
];

export const COMPANY_SIZE_OPTIONS: DiscoveryOption[] = [
  { label: "I'm not using Manifest for work", value: 'not_for_work' },
  { label: '1–20', value: '1-20' },
  { label: '21–100', value: '21-100' },
  { label: '101–500', value: '101-500' },
  { label: '501–1,000', value: '501-1000' },
  { label: '1,000+', value: '1000+' },
];

const PREFIX = 'manifest_discovery_done_';

export function markDiscoveryDoneLocally(userId: string): void {
  try {
    localStorage.setItem(`${PREFIX}${userId}`, '1');
  } catch {
    /* storage full or unavailable */
  }
}

export function hasDiscoveryBeenDoneLocally(userId: string): boolean {
  try {
    return localStorage.getItem(`${PREFIX}${userId}`) === '1';
  } catch {
    return false;
  }
}

/**
 * Whether the discovery step should be shown to this user. The local flag
 * wins when present; otherwise the backend is asked. An unreachable or
 * not-yet-deployed endpoint keeps the step available (the page is only ever
 * reached through the post-signup redirect, so this never traps existing
 * users), while a reachable endpoint is trusted as the source of truth.
 */
export async function isDiscoveryRequired(userId: string): Promise<boolean> {
  if (hasDiscoveryBeenDoneLocally(userId)) return false;
  try {
    const res = await fetch('/api/v1/discovery/status', {
      credentials: 'include',
      cache: 'no-store',
    });
    if (!res.ok) return true;
    const data = (await res.json()) as { required?: boolean };
    return data.required === true;
  } catch {
    return true;
  }
}

/**
 * Record the step as done (submit and skip both land here — skip sends an
 * empty submission). The local flag is written first so the user is never
 * shown the form again even if the backend call fails or does not exist yet.
 */
export async function completeDiscovery(
  userId: string,
  submission: DiscoverySubmission,
): Promise<void> {
  markDiscoveryDoneLocally(userId);
  try {
    await fetch('/api/v1/discovery/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(submission),
    });
  } catch {
    /* endpoint unavailable — the local flag already recorded completion */
  }
}
