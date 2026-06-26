export const DEFAULT_MAX_MESSAGES_PER_REQUEST = 1000;

export function parseMaxMessagesPerRequest(rawValue?: string): number {
  const value = rawValue ?? '';
  if (!/^\d+$/.test(value)) {
    return DEFAULT_MAX_MESSAGES_PER_REQUEST;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_MESSAGES_PER_REQUEST;
}
