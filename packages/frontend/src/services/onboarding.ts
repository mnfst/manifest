const PREFIX = 'manifest_onboarding_done_';

export const SETUP_VIDEO_URL = 'https://www.youtube.com/@manifestbuild';

export const DOCS_URL = 'https://manifest.build/docs';

export function markOnboardingDone(userId: string): void {
  try {
    localStorage.setItem(`${PREFIX}${userId}`, '1');
  } catch {
    /* storage full or unavailable */
  }
}

export function hasOnboardingBeenDone(userId: string): boolean {
  try {
    return localStorage.getItem(`${PREFIX}${userId}`) === '1';
  } catch {
    return false;
  }
}

export function clearOnboardingDone(userId: string): void {
  try {
    localStorage.removeItem(`${PREFIX}${userId}`);
  } catch {
    /* noop */
  }
}
