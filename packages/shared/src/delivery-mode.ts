export const DELIVERY_MODES = ['buffered', 'stream'] as const;

export type DeliveryMode = (typeof DELIVERY_MODES)[number];

export const DEFAULT_DELIVERY_MODE: DeliveryMode = 'buffered';

export function isDeliveryMode(value: unknown): value is DeliveryMode {
  return typeof value === 'string' && (DELIVERY_MODES as readonly string[]).includes(value);
}
