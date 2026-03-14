const RETRIABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

export const FALLBACK_EXHAUSTED_STATUS = 424;

export function shouldTriggerFallback(status: number): boolean {
  return RETRIABLE_STATUSES.has(status);
}
