const RETRIABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

export function shouldTriggerFallback(status: number): boolean {
  return RETRIABLE_STATUSES.has(status);
}
