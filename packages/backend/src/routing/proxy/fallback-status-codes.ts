export const FALLBACK_EXHAUSTED_STATUS = 424;

export function shouldTriggerFallback(status: number): boolean {
  if (status === FALLBACK_EXHAUSTED_STATUS) return false;
  return status >= 400;
}
