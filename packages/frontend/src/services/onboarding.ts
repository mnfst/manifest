const PREFIX = 'manifest_onboarding_done_';

export function markOnboardingDone(userId: string): void {
  try {
    localStorage.setItem(`${PREFIX}${userId}`, '1');
  } catch {
    /* storage full or unavailable */
  }
}
