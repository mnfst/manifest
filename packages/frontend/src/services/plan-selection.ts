const KEY = 'manifest_plan_chosen';

export function markPlanChosen(): void {
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    /* storage full or unavailable */
  }
}

export function hasPlanBeenChosen(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function clearPlanChosen(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}
