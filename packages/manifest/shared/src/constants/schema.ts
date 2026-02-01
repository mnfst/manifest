import type { CompatibilityStatus } from '../types/schema.js';

/**
 * Status colors for connection edges.
 */
export const STATUS_COLORS: Record<CompatibilityStatus, string> = {
  compatible: '#22c55e',  // green-500
  warning: '#eab308',     // yellow-500
  error: '#ef4444',       // red-500
  unknown: '#6b7280',     // gray-500
};

/**
 * Get a human-readable label for a compatibility status.
 */
export function getStatusLabel(status: CompatibilityStatus): string {
  switch (status) {
    case 'compatible':
      return 'Compatible';
    case 'warning':
      return 'Warning';
    case 'error':
      return 'Incompatible';
    case 'unknown':
      return 'Unknown';
    default:
      return 'Unknown';
  }
}
