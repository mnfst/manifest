export function shouldTriggerFallback(status: number): boolean {
  return status >= 400;
}
