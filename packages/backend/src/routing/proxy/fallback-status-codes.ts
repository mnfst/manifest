import { classifyProviderError } from './proxy-error-sanitizer';

export function shouldTriggerFallback(status: number, rawBody?: string): boolean {
  if (rawBody && classifyProviderError(status, rawBody)?.terminal) return false;
  return status >= 400;
}
