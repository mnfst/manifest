export const RESPONSE_MODES = ['buffered', 'stream'] as const;

export type ResponseMode = (typeof RESPONSE_MODES)[number];

export const DEFAULT_RESPONSE_MODE: ResponseMode = 'buffered';

export function isResponseMode(value: unknown): value is ResponseMode {
  return typeof value === 'string' && (RESPONSE_MODES as readonly string[]).includes(value);
}
